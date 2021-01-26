const { expect } = require('chai');
const { uuid } = require('@hkube/uid');
const clone = require('lodash.clonedeep');
const messages = require('../lib/consts/messages');
const { waitFor } = require('../lib/utils/waitFor');
const delay = d => new Promise(r => setTimeout(r, d));
const mainConfig = require('../lib/config');
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
        const configStateful = clone(mainConfig);
        const configStateless1 = clone(mainConfig);
        const configStateless2 = clone(mainConfig);
        configStateful.discovery.port += 2;
        configStateless1.discovery.port += 4;
        configStateless2.discovery.port += 6;
        configStateful.discovery.streaming.port += 8;
        configStateless1.discovery.streaming.port += 10;

        // stateful
        const MAX = 50;
        const statefulCB = {
            start: async (args, hkubeApi) => {
                Array.from(Array(MAX).keys()).forEach(a => hkubeApi.sendMessage({ data: 'hello yellow' }, 'main'));
                Array.from(Array(MAX).keys()).forEach(a => hkubeApi.sendMessage({ data: 'hello black' }, 'second'));
                await delay(5000);
            }
        }
        const stateful = new Algorunner();
        stateful.loadAlgorithmCallbacks(statefulCB);
        await stateful.connectToWorker(configStateful);
        const statefulData = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateful',
            nodeName: 'green',
            childs: ['yellow', 'black'],
            parsedFlow: {
                main: [{
                    source: 'green',
                    next: ['yellow']
                },
                {
                    source: 'yellow',
                    next: ['black']
                }],
                second: [{
                    source: 'green',
                    next: ['black']
                }]
            }
        }
        await stateful._init(statefulData);
        stateful._start({});
        await delay(500);

        const queue = stateful._streamingManager._messageProducer._adapter._messageQueue._everAppended;
        const { yellow, black } = queue;
        expect(yellow).to.eql(MAX);
        expect(black).to.eql(MAX);

        // stateless 1
        let countStateless = 0;
        const statelessCB1 = {
            start: (args) => {
                countStateless += 1;
                // throw new Error('ooopss');
                return 42;
            }
        }
        const stateless1 = new Algorunner();
        stateless1.loadAlgorithmCallbacks(statelessCB1);
        await stateless1.connectToWorker(configStateless1);
        const statelessData1 = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateless',
            nodeName: 'yellow',
            childs: ['black'],
            parsedFlow: {
                main: [{
                    source: 'green',
                    next: ['yellow']
                },
                {
                    source: 'yellow',
                    next: ['black']
                }]
            },
            defaultFlow: 'main'
        }
        await stateless1._init(statelessData1);
        stateless1._discoveryUpdate([{ nodeName: 'green', address: { host: 'localhost', port: configStateful.discovery.streaming.port }, type: 'Add' }]);

        // stateless 2
        const statelessCB2 = {
            start: (args) => {
                countStateless += 1;
                return 42;
            }
        }
        const stateless2 = new Algorunner();
        stateless2.loadAlgorithmCallbacks(statelessCB2);
        await stateless2.connectToWorker(configStateless2);

        const statelessData2 = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateless',
            nodeName: 'black'
        }
        await stateless2._init(statelessData2);
        stateless2._discoveryUpdate([
            {
                nodeName: 'yellow',
                address: { host: 'localhost', port: configStateless1.discovery.streaming.port },
                type: 'Add'
            },
            {
                nodeName: 'green',
                address: { host: 'localhost', port: configStateful.discovery.streaming.port },
                type: 'Add'
            }
        ]);
        stateless1._start({});
        stateless2._start({});
        await delay(500);

        await waitFor({ resolveCB: () => countStateless === MAX * 2 });
        expect(countStateless).to.eql(MAX * 2);
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