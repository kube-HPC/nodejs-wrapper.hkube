const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const uuid = require('uuid/v4');
const storageManager = require('@hkube/storage-manager');
const messages = require('../lib/consts/messages');
let Algorunner;
const delay = d => new Promise(r => setTimeout(r, d));
const cwd = process.cwd();
const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];

const storageS3 = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT_URL,
    binary: !!process.env.STORAGE_BINARY
};

const storageFS = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage',
    binary: !!process.env.STORAGE_BINARY
};

const config = {
    socket: {
        port: 3000,
        host: 'localhost',
        protocol: 'ws',
        url: null
    },
    algorithm: {
        path: 'tests/mocks/algorithm',
        entryPoint: 'index.js'
    },
    storage: {
        type: process.env.DEFAULT_STORAGE || 's3',
        clusterName: process.env.CLUSTER_NAME || 'local',
        enableCache: true,
        adapters: {
            s3: {
                connection: storageS3,
                moduleName: process.env.STORAGE_MODULE || '@hkube/s3-adapter'
            },
            fs: {
                connection: storageFS,
                moduleName: process.env.STORAGE_MODULE || '@hkube/fs-adapter'
            }
        }
    }
}

describe('Tests', () => {
    before(async function () {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
        mockery.registerSubstitute('./websocket/ws', `${process.cwd()}/tests/stubs/ws.js`);
        Algorunner = require('../index');
    })
    describe('loadAlgorithm', () => {
        it('should failed to load algorithm with no path', async () => {
            const algorunner = new Algorunner();
            algorunner.loadAlgorithm();
            expect(algorunner._loadAlgorithmError).to.equal('missing path');
        });
        it('should failed to load algorithm with empty path', async () => {
            const algorunner = new Algorunner();
            algorunner.loadAlgorithm({ path: '' });
            expect(algorunner._loadAlgorithmError).to.equal('missing path');
        });
        it('should failed to load algorithm with invalid path', async () => {
            const algorunner = new Algorunner();
            const path = 'invalid_path';
            algorunner.loadAlgorithm({ path });
            expect(algorunner._loadAlgorithmError).to.equal(`invalid path ${path}`);
        });
        it('should load algorithm with no entryPoint', async () => {
            const algorunner = new Algorunner();
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            expect(algorunner._algorithm).to.have.property('start');
        });
    });
    describe('connectToWorker', () => {
        it('should set the ws url', async () => {
            const algorunner = new Algorunner();
            algorunner.connectToWorker(config.socket);
            expect(algorunner._url).to.equal('ws://localhost:3000');
        });
        it('should set the algorithm input', async () => {
            const algorunner = new Algorunner();
            algorunner.connectToWorker(config.socket);
            algorunner._wsc.emit(messages.incoming.initialize, { input })
            expect(algorunner._input.input).to.eql(input);
        });
        it('should call initialized', async () => {
            const algorunner = new Algorunner();
            algorunner.connectToWorker(config.socket);
            const spy = sinon.spy(algorunner, "_sendCommand");
            algorunner._wsc.emit(messages.incoming.initialize, { input })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].command).to.equal(messages.outgoing.initialized);
        });
        it('should call initialized', async () => {
            const algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            algorunner.connectToWorker(config.socket);
            const spy = sinon.spy(algorunner, "_sendCommand");
            algorunner._wsc.emit(messages.incoming.initialize, { input })
            algorunner._wsc.emit(messages.incoming.start, { input })
            await delay(500);
            const calls = spy.getCalls();
            expect(spy.calledThrice).to.equal(true);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.done);
            expect(calls[2].args[0].data).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });
    });
    describe('Storage', () => {
        it('should call initialized', async () => {
            const algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            algorunner.connectToWorker(config.socket);
            await algorunner.initStorage(config.storage);
            const jobId = 'jobId:' + uuid();
            const link = await storageManager.hkube.put({ jobId, taskId: 'taskId:' + uuid(), data: { data: { engine: input[0] } } });
            const link2 = await storageManager.hkube.put({ jobId, taskId: 'taskId:' + uuid(), data: { myValue: input[1] } });
            const spy = sinon.spy(algorunner, "_sendCommand");
            const newInput = ['$$guid-5', '$$guid-6', 'test-param', true, 12345];
            const storage = {
                'guid-5': { storageInfo: link, path: 'data.engine' },
                'guid-6': { storageInfo: link2, path: 'myValue' }
            };
            const data = {
                input: newInput,
                storage
            }
            algorunner._wsc.emit(messages.incoming.initialize, data)
            algorunner._wsc.emit(messages.incoming.start, data)
            await delay(1000);
            const calls = spy.getCalls();
            expect(spy.calledThrice).to.equal(true);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.done);
            expect(calls[2].args[0].data).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        });
    });
});

