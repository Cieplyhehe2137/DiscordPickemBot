const pool = require('../db');
const logger = require('../utils/logger');
const { getLockBeforeSec } = require('../utils/matchLock');

function startMatchLockWatcher() {
    const intervalMs = Math.max(10_000, Number(process.env.MATCH_LOCK_CHECK_MS || 30_000));


    setInterval(async () => {
        try {
            const lockBeforeSec = getLockBeforeSec();

            const whereTime = lockBeforeSec > 0
                ? 'start_time_utc <= DATE_ADD(UTC_TIMESTAMP(), INTEVAL ? SECOND'
                : 'start_time_utc <= UTC_TIMESTAMP()';

            const params = lockBeforeSec > 0 ? [lockBeforeSec] : [];

            const [res] = await pool.query(
                `UPDATE matches
                SET is_locked = 1
                WHERE is_locked = 0
                  AND start_time_utc IS NOT NULL
                  AND ${whereTime}`,
                params
            );

            const affected = Number(res?.affectedRows || 0);
            if (affected > 0) {
                logger.info('matches', 'Auto-locked matches by start_time_utc', { affected, lockBeforeSec });
            }
        } catch (err) {
            logger.error('matches', 'matchLockerWatcher failed', { message: err.message, stack: err.stack });
        }
    }, intervalMs);
}

module.exports = { startMatchLockWatcher }