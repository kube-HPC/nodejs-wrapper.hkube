const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const messages = require('../lib/consts/messages');
let Algorunner;
const delay = d => new Promise(r => setTimeout(r, d));
const cwd = process.cwd();
const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];
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
});

