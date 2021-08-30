const { expect } = require('chai');
const { StdOutRedirect } = require('../lib/utils/stdOutRedirect');
describe('utils', () => {
    it('StdOutRedirect', async () => {
        let resolvePrint;
        const stdOut = new StdOutRedirect();
        const printInvoked = new Promise((res, rej) => {
            resolvePrint = res;
        });
        stdOut.on('print', (printData) => { if (printData == 'printData') { resolvePrint() } });
        process.stdout.write('printData');
        await printInvoked;
        stdOut.clear();

    });
})