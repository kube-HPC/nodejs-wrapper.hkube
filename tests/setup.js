const { dataAdapter } = require('@hkube/worker-data-adapter');
const wsServer = require('./stubs/ws');
const config = require('../lib/config');

before(async () => {
    await wsServer.init(config.socket);
    global.config = config;
    global.Algorunner = require('../index');
    await dataAdapter.init(config);
})