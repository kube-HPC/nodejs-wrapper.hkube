const { expect } = require('chai');
const sinon = require('sinon');
const { uuid } = require('@hkube/uid');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const { once } = require('events');
const messages = require('../lib/consts/messages');
const AlgorithmWS = require('../lib/websocket/ws');
const { assert } = require('console');

const delay = d => new Promise(r => setTimeout(r, d));
const cwd = process.cwd();
const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];
let algorunner;

let config;
let Algorunner
describe('Tests', () => {
    before(() => {
        Algorunner = global.Algorunner;
        config = global.config;
    });
    describe('sanity', () => {
        it('test AsyncFunction', () => {
            const asyncFunc = async () => ({});
            expect(asyncFunc.constructor.name).to.eql('AsyncFunction')
        });
        it('test named AsyncFunction', () => {
            const asyncFunc = async function asyncFunc() { }
            expect(asyncFunc.constructor.name).to.eql('AsyncFunction')
        });
    })
    describe('loadAlgorithm', () => {
        it('should failed to load algorithm with no path', async () => {
            algorunner = new Algorunner();
            algorunner.loadAlgorithm();
            expect(algorunner._loadAlgorithmError).to.equal('missing path');
        });
        it('should failed to load algorithm with empty path', async () => {
            algorunner = new Algorunner();
            algorunner.loadAlgorithm({ path: '' });
            expect(algorunner._loadAlgorithmError).to.equal('missing path');
        });
        it('should failed to load algorithm with invalid path', async () => {
            algorunner = new Algorunner();
            const path = 'invalid_path';
            algorunner.loadAlgorithm({ path });
            expect(algorunner._loadAlgorithmError).to.equal(`invalid path ${path}`);
        });
        it('should load algorithm with no entryPoint', async () => {
            algorunner = new Algorunner();
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            expect(algorunner._algorithm).to.have.property('start');
        });
    });
    describe('connectToWorker', () => {
        it('should set the ws url', async () => {
            const url = AlgorithmWS.createUrl(config);
            expect(url).to.equal('ws://localhost:3000?encoding=bson&storage=v2');
        });
        it('should set the algorithm input', async () => {
            algorunner = new Algorunner();
            algorunner.connectToWorker(config);
            algorunner._wsc.emit(messages.incoming.initialize, { input })
            expect(algorunner._input.input).to.eql(input);
        });
        it('should call initialized', async () => {
            algorunner = new Algorunner();
            algorunner.connectToWorker(config);
            const spy = sinon.spy(algorunner, "_sendCommand");
            algorunner._wsc.emit(messages.incoming.initialize, { input })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].command).to.equal(messages.outgoing.initialized);
        });
        it('should call exit', async () => {
            algorunner = new Algorunner();
            algorunner.exitProcess = () => { }
            await algorunner.connectToWorker(config);
            const spy = sinon.spy(algorunner, "_exit");
            algorunner._wsc.emit(messages.incoming.exit, { input })
            const call = spy.getCalls()[0];
            expect(spy.calledOnce).to.equal(true);
            expect(call.args[0].command).to.equal(messages.outgoing.exit);
        });
        it('should call all events', async () => {
            algorunner = new Algorunner();
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

        it('should start algorithm via codeApi', async () => {
            algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithmCode';
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
            algorunner._wsc._sender.on(messages.outgoing.error, () => {
                expect.fail('got unexpected error')
            })
            algorunner._wsc.emit(messages.incoming.initialize, data)
            const algorithmStarted = once(algorunner._wsc._sender, messages.outgoing.startAlgorithmExecution)
            algorunner._wsc.emit(messages.incoming.start, data)
            const [algorithmData] = await algorithmStarted
            const { execId } = algorithmData.data
            await delay(1000);
            algorunner._wsc.emit(messages.incoming.execAlgorithmDone, { execId })
            await delay(1000);
            const calls = spy.getCalls();
            expect(spy.callCount).to.equal(4);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.storing);
            expect(calls[3].args[0].command).to.equal(messages.outgoing.done);
            expect(algorunner._hkubeApi._executions[execId]).to.not.exist
        });

        it('should start stored pipeline via codeApi', async () => {
            algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithmCode';
            const entryPoint = 'indexPipe.js'
            algorunner.loadAlgorithm({ path, entryPoint });
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
            algorunner._wsc._sender.on(messages.outgoing.error, () => {
                expect.fail('got unexpected error')
            })
            algorunner._wsc.emit(messages.incoming.initialize, data)
            const algorithmStarted = once(algorunner._wsc._sender, messages.outgoing.startStoredSubPipeline)
            algorunner._wsc.emit(messages.incoming.start, data)
            const [algorithmData] = await algorithmStarted
            const { subPipelineId } = algorithmData.data
            await delay(1000);
            algorunner._wsc.emit(messages.incoming.subPipelineDone, { subPipelineId })
            await delay(1000);
            const calls = spy.getCalls();
            expect(spy.callCount).to.equal(4);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.storing);
            expect(calls[3].args[0].command).to.equal(messages.outgoing.done);
            expect(algorunner._hkubeApi._executions[subPipelineId]).to.not.exist
        });
        it('should start raw pipeline via codeApi', async () => {
            algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithmCode';
            const entryPoint = 'indexRawPipe.js'
            algorunner.loadAlgorithm({ path, entryPoint });
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
            algorunner._wsc._sender.on(messages.outgoing.error, () => {
                expect.fail('got unexpected error')
            })
            algorunner._wsc.emit(messages.incoming.initialize, data)
            const algorithmStarted = once(algorunner._wsc._sender, messages.outgoing.startRawSubPipeline)
            algorunner._wsc.emit(messages.incoming.start, data)
            const [algorithmData] = await algorithmStarted
            const { subPipelineId } = algorithmData.data
            await delay(1000);
            algorunner._wsc.emit(messages.incoming.subPipelineDone, { subPipelineId })
            await delay(1000);
            const calls = spy.getCalls();
            expect(spy.callCount).to.equal(4);
            expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
            expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
            expect(calls[2].args[0].command).to.equal(messages.outgoing.storing);
            expect(calls[3].args[0].command).to.equal(messages.outgoing.done);
            expect(algorunner._hkubeApi._executions[subPipelineId]).to.not.exist
        });
    });
    describe('Storage', () => {
        it('should call get correct data', async () => {
            algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            await algorunner.connectToWorker(config);
            const jobId = 'jobId:' + uuid();
            const taskId = 'taskId:' + uuid();
            const encodedData = dataAdapter.encodeHeaderPayload({ data: { engine: input[0] } });
            const encodedData2 = dataAdapter.encodeHeaderPayload({ myValue: input[1] });
            const link = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), header: encodedData.header, data: encodedData.payload });
            const link2 = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), header: encodedData2.header, data: encodedData2.payload });
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
        it('should not fail with many sockets', async () => {
            algorunner = new Algorunner();
            process.chdir(cwd);
            const path = '/tests/mocks/algorithm';
            algorunner.loadAlgorithm({ path });
            await algorunner.connectToWorker(config);
            const jobId = 'jobId:' + uuid();
            const taskId = 'taskId:' + uuid();
            const encodedData = dataAdapter.encode({ data: { engine: input[0] } }, { customEncode: true });
            const saveTaskId = `taskId:${uuid()}`
            const link = await dataAdapter.setData({ jobId, taskId: saveTaskId, data: encodedData });
            const newInput = ['$$guid-5'];
            const startPort = 19000;
            const notExistDiscovery = {
                discovery: {
                    host: "127.0.0.1",
                    port: "19020"
                },
                tasks: [saveTaskId],
                // storageInfo: link,
                path: 'data.engine'
            };
            const length = 50;
            const storage = {
                'guid-5': [...Array(length)].map((a, i) => ({
                    ...notExistDiscovery,
                    discovery: {
                        ...notExistDiscovery.discovery,
                        port: `${startPort + i}`
                    }
                }))
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
            await delay(2000);
            expect(algorunner._input.input[0]).to.have.lengthOf(length)
            expect(algorunner._input.input[0][0]).to.eql(input[0]);

        }).timeout(10000);
    });
});

