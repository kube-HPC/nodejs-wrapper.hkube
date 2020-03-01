const zmq = require('zeromq');
const EventEmitter = require('events');


class ZeroMQRequest extends EventEmitter {
    constructor({ address, timedOut = 600, content }) {
        super();
        this.content = content;
        this.port = address.port;
        this.host = address.host;
        this.requester = zmq.socket('req');
        this.connected = false;
        this.timedOut = false;
        this.requester.monitor(timedOut - 5, 0);
        this.requester.on('connect', () => {
            this.connected = true;
        });
        this.requester.connect(`tcp://${address.host}:${address.port}`);
        this.requester.on('message', (reply) => {
            this.connected = true;
            this.requester.close();
            this.emit('message', reply);
        });
    }

    isConnected() {
        return this.connected;
    }

    async invoke() {
        await this.requester.send(this.content);
        return this.reply;
    }

    close() {
        this.requester.close();
    }
}

class ZeroMQServer extends EventEmitter {
    constructor({ port }) {
        super();
        this.init(port);
    }

    init(port) {
        this.responder = zmq.socket('rep');
        this.responder.bind(`tcp://*:${port}`, (err) => {
            if (err) {
                console.log(err);
            }
            else {
                console.log(`Listening on ${port}...`);
            }
        });
        this.responder.on('message', async (request) => {
            this.emit('message', request);
        });
        process.on('SIGINT', () => {
            try {
                this.responder.close();
            }
            // eslint-disable-next-line no-empty
            catch (e) {

            }
        });
    }

    send(objToSend) {
        this.responder.send(objToSend);
    }

    close() {
        this.responder.close();
    }
}

module.exports = { Request: ZeroMQRequest, Server: ZeroMQServer };
