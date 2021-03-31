const config = require('./config');
const Algorunner = require('./algorunner');

const run = (callbacks) => {
    const algorunner = new Algorunner();
    if (!callbacks) {
        algorunner.loadAlgorithm(config.algorithm);
    }
    else {
        algorunner.loadAlgorithmCallbacks(callbacks);
    }
    algorunner.connectToWorker(config);
    return algorunner;
};

module.exports = {
    run
};
