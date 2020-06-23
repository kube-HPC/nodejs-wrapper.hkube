const EventEmitter = require('events');
const WebSocket = require('ws');
const querystring = require('querystring');
const { Encoding } = require('@hkube/encoding');

class AlgorithmWS extends EventEmitter {
    constructor(options) {
        super();
        this._socket = null;
        this._url = AlgorithmWS.createUrl(options);
        const { encoding } = options.socket;
        this._reconnectInterval = options.reconnectInterval || 100;
        this._encoding = new Encoding({ type: encoding });
        this._maxPayload = options.maxPayload;
        console.log(`trying connect to ${this._url}`);
        this._connect();
    }

    get url() {
        return this._url;
    }

    static createUrl(options) {
        const { url, protocol, host, port, encoding } = options.socket;
        const { storageMode, debugMode } = options;
        const query = {
            encoding,
            storage: debugMode ? 'v1' : storageMode
        };
        const qs = querystring.stringify(query);
        let combinedUrl = url || `${protocol}://${host}:${port}`;
        combinedUrl += `?${qs}`;
        return combinedUrl;
    }

    _connect() {
        this._socket = new WebSocket(this._url, { maxPayload: this._maxPayload });
        this._socket.on('open', () => {
            this.emit('connection');
        });
        this._handleConnectEvents();
        this._handleMessages();
    }

    _handleConnectEvents() {
        this._socket.on('close', (code) => {
            switch (code) {
                case 1000:
                    this.emit('disconnect', code);
                    break;
                default:
                    this._reconnect();
                    break;
            }
        });
        this._socket.on('error', (e) => {
            switch (e.code) {
                case 'ECONNREFUSED':
                    this._reconnect();
                    break;
                default:
                    this.emit('disconnect', e);
                    break;
            }
        });
    }

    _handleMessages() {
        this._socket.on('message', (message) => {
            const payload = this._encoding.decode(message);
            console.log(`got message from worker: ${payload.command}`);
            this.emit(payload.command, payload.data);
        });
    }

    _reconnect() {
        this._socket.removeAllListeners();
        setTimeout(() => {
            this._connect();
        }, this._reconnectInterval);
    }

    send(message) {
        console.log(`sending message to worker: ${message.command}`);
        this._socket.send(this._encoding.encode(message));
    }
}

module.exports = AlgorithmWS;
