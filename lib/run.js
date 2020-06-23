const Algorunner = require('./algorunner');
const config = require('./config');

const run = ({ callbacks } = {}) => {
    const algorunner = new Algorunner();
    if (callbacks) {
        algorunner.loadAlgorithmCallbacks(callbacks);
    }
    else {
        algorunner.loadAlgorithm(config.algorithm);
    }
    algorunner.connectToWorker(config);
    return algorunner;
};

module.exports = {
    run
};
