const fs = require('fs');
const pathLib = require('path');
const log = require('@hkube/logger').GetLogFromContainer();
const { pipelineKind, stateType } = require('@hkube/consts');
const { dataAdapter, DataServer, StreamingManager } = require('@hkube/worker-data-adapter');
const tracer = require('./utils/tracer');
const Websocket = require('./websocket/ws');
const messages = require('./consts/messages');
const methods = require('./consts/methods');
const CodeApi = require('./codeApi/codeApi');
const StatelessWrapper = require('./StatelessWrapper');

class Algorunner {
    constructor() {
        this._url = null;
        this._input = null;
        this._loadAlgorithmError = null;
        this._algorithm = Object.create(null);
        this._originalAlgorithm = Object.create(null);
        this._statelessWrapped = Object.create(null);
        this._startSpan = undefined;
        this._hkubeApi = null;
        this._streamingManager = new StreamingManager();
        tracer.traceWrappers(['_init', '_start'], this, data => data);
    }

    async connectToWorker(options) {
        try {
            this._options = options;
            this._isStorageMode = options.storageMode !== 'v1';
            this._wsc = this.createWS(this._options);
            this._hkubeApi = new CodeApi(this._wsc, this, dataAdapter, this._isStorageMode, this._streamingManager);
            this._registerToCommunicationEvents();
            this._wrapStateless();
            await tracer.init(this._options.tracer);
            if (this._isStorageMode) {
                await this.initStorage(this._options);
            }
        }
        catch (e) {
            log.error(e.message);
        }
    }

    createWS(options) {
        const ws = new Websocket(options);
        this._url = ws.url;
        return ws;
    }

    get url() {
        return this._url;
    }

    static requireAlgorithm(options) {
        if (!options || !options.path) {
            throw new Error('missing path');
        }
        const { path, entryPoint } = options;
        const entry = entryPoint || '';
        const cwd = pathLib.join(process.cwd(), path);
        if (!fs.existsSync(cwd)) {
            throw new Error(`invalid path ${path}`);
        }
        const fullPath = pathLib.join(cwd, entry);
        process.chdir(cwd);
        log.info(`loading ${fullPath}`);
        const algorithm = require(fullPath); // eslint-disable-line
        log.info('algorithm code loaded');
        return algorithm;
    }

    loadAlgorithm(options) {
        try {
            const algorithm = Algorunner.requireAlgorithm(options);
            this._loadAlgorithm(algorithm);
        }
        catch (e) {
            this._loadAlgorithmError = e.message;
            log.error(e.message);
        }
    }

    loadAlgorithmCallbacks(callbacks) {
        if (!callbacks) {
            throw new Error('missing callbacks object');
        }
        this._loadAlgorithm(callbacks);
    }

    _loadAlgorithm(algorithm) {
        try {
            Object.entries(methods).forEach(([k, v]) => {
                const method = algorithm[k];
                if (method && typeof method === 'function') {
                    log.info(`found method ${k}`);
                    this._algorithm[k] = method;
                    this._originalAlgorithm[k] = method;
                }
                else {
                    const error = `unable to find ${v.type} method ${k}`;
                    if (v.type === 'mandatory') {
                        throw new Error(error);
                    }
                    log.info(error);
                }
            });
            log.info('algorithm code loaded');
        }
        catch (e) {
            this._loadAlgorithmError = e.message;
            log.error(e.message);
        }
    }

    _wrapStateless() {
        this._statelessWrapped = new StatelessWrapper(this._originalAlgorithm, this._hkubeApi);
    }

    async initStorage(options) {
        await this._initDataServer(options);
        await this._initDataAdapter(options);
    }

    async _initDataServer(options) {
        if (!options.discovery.enable) {
            return;
        }
        this._discovery = { host: options.discovery.host, port: options.discovery.port };
        this._dataServer = new DataServer(options.discovery);
        await this._dataServer.listen();
        this._reportServingStatus(options.discovery.servingReportInterval);
        tracer.traceWrappers(['_createReply'], this._dataServer, () => ({ spanId: this._startSpan }));
    }

    async _initDataAdapter(options) {
        await dataAdapter.init(options, this._dataServer);
        tracer.traceWrappers(['getData', 'setData', '_getFromPeer', '_getFromStorage'], dataAdapter, () => ({ spanId: this._startSpan }));
    }

    _reportServingStatus(interval) {
        setInterval(() => {
            const isServing = this._dataServer.isServing();
            if (isServing) {
                this._sendCommand({ command: messages.outgoing.servingStatus, data: true });
            }
        }, interval);
    }

    _registerToCommunicationEvents() {
        this._wsc.on('connection', () => {
            log.debug(`connected to ${this._url}`);
        });
        this._wsc.on('disconnect', () => {
            log.debug(`disconnected from ${this._url}`);
        });
        this._wsc.on(messages.incoming.initialize, options => this._init(options));
        this._wsc.on(messages.incoming.start, options => this._start(options));
        this._wsc.on(messages.incoming.stop, options => this._stop(options));
        this._wsc.on(messages.incoming.exit, options => this._exit(options));
        this._wsc.on(messages.incoming.execAlgorithmDone, options => this._hkubeApi.algorithmExecutionDone(options));
        this._wsc.on(messages.incoming.execAlgorithmError, options => this._hkubeApi.algorithmExecutionDone(options));
        this._wsc.on(messages.incoming.dataSourceResponse, options => this._hkubeApi.dataSourceDone(options));
        this._wsc.on(messages.incoming.dataSourceResponseError, options => this._hkubeApi.dataSourceDone(options));
        this._wsc.on(messages.incoming.subPipelineDone, options => this._hkubeApi.subPipelineDone(options));
        this._wsc.on(messages.incoming.subPipelineError, options => this._hkubeApi.subPipelineDone(options));
        this._wsc.on(messages.incoming.subPipelineStopped, options => this._hkubeApi.subPipelineDone(options));
        this._wsc.on(messages.incoming.serviceDiscoveryUpdate, options => this._discoveryUpdate(options));
        this._wsc.on(messages.incoming.streamingInMessage, async (options) => {
            const sendMessage = (message, flowName) => {
                this._hkubeApi.sendMessageWithId(message, flowName, options.sendMessageId);
            };
            await this._streamingManager._onMessage({ payload: options.payload, origin: options.origin, sendMessageId: options.sendMessageId, sendMessage });
            this._wsc.send({ command: messages.outgoing.streamingInMessageDone, data: { sendMessageId: options.sendMessageId } });
        });
    }

    _discoveryUpdate(discovery) {
        log.debug(`Got discovery update with ${discovery.length} changes`);
        const listenerConfig = { encoding: this._options.discovery.encoding };
        this._streamingManager.setupStreamingListeners({
            listenerConfig,
            discovery,
            consumerName: this._nodeName
        });
    }

    _setupStreamingProducer() {
        if (this._isStreaming && this._childs?.length) {
            this._streamingManager.setupStreamingProducer({
                onStatistics: s => this._sendCommand({ command: messages.outgoing.streamingStatistics, data: s }),
                producerConfig: this._options.discovery.streaming,
                consumers: this._childs,
                nodeName: this._nodeName,
                parsedFlow: this._input.parsedFlow,
                defaultFlow: this._input.defaultFlow
            });
        }
    }

    async _init(options) {
        try {
            if (this._loadAlgorithmError) {
                this._sendError(this._loadAlgorithmError);
            }
            else {
                this._input = options;
                this._nodeName = options.nodeName;
                this._isStreaming = options.kind === pipelineKind.Stream;
                this._childs = options.childs;
                if (this._isStreaming && options.stateType === stateType.Stateless) {
                    this._algorithm = this._statelessWrapped;
                }
                else {
                    this._algorithm = this._originalAlgorithm;
                }
                if (this._algorithm.init) {
                    await this._algorithm.init(options);
                }
                this._sendCommand({ command: messages.outgoing.initialized });
            }
        }
        catch (error) {
            this._sendError(error);
        }
    }

    getJobId() {
        return this._input?.jobId;
    }

    async _start() {
        try {
            this._setupStreamingProducer();
            this._startSpan = tracer.topSpanContext();
            this._sendCommand({ command: messages.outgoing.started });
            const { jobId, taskId, nodeName, info } = this._input;
            this._input.input = await dataAdapter.getData(this._input);
            const algorithmData = await this._algorithm.start(this._input, this._hkubeApi);
            await this._handleResponse(algorithmData, jobId, taskId, nodeName, info);
        }
        catch (error) {
            this._sendError(error);
        }
        finally {
            this._startSpan = undefined;
        }
    }

    _handleResponse(algorithmData, jobId, taskId, nodeName, info) {
        if (!this._isStorageMode) {
            return this._handleResponseV1(algorithmData);
        }
        return this._handleResponseV2(algorithmData, jobId, taskId, nodeName, info);
    }

    _handleResponseV1(algorithmData) {
        this._sendCommand({ command: messages.outgoing.done, data: algorithmData });
    }

    async _handleResponseV2(algorithmData, jobId, taskId, nodeName, info) {
        const { header, payload: encodedData } = dataAdapter.encodeHeaderPayload(algorithmData);
        const storageInfo = dataAdapter.createStorageInfo({ jobId, taskId, nodeName, data: algorithmData, encodedData, savePaths: info?.savePaths });
        let inCache = false;
        if (this._dataServer && info?.savePaths?.length) {
            const size = (encodedData && encodedData.length) || 0;
            inCache = this._dataServer.setSendingState(taskId, encodedData, size, header);
        }
        if (inCache) {
            this._sendCommand({ command: messages.outgoing.storing, data: { discovery: this._discovery, taskId, ...storageInfo } });
            await dataAdapter.setData({ jobId, taskId, header, data: encodedData });
        }
        else {
            await dataAdapter.setData({ jobId, taskId, header, data: encodedData });
            this._sendCommand({ command: messages.outgoing.storing, data: { ...storageInfo } });
        }
        if (this._isStreaming) {
            await this._hkubeApi.stopStreaming(false);
        }
        this._sendCommand({ command: messages.outgoing.done });
    }

    async _stop(options) {
        if (this._stopping) {
            log.info('Got stop command while already stopping');
            return;
        }
        try {
            this._stopping = true;
            if (this._algorithm.stop) {
                await this._algorithm.stop();
            }
            if (this._isStreaming) {
                if (!options.forceStop) {
                    log.info('entering stopping soon');
                    this._stoppingState = true;

                    if (!this._stoppingInterval) {
                        this._stoppingInterval = setInterval(() => {
                            if (this._stoppingState) {
                                this._sendCommand({ command: messages.outgoing.stopping });
                            }
                            else {
                                clearInterval(this._stoppingInterval);
                                this._stoppingInterval = null;
                            }
                        }, 1000);
                    }
                    await this._hkubeApi.stopStreaming(false);
                }
                else {
                    log.info('forcing stop');
                    await this._hkubeApi.stopStreaming(true);
                }
            }
            this._sendCommand({ command: messages.outgoing.stopped });
        }
        catch (error) {
            this._sendError(error);
        }
        finally {
            this._stoppingState = false;
            this._stopping = false;
            this._startSpan = undefined;
        }
    }

    async _exit(options) {
        const code = options?.exitCode || 0;
        try {
            if (this._algorithm.exit) {
                await this._algorithm.exit(options);
            }
            log.debug(`got exit command. Exiting with code ${code}`);
            this._dataServer?.close();
            this.exitProcess(code);
        }
        catch (error) {
            this._sendError(error);
            this.exitProcess(code);
        }
        finally {
            this._startSpan = undefined;
        }
    }

    exitProcess(code) {
        process.exit(code);
    }

    _sendCommand({ command, data }) {
        try {
            this._wsc.send({ command, data });
        }
        catch (error) {
            this._sendError(error);
        }
    }

    _sendError(error) {
        try {
            const message = error.message || error;
            log.error(message);
            this._wsc.send({
                command: messages.outgoing.error,
                error: {
                    code: 'Failed',
                    message,
                    details: error.stackTrace
                }
            });
        }
        catch (e) {
            log.error(e.message);
        }
    }
}

module.exports = Algorunner;
