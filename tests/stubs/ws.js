const EventEmitter = require('events');

class AlgorithmWS extends EventEmitter {
    constructor(options){
        super();
        console.log(`debugMode: ${options.debugMode}`);
    }
    send(message) {
        console.log(`sending message to worker: ${message.command}`);

    }
}

module.exports = AlgorithmWS;