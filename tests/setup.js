const mockery = require('mockery');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const storageFS = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage'
};
global.config = {
    storage: process.env.WORKER_STORAGE || 'byRaw',
    socket: {
        port: 9876,
        host: 'localhost',
        protocol: 'ws',
        url: null,
        encoding: process.env.WORKER_ENCODING || 'bson'
    },
    algorithm: {
        path: 'tests/mocks/algorithm',
        entryPoint: 'index.js'
    },
    discovery: {
        host: process.env.POD_NAME || '127.0.0.1',
        port: process.env.DISCOVERY_PORT || 9020,
        encoding: 'bson'
    },
    clusterName: process.env.CLUSTER_NAME || 'local',
    defaultStorage: process.env.DEFAULT_STORAGE || 'fs',
    enableCache: true,
    storageAdapters: {
        fs: {
            encoding: 'bson',
            connection: storageFS,
            moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
        }
    },
    tracer: {
        tracerConfig: {
            serviceName: process.env.ALGORITHM_TYPE || "algorithm",
            reporter: {
                agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
                agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
            }
        }
    }
}
before(async function () {
    mockery.enable({
        useCleanCache: false,
        warnOnReplace: false,
        warnOnUnregistered: false
    });
    mockery.registerSubstitute('./websocket/ws', `${process.cwd()}/tests/stubs/ws.js`);
    global.Algorunner = require('../index');
    dataAdapter.init(config)
})