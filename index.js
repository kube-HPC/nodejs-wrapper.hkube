const Logger = require('@hkube/logger');
const config = require('./lib/config');
const log = new Logger(config.serviceName, config.logger); // eslint-disable-line

module.exports = require('./lib/algorunner');
module.exports.debug = require('./lib/debug');
module.exports.run = require('./lib/run').run;
module.exports.config = config;
module.exports.messages = require('./lib/consts/messages');
