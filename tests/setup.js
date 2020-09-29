const mockery = require('mockery');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const config = require('../lib/config');

before(function () {
    mockery.enable({
        useCleanCache: false,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    mockery.registerSubstitute('./websocket/ws', `${process.cwd()}/tests/stubs/ws.js`);
    global.config = config;
    global.Algorunner = require('../index');
    dataAdapter.init(config)
})