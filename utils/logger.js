// utils/logger.js
//
// Jeden, spójny logger dla całego bota.
// - Bazuje na pino (../logger.js)
// - Zachowuje "stary" interfejs: logger.info(scope, message, data)
//   żeby nie trzeba było przerabiać wszystkich handlerów.

const base = require('../logger');

function normalizeData(data) {
  if (!data) return undefined;
  if (data instanceof Error) {
    return { err: { message: data.message, stack: data.stack, name: data.name } };
  }
  return data;
}

function log(level, scope, message, data) {
  const extra = normalizeData(data);
  // pino: logger.info(obj, msg)
  if (extra) return base[level]({ scope, ...extra }, message);
  return base[level]({ scope }, message);
}

module.exports = {
  // zgodne z dotychczasowym użyciem w plikach typu:
  // logger.info('interaction', '... ', { a: 1 })
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
    // debug tylko jeśli pino ma level debug
    log('debug', scope, message, data);
  },

  // opcjonalnie: dostęp do surowego pino (np. logger.raw.child(...))
  raw: base,
};
