const { expect } = require('chai');
const { uuid } = require('@hkube/uid');
const messages = require('../lib/consts/messages');
const delay = d => new Promise(r => setTimeout(r, d));
let Algorunner

describe('streaming', () => {
    before(() => {
        Algorunner = global.Algorunner;
    });
    it('should init with callbacks', () => {
        const callbacks = {
            start: (args) => {
                console.log('start')
            }
        }
        algorunner = Algorunner.run(callbacks);
        expect(algorunner._options.storageMode).to.eql('v3')
    });
    it.only('should init with stateless', async () => {
        const jobId = uuid();

        // stateful
        const statefulCB = {
            start: (args, hkubeApi) => {
                console.log('start');
                setInterval(() => {
                    hkubeApi.sendMessage({ data: 'hello stateless' });
                }, 100)
            }
        }
        const stateful = Algorunner.run(statefulCB);
        const statefulData = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateful',
            nodeName: 'green',
            childs: ['yellow'],
            parsedFlow: {
                main: [{
                    source: 'green',
                    next: ['yellow']
                }]
            },
            defaultFlow: 'main'
        }
        await stateful._init(statefulData);
        await stateful._start();

        // stateless
        const statelessCB = {
            start: (args) => {
                console.log('start')
            }
        }

        const stateless = Algorunner.run(statelessCB);
        const statelessData = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateless',
            nodeName: 'yellow'
        }
        await stateless._init(statelessData);
        stateless._start();
        await stateless._discoveryUpdate([{ nodeName: 'green', address: { host: 'localhost', port: 9022 }, type: 'Add' }]);
        await delay(80000);
    });
    it('should init with stateful', async () => {
        const callbacks = {
            start: (args) => {
                console.log('start')
            }
        }
        algorunner = Algorunner.run(callbacks);
        const input = [];
        const jobId = 'jobId:' + uuid();
        const taskId = 'taskId:' + uuid();
        const data = {
            jobId,
            taskId,
            input,
            kind: 'stream',
            stateType: 'stateful',
            nodeName: 'green',
            childs: ['yellow', 'black']
        }
        algorunner._wsc.emit(messages.incoming.initialize, data);
        await algorunner._start({});
    });
});