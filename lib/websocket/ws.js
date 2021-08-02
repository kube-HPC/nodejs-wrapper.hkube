const EventEmitter = require('events');
const WebSocket = require('ws');
const querystring = require('querystring');
const log = require('@hkube/logger').GetLogFromContainer();
const { Encoding } = require('@hkube/encoding');
const messages = require('../consts/messages');

class AlgorithmWS extends EventEmitter {
    constructor(options) {
        super();
        this._socket = null;
        this._url = AlgorithmWS.createUrl(options);
        const { encoding } = options.socket;
        this._reconnectInterval = options.reconnectInterval || 100;
        this._encoding = new Encoding({ type: encoding });
        this._maxPayload = options.maxPayload;
        log.info(`trying connect to ${this._url}`);
        this._printThrottleMessages = {
            [messages.outgoing.stopping]: { delay: 10000, lastPrint: null },
            [messages.outgoing.streamingStatistics]: { delay: 30000, lastPrint: null }
        };
        this._connect();
    }

    get url() {
        return this._url;
    }

    static createUrl(options) {
        const { url, protocol, host, port, encoding } = options.socket;
        const { storageMode } = options;
        const query = {
            encoding,
            storage: storageMode
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
                case 1013:
                    log.info('Another client is already connected for debug');
                    this._reconnect();
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
            log.info(`got message from worker: ${payload.command}`);
            this.emit(payload.command, payload.data);
        });
    }

    _reconnect() {
        this._socket.removeAllListeners();
        setTimeout(() => {
            this._connect();
        }, this._reconnectInterval);
    }

    _printThrottle(message) {
        const setting = this._printThrottleMessages[message.command];
        let shouldPrint = true;
        if (setting) {
            const { delay, lastPrint } = setting;
            if (!lastPrint || Date.now() - lastPrint > delay) {
                shouldPrint = true;
                setting.lastPrint = Date.now();
            }
            else {
                shouldPrint = false;
            }
        }
        if (shouldPrint) {
            log.info(`sending message to worker: ${message.command}`);
        }
    }

    send(message) {
        if (message.command !== messages.outgoing.logData) {
            this._printThrottle(message);
        }
        this._socket.send(this._encoding.encode(message));
    }
}

module.exports = AlgorithmWS;
