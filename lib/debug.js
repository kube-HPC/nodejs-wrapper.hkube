const path = require('path');
const clone = require('lodash.clonedeep');
const Algorunner = require('./algorunner');
const configFromFile = require('./config');

const debug = (debugUrl, callbacks, { algorithmName, hkubeUrl, pathToAlgorithm } = {}) => {
    const config = clone(configFromFile);
    const algorunner = new Algorunner();
    const algoFile = path.resolve(pathToAlgorithm || require.main.filename);
    config.algorithm.path = path.relative(process.cwd(), path.dirname(algoFile));
    if (!config.algorithm.path) {
        config.algorithm.path = './';
    }
    config.algorithm.entryPoint = path.basename(algoFile);
    let workerSocketUrl;
    if (debugUrl) {
        workerSocketUrl = debugUrl;
    }
    else if (hkubeUrl && algorithmName) {
        const url = new URL(hkubeUrl);
        url.pathname = `/hkube/debug/${algorithmName}`;
        url.protocol = 'ws';
        workerSocketUrl = url.toString();
    }
    if (!workerSocketUrl) {
        throw new Error('Unable to connect. Set either debugUrl or hkubeUrl+algorithmName in options');
    }
    config.socket.url = workerSocketUrl;
    config.storageMode = 'v1';
    if (callbacks) {
        algorunner.loadAlgorithmCallbacks(callbacks);
    }
    else {
        algorunner.loadAlgorithm(config.algorithm);
    }
    algorunner.connectToWorker(config);
    return algorunner;
};

module.exports = debug;
