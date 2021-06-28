const { uuid } = require('@hkube/uid');
const messages = require('../consts/messages');

class CodeAPI {
    constructor(wc, wrapper, dataAdapter, isStorageMode, streamingManager) {
        this._wc = wc;
        this._wrapper = wrapper;
        this._dataAdapter = dataAdapter;
        this._isStorageMode = isStorageMode;
        this._lastExecId = 0;
        this._executions = {};
        this._streamingManager = streamingManager;
    }

    registerInputListener(onMessage) {
        this._streamingManager.registerInputListener(onMessage);
    }

    startMessageListening() {
        this._streamingManager.startMessageListening();
    }

    sendMessageWithId(message, flowName, sendMessageId) {
        const messageAndCommand = {
            command: messages.outgoing.streamingOutMessage,
            data: {
                message,
                flowName,
                sendMessageId
            }
        };
        this._wc.send(messageAndCommand);
    }

    sendMessage(message, flowName, flowPattern) {
        this._streamingManager.sendMessage({ message, flowName, flowPattern });
    }

    async stopStreaming(force = true) {
        await this._streamingManager.stopStreaming(force);
    }

    isListeningToMessages() {
        return this._streamingManager.listeningToMessages;
    }

    algorithmExecutionDone(data) {
        const execId = data?.execId;
        this._handleExecutionDone(execId, data);
    }

    subPipelineDone(data) {
        const subPipelineId = data?.subPipelineId;
        this._handleExecutionDone(subPipelineId, data);
    }

    async _handleExecutionDone(execId, data) {
        const execution = this._executions[execId];
        try {
            const { error, response } = data;
            if (error) {
                return execution.reject(error);
            }
            let result = null;
            if (execution.includeResult) {
                if (this._isStorageMode && response?.storageInfo) {
                    result = await this._dataAdapter._tryGetDataFromPeerOrStorage(response);
                    if (Array.isArray(result)) {
                        await Promise.all(result.map(p => this._fillMissing(p)));
                    }
                }
                else {
                    result = response;
                }
            }
            return execution.resolve(result);
        }
        catch (error) {
            return execution.reject(error?.message);
        }
        finally {
            delete this._executions[execId];
        }
    }

    async _fillMissing(element) {
        if (element?.info?.isBigData) {
            const res = await this._dataAdapter._tryGetDataFromPeerOrStorage({ storageInfo: element.info });
            // eslint-disable-next-line no-param-reassign
            element.result = res;
        }
    }

    async startAlgorithm(algorithmName, input = [], includeResult = true) {
        const jobId = this._wrapper.getJobId();
        const storage = {};
        const storageInput = await Promise.all(input.map(async (inp) => {
            const taskId = uuid();
            const { header, payload: encodedData } = this._dataAdapter.encodeHeaderPayload(inp);
            const storageInfo = this._dataAdapter.createStorageInfo({ jobId, taskId, encodedData });
            storage[taskId] = storageInfo;
            await this._dataAdapter.setData({ header, jobId, taskId, data: encodedData });
            return `$$${taskId}`;
        }));

        const execId = this._generateExecId();
        const message = {
            command: messages.outgoing.startAlgorithmExecution,
            data: {
                execId,
                algorithmName,
                storageInput,
                storage,
                includeResult
            }
        };
        return this._createReplyPromise(execId, includeResult, message);
    }

    startStoredSubpipeline(name, flowInput = {}, includeResult = true) {
        const execId = this._generateExecId();
        const message = {
            command: messages.outgoing.startStoredSubPipeline,
            data: {
                subPipeline: {
                    name,
                    flowInput
                },
                subPipelineId: execId,
                includeResult
            }
        };
        return this._createReplyPromise(execId, includeResult, message);
    }

    startRawSubpipeline(name, nodes, flowInput, options = {}, webhooks = {}, includeResult = true) {
        const execId = this._generateExecId();
        const message = {
            command: messages.outgoing.startRawSubPipeline,
            data: {
                subPipeline: {
                    name,
                    nodes,
                    flowInput,
                    options,
                    webhooks
                },
                subPipelineId: execId,
                includeResult
            }
        };
        return this._createReplyPromise(execId, includeResult, message);
    }

    _generateExecId() {
        this._lastExecId += 1;
        return `${this._lastExecId}`;
    }

    _createReplyPromise(execId, includeResult, message) {
        return new Promise((resolve, reject) => {
            this._executions[execId] = {
                execId,
                includeResult,
                resolve,
                reject
            };
            this._wc.send(message);
        });
    }
}

module.exports = CodeAPI;
