const EventEmitter = require('events');

class AlgorithmWS extends EventEmitter {
    constructor(options){
        super();
        this._sender = new EventEmitter();
        console.log(`debugMode: ${options.debugMode}`);
    }
    send(message) {
        console.log(`sending message to worker: ${message.command}`);
        this._sender.emit(message.command, message)
    }
}

module.exports = AlgorithmWS;