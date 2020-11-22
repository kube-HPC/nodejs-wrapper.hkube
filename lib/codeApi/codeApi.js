const messages = require('../consts/messages');

class CodeAPI {
    constructor(wc, wrapper, dataAdapter, storage) {
        this._wc = wc;
        this._wrapper = wrapper;
        this._dataAdapter = dataAdapter;
        this._storage = storage;
        this._lastExecId = 0;
        this._executions = {};
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
            const { error, includeResult, response, jobId } = data;
            if (error) {
                return execution.reject(error);
            }
            let result = null;
            if (includeResult) {
                const storageInfo = response?.storageInfo;
                if ((this._storage === 'v2' || this._storage === 'v3') && storageInfo) {
                    if (Array.isArray(storageInfo)) {
                        result = await this._dataAdapter._batchRequest(storageInfo, jobId);
                    }
                    else {
                        result = await this._dataAdapter._tryGetDataFromPeerOrStorage(storageInfo, this._wrapper._startSpan);
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
    }

    startAlgorithm(algorithmName, input = [], includeResult = true) {
        const execId = this._generateExecId();
        const message = {
            command: messages.outgoing.startAlgorithmExecution,
            data: {
                execId,
                algorithmName,
                input,
                includeResult
            }
        };
        return new Promise((resolve, reject) => {
            this._executions[execId] = {
                execId,
                resolve,
                reject
            };
            this._wc.send(message);
        });
    }

    _generateExecId() {
        this._lastExecId += 1;
        return `${this._lastExecId}`;
    }
}

module.exports = CodeAPI;
