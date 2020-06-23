const config = {};
const parseBool = (value, defaultValue) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    return defaultValue || false;
};


config.socket = {
    port: process.env.WORKER_SOCKET_PORT || 3000,
    host: process.env.WORKER_SOCKET_HOST || 'localhost',
    protocol: process.env.WORKER_SOCKET_PROTOCOL || 'ws',
    url: process.env.WORKER_SOCKET_URL || null,
    encoding: process.env.WORKER_ALGORITHM_ENCODING || 'bson'
};

config.clusterName = process.env.CLUSTER_NAME || 'local';
config.defaultStorage = process.env.DEFAULT_STORAGE || 's3';
config.storageMode = config.socket.url ? 'v1' : (process.env.STORAGE_PROTOCOL || 'v2');

config.algorithm = {
    path: process.env.ALGORITHM_PATH || 'algorithm_unique_folder',
    entryPoint: process.env.ALGORITHM_ENTRY_POINT || 'index.js'
};

config.discovery = {
    host: process.env.POD_IP || '127.0.0.1',
    port: process.env.DISCOVERY_PORT || 9020,
    encoding: process.env.DISCOVERY_ENCODING || 'bson',
    enable: parseBool(process.env.DISCOVERY_ENABLE, true),
    timeout: process.env.DISCOVERY_TIMEOUT || 15000,
    maxCacheSize: process.env.DISCOVERY_MAX_CACHE_SIZE || 500
};

config.s3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT_URL || 'http://127.0.0.1:9000'
};

config.fs = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage'
};

config.storageAdapters = {
    s3: {
        connection: config.s3,
        encoding: process.env.STORAGE_ENCODING || 'bson',
        moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
    },
    fs: {
        connection: config.fs,
        encoding: process.env.STORAGE_ENCODING || 'bson',
        moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
    }
};

config.tracer = {
    tracerConfig: {
        serviceName: process.env.ALGORITHM_NAME || 'algorithm',
        reporter: {
            agentHost: process.env.JAEGER_AGENT_SERVICE_HOST || 'localhost',
            agentPort: process.env.JAEGER_AGENT_SERVICE_PORT_AGENT_BINARY || 6832
        }
    }
};

module.exports = config;