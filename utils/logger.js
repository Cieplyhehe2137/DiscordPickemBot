// utils/logger.js
//
// Jeden, spójny logger dla całego bota.
// - Bazuje na pino (../logger.js)
// - Zachowuje stary interfejs: logger.info(scope, message, data)

const base = require('../logger');

const LEVELS = new Set(['info', 'warn', 'error', 'debug']);

function normalizeError(err) {
  if (!(err instanceof Error)) return err;
  return {
    err: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  };
}

function normalizeData(data) {
  if (!data) return undefined;

  if (data instanceof Error) {
    return normalizeError(data);
  }

  return data;
}

function log(level, scope, message, data) {
  const lvl = LEVELS.has(level) ? level : 'info';
  const scp = scope ? String(scope) : 'app';

  // przypadek: logger.error('x', err)
  if (message instanceof Error) {
    const extra = normalizeError(message);
    return base[lvl]({ scope: scp, ...extra }, message.message);
  }

  const extra = normalizeData(data);

  if (extra) {
    return base[lvl]({ scope: scp, ...extra }, message);
  }

  return base[lvl]({ scope: scp }, message);
}

module.exports = {
  info(scope, message, data) {
    log('info', scope, message, data);
  },
  warn(scope, message, data) {
    log('warn', scope, message, data);
  },
  error(scope, message, data) {
    log('error', scope, message, data);
  },
  debug(scope, message, data) {
    log('debug', scope, message, data);
  },

  // 🔥 bardzo przydatne przy większych modułach
  child(ctx = {}) {
    return base.child(ctx);
  },

  // surowy pino (jak naprawdę potrzeba)
  raw: base,
};
