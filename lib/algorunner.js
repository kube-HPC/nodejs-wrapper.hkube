const fs = require('fs');
const pathLib = require('path');
const { dataAdapter, DataServer } = require('@hkube/worker-data-adapter');
const tracer = require('./utils/tracer');
const Websocket = require('./websocket/ws');
const messages = require('./consts/messages');
const methods = require('./consts/methods');

class Algorunner {
    constructor() {
        this._url = null;
        this._input = null;
        this._loadAlgorithmError = null;
        this._algorithm = Object.create(null);
        this._startSpan = undefined;
        tracer.traceWrappers(['_init', '_start'], this, data => data);
    }

    async connectToWorker(options) {
        try {
            this._options = options;
            this._wsc = this.createWS(this._options);
            this._registerToCommunicationEvents();
            await tracer.init(this._options.tracer);
            if (this._options.storageMode !== 'v1') {
                await this.initStorage(this._options);
            }
        }
        catch (e) {
            console.error(e.message);
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
        console.log(`loading ${fullPath}`);
        const algorithm = require(fullPath); // eslint-disable-line
        console.log('algorithm code loaded');
        return algorithm;
    }

    loadAlgorithm(options) {
        try {
            const algorithm = Algorunner.requireAlgorithm(options);
            Object.entries(methods).forEach(([k, v]) => {
                const method = algorithm[k];
                if (method && typeof method === 'function') {
                    console.log(`found method ${k}`);
                    this._algorithm[k] = method;
                }
                else {
                    const error = `unable to find ${v.type} method ${k}`;
                    if (v.type === 'mandatory') {
                        throw new Error(error);
                    }
                    console.log(error);
                }
            });
        }
        catch (e) {
            this._loadAlgorithmError = e.message;
            console.error(e.message);
        }
    }

    loadAlgorithmCallbacks(callbacks) {
        try {
            if (!callbacks) {
                throw new Error('missing callbacks object');
            }
            const algorithm = callbacks;
            console.log('algorithm code loaded');

            Object.entries(methods).forEach(([k, v]) => {
                const method = algorithm[k];
                if (method && typeof method === 'function') {
                    console.log(`found method ${k}`);
                    this._algorithm[k] = method;
                }
                else {
                    const error = `unable to find ${v.type} method ${k}`;
                    if (v.type === 'mandatory') {
                        throw new Error(error);
                    }
                    console.log(error);
                }
            });
        }
        catch (e) {
            this._loadAlgorithmError = e.message;
            console.error(e.message);
        }
    }

    async initStorage(options) {
        await this._initDataServer(options);
        await this._initDataAdapter(options);
    }

    async _initDataServer(options) {
        this._discovery = { host: options.discovery.host, port: options.discovery.port };
        this._dataServer = new DataServer(options.discovery);
        await this._dataServer.listen();
        tracer.traceWrappers(['_createReply'], this._dataServer, () => ({ spanId: this._startSpan }));
    }

    async _initDataAdapter(options) {
        await dataAdapter.init(options, this._dataServer);
        tracer.traceWrappers(['getData', 'setData', '_getFromPeer', '_getFromStorage'], dataAdapter, () => ({ spanId: this._startSpan }));
    }

    _registerToCommunicationEvents() {
        this._wsc.on('connection', () => {
            console.debug(`connected to ${this._url}`);
        });
        this._wsc.on('disconnect', () => {
            console.debug(`disconnected from ${this._url}`);
        });
        this._wsc.on(messages.incoming.initialize, options => this._init(options));
        this._wsc.on(messages.incoming.start, options => this._start(options));
        this._wsc.on(messages.incoming.stop, options => this._stop(options));
        this._wsc.on(messages.incoming.exit, options => this._exit(options));
    }

    async _init(options) {
        try {
            if (this._loadAlgorithmError) {
                this._sendError(this._loadAlgorithmError);
            }
            else {
                this._input = options;
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

    async _start() {
        try {
            this._startSpan = tracer.topSpanContext();
            this._sendCommand({ command: messages.outgoing.started });
            const { jobId, taskId, nodeName, info } = this._input;
            this._input.input = await dataAdapter.getData(this._input);
            const algorithmData = await this._algorithm.start(this._input);

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
        if (this._options.storageMode === 'v1') {
            return this._handleResponseV1(algorithmData);
        }
        return this._handleResponseV2(algorithmData, jobId, taskId, nodeName, info);
    }

    _handleResponseV1(algorithmData) {
        this._sendCommand({ command: messages.outgoing.done, data: algorithmData });
    }

    async _handleResponseV2(algorithmData, jobId, taskId, nodeName, info) {
        const encodedData = dataAdapter.encode(algorithmData, { customEncode: true });
        const storageInfo = dataAdapter.createStorageInfo({ jobId, taskId, nodeName, data: algorithmData, encodedData, savePaths: info.savePaths });

        this._dataServer.setSendingState(taskId, algorithmData);
        this._sendCommand({ command: messages.outgoing.storing, data: { discovery: this._discovery, taskId, ...storageInfo } });
        await dataAdapter.setData({ jobId, taskId, data: encodedData });
        this._sendCommand({ command: messages.outgoing.done });
    }

    async _stop() {
        try {
            if (this._algorithm.stop) {
                await this._algorithm.stop();
            }
            this._sendCommand({ command: messages.outgoing.stopped });
        }
        catch (error) {
            this._sendError(error);
        }
        finally {
            this._startSpan = undefined;
        }
    }

    async _exit(options) {
        try {
            if (this._algorithm.exit) {
                await this._algorithm.exit(options);
            }
            const code = (options && options.exitCode) || 0;
            console.debug(`got exit command. Exiting with code ${code}`);
            await this._dataServer.waitTillServingIsDone();
            this.exitProcess(code);
        }
        catch (error) {
            this._sendError(error);
        }
        finally {
            this._startSpan = undefined;
        }
    }

    exitProcess(code) {
        process.exit(code);
    }

    _sendCommand({ command, data }) {
        this._wsc.send({ command, data });
    }

    _sendError(error) {
        const message = `Error: ${error.message || error}`;
        console.error(message);
        this._wsc.send({
            command: messages.outgoing.error,
            error: {
                code: 'Failed',
                message,
                details: error.stackTrace
            }
        });
    }
}


module.exports = Algorunner;
