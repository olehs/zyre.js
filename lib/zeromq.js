const zeromq = require('zeromq');

module.exports = zeromq;

module.exports.createRouter = (options) => new zeromq.Router(options);

module.exports.createDealer = (options) => new zeromq.Dealer(options);
