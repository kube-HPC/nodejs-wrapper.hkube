class StatelessWrapper {
    constructor(algo) {
        this._hkubeApi = null;
        this.originalAlgorithm = algo;
        this.options = null;
        this.active = false;
        this.error = null;
    }

    async _invokeAlgorithm(message, origin) {
        if (this.originalAlgorithm.init) {
            await this.originalAlgorithm.init(message);
        }
        const options = {
            ...this.options,
            streamInput: { message, origin }
        };
        try {
            const result = await this.originalAlgorithm.start(options, this._hkubeApi);
            if (this.options.childs?.length) {
                this._hkubeApi.sendMessage(result);
            }
        }
        catch (e) {
            this.error = e;
        }
    }

    async start(options, hkubeApi) {
        this._hkubeApi = hkubeApi;
        this._hkubeApi.registerInputListener((...args) => this._invokeAlgorithm(...args));
        this._hkubeApi.startMessageListening();
        this.active = true;
        this.error = null;
        await this._wait(() => !this.active);
    }

    async init(options) {
        this.options = options;
    }

    async exit(data) {
        this.active = false;
        if (this.originalAlgorithm.exit) {
            this.originalAlgorithm.exit(data);
        }
    }

    async stop(data) {
        this.active = false;
        if (this.originalAlgorithm.stop) {
            this.originalAlgorithm.stop(data);
        }
    }

    _wait(predicate) {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (predicate()) {
                    clearInterval(interval);
                    return resolve();
                }
            }, 1000);
        });
    }
}

module.exports = StatelessWrapper;
