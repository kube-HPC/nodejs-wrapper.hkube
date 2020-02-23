const zmq = require('zeromq');
const { Serializing } = require('../helpers/binaryEncoding');

class DataRequest extends Serializing {
    constructor({ port, host, taskId, dataPath, binary }) {
        super({ binary });
        this.port = port;
        this.host = host;
        this.taskId = taskId;
        this.dataPath = dataPath;
        this.requester = zmq.socket('req');
        this.reply = new Promise((resolve) => {
            this.requester.on('message', (reply) => {
                this.requester.close();
                resolve(this._parse(reply));
            });
        });
        this.requester.connect(`tcp://${host}:${port}`);
        process.on('SIGINT', () => {
            this.requester.close();
        });
    }

    async invoke() {
        const { dataPath, taskId } = this;
        await this.requester.send(this._stringify({ taskId, dataPath }));
        return this.reply;
    }

    close() {
        this.requester.close();
    }
}

module.exports = DataRequest;
