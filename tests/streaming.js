const { expect } = require('chai');
const { uuid } = require('@hkube/uid');
const clone = require('lodash.clonedeep');
const Logger = require('@hkube/logger');
const config = require('../lib/config');
const log = new Logger(config.serviceName, config.logger);
const messages = require('../lib/consts/messages');
const { waitFor } = require('../lib/utils/waitFor');
const delay = d => new Promise(r => setTimeout(r, d));
const mainConfig = require('../lib/config');

let currentStreamingPort = mainConfig.discovery.streaming.port;
const streamingPort = () => {
    currentStreamingPort += 2;
    return currentStreamingPort;
};

const createConfig = () => {
    const config = clone(mainConfig);
    config.discovery.enable = false;
    config.discovery.streaming.port = streamingPort();
    return config;
};

let Algorunner

describe('Streaming', () => {
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
    it('should listening To Messages', async () => {
        const jobId = uuid();
        const configStateful = createConfig();
        let isListeningToMessages = false;
        const statefulCB = {
            start: async (args, hkubeApi) => {
                hkubeApi.startMessageListening();
                isListeningToMessages = hkubeApi.isListeningToMessages();
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
            nodeName: 'green'
        }
        await stateful._init(statefulData);
        stateful._discoveryUpdate([{ nodeName: 'green', address: { host: 'localhost', port: configStateful.discovery.streaming.port }, type: 'Add' }]);
        stateful._start({});
        await waitFor({ resolveCB: () => isListeningToMessages });
    });
    it('should stop while receive stream', async () => {
        const jobId = uuid();
        const configStateful1 = createConfig();
        const configStateful2 = createConfig();

        // stateful 1
        const MAX = 50;
        const statefulCB1 = {
            start: async (args, hkubeApi) => {
                Array.from(Array(MAX).keys()).forEach(a => hkubeApi.sendMessage({ data: 'hello stateful' }));
                await delay(50000);
            }
        }
        const stateful1 = new Algorunner();
        stateful1.loadAlgorithmCallbacks(statefulCB1);
        await stateful1.connectToWorker(configStateful1);
        const statefulData1 = {
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

        // stateful 2
        let count = 0;
        const statefulCB2 = {
            start: async (args, hkubeApi) => {
                hkubeApi.registerInputListener(async ({ payload, origin }) => {
                    count += 1;
                });
                hkubeApi.startMessageListening();
                await delay(50000);
            }
        }
        const stateful2 = new Algorunner();
        stateful2.loadAlgorithmCallbacks(statefulCB2);
        await stateful2.connectToWorker(configStateful2);
        const statefulData2 = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateful',
            nodeName: 'yellow',
        }

        await stateful1._init(statefulData1);
        await stateful2._init(statefulData2);
        stateful2._discoveryUpdate([{ nodeName: 'green', address: { host: 'localhost', port: configStateful1.discovery.streaming.port }, type: 'Add' }]);
        stateful1._start({});
        stateful2._start({});
        await delay(200);

        await stateful2._stop({ forceStop: false });

        await waitFor({ resolveCB: () => count >= 1 });
        expect(count).to.gte(1);
    });
    it('should stream stateful >> stateful', async () => {
        const jobId = uuid();
        const configStateful1 = createConfig();
        const configStateful2 = createConfig();
        const configStateful3 = createConfig();

        // stateful 1
        const MAX = 50;
        const statefulCB1 = {
            start: async (args, hkubeApi) => {
                setInterval(() => {
                    hkubeApi.sendMessage({ data: 'hello stateful' });
                }, 50);
                await delay(50000);
            }
        }
        const stateful1 = new Algorunner();
        stateful1.loadAlgorithmCallbacks(statefulCB1);
        await stateful1.connectToWorker(configStateful1);
        const statefulData1 = {
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
                },
                {
                    source: 'yellow',
                    next: ['black']
                }]
            },
            defaultFlow: 'main'
        }

        // stateful 2
        let count = 0;
        const statefulCB2 = {
            start: async (args, hkubeApi) => {
                hkubeApi.registerInputListener(({ payload, origin, sendMessage }) => {
                    count += 1;
                    sendMessage({ data: payload });
                });
                hkubeApi.startMessageListening();
                await delay(50000);
            }
        }
        const stateful2 = new Algorunner();
        stateful2.loadAlgorithmCallbacks(statefulCB2);
        await stateful2.connectToWorker(configStateful2);
        const statefulData2 = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateful',
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

        // stateful 3
        const statefulCB3 = {
            start: async (args, hkubeApi) => {
                hkubeApi.registerInputListener(({ payload, origin, sendMessage }) => {
                    count += 1;
                    sendMessage({ data: payload });
                });
                hkubeApi.startMessageListening();
                await delay(50000);
            }
        }
        const stateful3 = new Algorunner();
        stateful3.loadAlgorithmCallbacks(statefulCB3);
        await stateful3.connectToWorker(configStateful3);
        const statefulData3 = {
            jobId,
            taskId: uuid(),
            input: [],
            kind: 'stream',
            stateType: 'stateful',
            nodeName: 'black',
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

        await stateful1._init(statefulData1);
        await stateful2._init(statefulData2);
        await stateful3._init(statefulData3);
        stateful2._discoveryUpdate([{ nodeName: 'green', address: { host: 'localhost', port: configStateful1.discovery.streaming.port }, type: 'Add' }]);
        stateful3._discoveryUpdate([{ nodeName: 'yellow', address: { host: 'localhost', port: configStateful2.discovery.streaming.port }, type: 'Add' }]);
        stateful1._start({});
        stateful2._start({});
        stateful3._start({});
        await delay(500);

        await waitFor({ resolveCB: () => count >= MAX });
        expect(count).to.gte(MAX);
    });
    it.only('should stream stateful >> stateless', async () => {
        const jobId = uuid();
        const configStateful = createConfig();
        const configStateless1 = createConfig();
        const configStateless2 = createConfig();

        // stateful
        const MAX = 50;
        const statefulCB = {
            start: async (args, hkubeApi) => {
                const keys = Array.from(Array(MAX).keys());
                keys.forEach(a => hkubeApi.sendMessage({ data: 'hello yellow' }, 'main'));
                keys.forEach(a => hkubeApi.sendMessage({ data: 'hello black' }, 'second'));
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
        const statelessMap = {
            stateless1: { green: 0 },
            stateless2: { green: 0, yellow: 0 },
        };
        const statelessCB1 = {
            start: (args) => {
                const origin = args.streamInput.origin;
                statelessMap.stateless1[origin] += 1;
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
                const origin = args.streamInput.origin;
                statelessMap.stateless2[origin] += 1;
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

        await waitFor({
            resolveCB: () =>
                statelessMap.stateless1.green === MAX
                && statelessMap.stateless2.green === MAX
                && statelessMap.stateless2.yellow === MAX
        });
        expect(countStateless).to.gte(MAX);
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