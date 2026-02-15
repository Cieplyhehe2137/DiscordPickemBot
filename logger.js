const pino = require('pino');

const level =
  process.env.LOG_LEVEL || (process.env.DEBUG_LOGS === 'true' ? 'debug' : 'info');

const logger = pino({
  transport: {
    target: 'pino-pretty', 
    options: { colorize: true }
  },
  level
});

module.exports = logger;


//test

//test