const logger = require('./logger');

const RETRYABLE_ERRORS = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'EPIPE',
]);

const DEFAULT_RETRIES = 1;
const RETRY_DELAY_MS = 200;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeQuery(pool, sql, params = [], meta = {}, retries = DEFAULT_RETRIES) {
  const guildId = meta.guildId || null;
  const scope = meta.scope || 'db';
  const label = meta.label || 'query';

  if (!pool || typeof pool.query !== 'function') {
    const err = new Error('DB pool is not available');
    logger.error(scope, 'Invalid DB pool', { guildId, label });
    throw err;
  }

  try {
    return await pool.query(sql, params);
  } catch (err) {
    const code = err.code || err.errno || 'UNKNOWN';

    logger.warn(scope, 'DB query failed', {
      guildId,
      label,
      code,
      message: err.message,
      retriesLeft: retries,
    });

    if (retries > 0 && RETRYABLE_ERRORS.has(code)) {
      await sleep(RETRY_DELAY_MS);

      const result = await safeQuery(
        pool,
        sql,
        params,
        meta,
        retries - 1
      );

      logger.info(scope, 'DB query succeeded after retry', {
        guildId,
        label,
        remainingRetries: retries - 1,
      });

      return result;
    }

    logger.error(scope, 'DB query permanently failed', {
      guildId,
      label,
      code,
      message: err.message,
      stack: err.stack,
    });

    throw err;
  }
}

module.exports = { safeQuery };
