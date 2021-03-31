const http = require('http');
const WebSocket = require('ws');

class WsServer {
    init(options) {
        return new Promise((resolve, reject) => {
            const server = http.createServer();
            const socketServer = new WebSocket.Server({ server });

            socketServer.on('connection', (socket, opt) => {
                console.log('Connected!!!');
            });
            socketServer.on('error', (error) => {
                console.error(`error ${error}`);
            });
            socketServer.on('listening', () => {
                console.log('listening');
            });
            server.listen(options.port, () => {
                return resolve();
            });
        });
    }
}

module.exports = new WsServer();