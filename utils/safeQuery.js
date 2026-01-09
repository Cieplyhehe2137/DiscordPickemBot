const logger = require('./logger');

const RETRYABLE_ERRORS = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
    'EPIPE',
]);

async function safeQuery(pool, sql, params = [], meta = {}, retries = 1) {
    const guildId = meta.guildId;
    const scope = meta.scope || 'db';
    const label = meta.label || 'query';

    try {
        return await pool.query(sql, params);
    } catch (err) {
        logger.warn(scope, 'DB query failed', {
            guildId,
            label,
            code: err.code,
            message: err.message,
            retriesLeft: retries,
        });

        if (retries > 0 && RETRYABLE_ERRORS.has(err.code)) {
            return safeQuery(pool, sql, params, meta, retries - 1);
        }

        logger.error(scope, 'DB query permanently failed', {
            guildId,
            label,
            code: err.code,
            message: err.message,
            stack: err.stack,
        });

        throw err;
    }
}

module.exports = { safeQuery }