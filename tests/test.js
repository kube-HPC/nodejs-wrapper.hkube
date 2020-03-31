const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const uuid = require('uuid/v4');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const messages = require('../lib/consts/messages');
let Algorunner;
const delay = d => new Promise(r => setTimeout(r, d));
const cwd = process.cwd();
const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];

const storageFS = {
    baseDirectory: process.env.BASE_FS_ADAPTER_DIRECTORY || '/var/tmp/fs/storage'
};

const config = {
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
    algorithmDiscovery: {
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
        it.skip('should set the ws url', async () => {
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
            await algorunner.connectToWorker(config);
            const jobId = 'jobId:' + uuid();
            const taskId = 'taskId:' + uuid();

            const spy = sinon.spy(algorunner, "_sendCommand");

            const data = {
                jobId,
                taskId,
                input: [],
                info: {},
                nodeName: 'green'
            }
            algorunner._wsc.emit(messages.incoming.initialize, data)
            algorunner._wsc.emit(messages.incoming.start, data)
            await delay(1000);
            const calls = spy.getCalls();
            expect(spy.callCount).to.equal(4);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.storing);
            expect(calls[3].args[0].command).to.equal(messages.outgoing.done);
        });
    });
    describe('Storage', () => {
        it('should call initialized', async () => {
            const algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            await algorunner.connectToWorker(config);
            const jobId = 'jobId:' + uuid();
            const taskId = 'taskId:' + uuid();
            const link = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), data: { data: { engine: input[0] } } });
            const link2 = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), data: { myValue: input[1] } });
            const newInput = ['$$guid-5', '$$guid-6', 'test-param', true, 12345];
            const storage = {
                'guid-5': { storageInfo: link, path: 'data.engine' },
                'guid-6': { storageInfo: link2, path: 'myValue' }
            };
            const flatInput = dataAdapter.flatInput({ input: newInput, storage });
            const data = {
                jobId,
                taskId,
                input: newInput,
                flatInput,
                nodeName: 'green',
                storage,
                info: {
                    savePaths: ['green']
                }
            }
            algorunner._wsc.emit(messages.incoming.initialize, data)
            algorunner._wsc.emit(messages.incoming.start, data)
            await delay(1000);
            expect(algorunner._input.input[0]).to.eql(input[0]);
            expect(algorunner._input.input[1]).to.eql(input[1]);
        });
    });
});

