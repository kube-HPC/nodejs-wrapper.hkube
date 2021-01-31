const { waitFor } = require('./utils/waitFor');

class StatelessWrapper {
    constructor(algorithm) {
        this._hkubeApi = null;
        this._originalAlgorithm = algorithm;
        this._options = null;
        this._active = false;
        this._error = null;
    }

    async _invokeAlgorithm(message, origin, flowPattern) {
        if (this._originalAlgorithm.init) {
            await this._originalAlgorithm.init(message);
        }
        const options = {
            ...this._options,
            streamInput: { message, origin }
        };
        try {
            const result = await this._originalAlgorithm.start(options, this._hkubeApi);
            if (this._options.childs?.length) {
                this._hkubeApi.sendMessage(result, null, flowPattern);
            }
        }
        catch (e) {
            this._active = false;
            this._error = e;
        }
    }

    async start(options, hkubeApi) {
        this._hkubeApi = hkubeApi;
        this._hkubeApi.registerInputListener((...args) => this._invokeAlgorithm(...args));
        this._hkubeApi.startMessageListening();
        this._active = true;
        this._error = null;
        await waitFor({
            resolveCB: () => !this._active,
            rejectCB: () => this._error
        });
    }

    async init(options) {
        this._options = options;
    }

    async exit(data) {
        this._active = false;
        if (this._originalAlgorithm.exit) {
            this._originalAlgorithm.exit(data);
        }
    }

    async stop(data) {
        this._active = false;
        if (this._originalAlgorithm.stop) {
            this._originalAlgorithm.stop(data);
        }
    }
}

module.exports = StatelessWrapper;
