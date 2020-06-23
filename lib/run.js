const Algorunner = require('./algorunner');
const config = require('./config');

const run = (callbacks) => {
    const algorunner = new Algorunner();
    if (!callbacks) {
        throw new Error('missing callbacks option');
    }
    algorunner.loadAlgorithmCallbacks(callbacks);
    algorunner.connectToWorker(config);
    return algorunner;
};

module.exports = {
    run
};
