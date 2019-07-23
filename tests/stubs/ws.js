const EventEmitter = require('events');

class AlgorithmWS extends EventEmitter {

    send(message) {
        console.log(`sending message to worker: ${message.command}`);

    }
}

module.exports = AlgorithmWS;