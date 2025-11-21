// utils/logger.js
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const LOG_DIR = path.join(__dirname, '..', 'logs');

// Tworzenie katalogu jeśli nie istnieje
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger = pino({
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        level: 'debug',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino/file',
        level: 'info',
        options: {
          destination: `${LOG_DIR}/combined.log`,
        },
      },
      {
        target: 'pino/file',
        level: 'error',
        options: {
          destination: `${LOG_DIR}/error.log`,
        },
      }
    ]
  }
});

module.exports = logger;
