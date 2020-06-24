const { expect } = require('chai');
const sinon = require('sinon');

const messages = require('../lib/consts/messages');

let config;
let Algorunner
describe('debug mode', () => {
    before(() => {
        Algorunner = global.Algorunner;
        config = global.config;
    });

    it('should fail without parameters', () => {
        expect(() => { Algorunner.debug() }).to.throw()
    });

    it('should init in debug mode', () => {
        const algorunner = Algorunner.debug('ws://debugurl', null, { pathToAlgorithm: '/tests/mocks/algorithm' });
        expect(algorunner._options.storageMode).to.eql('v1')
    });
    it('should init in debug mode with callbacks', () => {
        const callbacks = {
            start: (args) => {
                console.log('start')
            }
        }
        const algorunner = Algorunner.debug('ws://debugurl', callbacks);
        expect(algorunner._options.storageMode).to.eql('v1')
    });
    it('should send data through socket', async () => {
        const data = {
            res: 10,
            str: 'some string'
        };
        const callbacks = {
            start: (args) => {
                return data;
            }
        }

        const algorunner = Algorunner.debug('ws://debugurl', callbacks);
        expect(algorunner._options.storageMode).to.eql('v1')
        const spy = sinon.spy(algorunner, "_sendCommand");
        const input = [[3, 6, 9, 1, 5, 4, 8, 7, 2], 'asc'];
        algorunner._wsc.emit(messages.incoming.initialize, { input })
        expect(algorunner._input.input).to.eql(input);
        await algorunner._start({});
        const calls = spy.getCalls();
        expect(spy.callCount).to.equal(3);
        expect(calls[0].args[0].command).to.equal(messages.outgoing.initialized);
        expect(calls[1].args[0].command).to.equal(messages.outgoing.started);
        expect(calls[2].args[0].command).to.equal(messages.outgoing.done);
        expect(calls[2].args[0].data).to.eql(data);
    });
});