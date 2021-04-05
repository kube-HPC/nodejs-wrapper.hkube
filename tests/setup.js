const config = require('../lib/config');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const wsServer = require('./stubs/ws');

before(async () => {
    await wsServer.init(config.socket);
    global.config = config;
    global.Algorunner = require('../index');
    await dataAdapter.init(config);
})