const zmq = require('zeromq');
const consts = require('../consts/messages').server;
const { Serializing } = require('../helpers/binaryEncoding');

class DataServer extends Serializing {
    constructor({ port, binary }) {
        super({ binary });
        this.init(port);
    }

    setSendingState(taskId, data) {
        this.taskId = taskId;
        this.data = data;
    }

    endSendingState() {
        this.taskId = null;
        this.data = null;
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
        this.responder.on('message', (request) => {
            const parsedReq = this._parse(request);
            const { taskId, dataPath } = parsedReq;
            if (this.taskId !== taskId) {
                this._send({ message: consts.notAvailable, reason: `Current taskId is ${this.taskId}` });
                return;
            }
            const pathArr = dataPath && dataPath.split('.');
            let toSend = this.data;
            dataPath && pathArr.forEach((element) => {
                toSend = toSend && toSend[element];
            });
            if (!toSend) {
                this._send({ error: consts.noSuchDataPath, reason: `${dataPath} does not exist in data` });
                return;
            }
            this._send({ message: consts.success, data: toSend });
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

    _send(objToSend) {
        this.responder.send(this._stringify(objToSend));
    }

    close() {
        this.responder.close();
    }
}
module.exports = DataServer;
