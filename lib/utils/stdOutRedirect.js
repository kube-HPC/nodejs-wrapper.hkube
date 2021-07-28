const EventEmitter = require('events');

class StdOutRedirect extends EventEmitter {
    constructor() {
        super();
        this._originalStdoutWrite = process.stdout.write.bind(process.stdout);
        this._originalStderrWrite = process.stderr.write.bind(process.stderr);
        this._redirect();
    }

    _redirect() {
        process.stdout.write = (printData) => {
            this.printAndSend(printData, this._originalStdoutWrite);
        };
        process.stderr.write = (printData) => {
            this.printAndSend(printData, this._originalStderrWrite);
        };
    }

    clear() {
        process.stdout.write = this._originalStdoutWrite;
        process.stderr.write = this._originalStderrWrite;
    }

    printAndSend(printData, std) {
        const data = printData.trim().split('\n').filter(line => !line.startsWith('wrapper::'));
        if (data.length > 0) {
            this.emit('print', data);
        }
        std(printData);
    }
}
module.exports = {
    StdOutRedirect
};
