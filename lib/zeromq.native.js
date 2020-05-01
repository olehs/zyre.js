const zeromq = require('@olehs/react-native-zeromq').ZeroMQ;

module.exports = zeromq;

module.exports.createRouter = async ({ routingId, ...options }) => {
  if (typeof routingId !== 'undefined') options.identity = routingId;
  const socket = await zeromq.Router(options);
  socket.send = socket.sendBuffer;
  return socket;
};

module.exports.createDealer = async ({ routingId, ...options }) => {
  if (typeof routingId !== 'undefined') options.identity = routingId;
  const socket = await zeromq.Dealer(options);
  socket.send = socket.sendBuffer;
  return socket;
};
