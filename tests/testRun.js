const { expect } = require('chai');
const sinon = require('sinon');
const { v4: uuid } = require('uuid');

const messages = require('../lib/consts/messages');
const { dataAdapter } = require('@hkube/worker-data-adapter');
const delay = d => new Promise(r => setTimeout(r, d));

let config;
let Algorunner
let algorunner;
describe('run', () => {
    before(() => {
        Algorunner = global.Algorunner;
        config = global.config;
    });
    afterEach(async () => {
        if (algorunner && algorunner._dataServer) {
            await algorunner._dataServer.waitTillServingIsDone()
            await delay(100)
            algorunner._dataServer.close()
        }
    })
    it('should init without parameters', () => {
        expect(() => { Algorunner.run() }).to.throw()

    });
    it('should init with callbacks', () => {
        const callbacks = {
            start: (args) => {
                console.log('start')
            }
        }
        algorunner = Algorunner.run(callbacks);
        expect(algorunner._options.storageMode).to.eql('v2')
    });
    it('should send data through socket', async () => {
        const retData = {
            res: 10,
            str: 'some string'
        };
        const callbacks = {
            start: (args) => {
                return retData;
            }
        }

        algorunner = Algorunner.run(callbacks);
        expect(algorunner._options.storageMode).to.eql('v2')

        const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];

        const jobId = 'jobId:' + uuid();
        const taskId = 'taskId:' + uuid();
        const encodedData = dataAdapter.encode({ data: { engine: input[0] } }, { customEncode: true });
        const encodedData2 = dataAdapter.encode({ myValue: input[1] }, { customEncode: true });

        const link = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), data: encodedData });
        const link2 = await dataAdapter.setData({ jobId, taskId: 'taskId:' + uuid(), data: encodedData2 });
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

        const spy = sinon.spy(algorunner, "_sendCommand");
        algorunner._wsc.emit(messages.incoming.initialize, data)
        await algorunner._start({});
        const calls = spy.getCalls();
        expect(spy.callCount).to.equal(4);
        expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
        expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
        expect(calls[2].args[0].command).to.equal(messages.outgoing.storing);
        expect(calls[3].args[0].command).to.equal(messages.outgoing.done);
    });
});