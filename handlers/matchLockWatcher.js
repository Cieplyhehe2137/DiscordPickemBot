const logger = require('../utils/logger');
const { getLockBeforeSec } = require('../utils/matchLock');
const { disableAllComponents } = require('../utils/disableAllComponents');
const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');

const _startedWatchers = new Set();

function startMatchLockWatcher(client, guildId) {
  if (!guildId) {
    logger.error('matches', 'startMatchLockWatcher called without guildId');
    return;
  }

  guildId = String(guildId);

  if (_startedWatchers.has(guildId)) return;
  _startedWatchers.add(guildId);

  const intervalMs = Math.max(
    10_000,
    Number(process.env.MATCH_LOCK_CHECK_MS || 30_000)
  );

  let running = false;
  let consecutiveDbFails = 0;

  const scheduleNext = (ms) => setTimeout(() => void tick(), ms);

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      await withGuild(guildId, async (pool) => {
        const lockBeforeSec = getLockBeforeSec();

        const timeCond =
          lockBeforeSec > 0
            ? `start_time_utc <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)`
            : `start_time_utc <= UTC_TIMESTAMP()`;

        const params = lockBeforeSec > 0 ? [lockBeforeSec] : [];

        // 1) kandydaci do locka
        const [rows] = await safeQuery(
          pool,
          `SELECT id, panel_channel_id, panel_message_id
           FROM matches
           WHERE is_locked = 0
             AND start_time_utc IS NOT NULL
             AND ${timeCond}
           ORDER BY start_time_utc ASC
           LIMIT 50`,
          params,
          {
            guildId,
            scope: 'cron:matchLockWatcher',
            label: 'select lock candidates',
          }
        );

        if (!rows.length) return;

        for (const m of rows) {
          // 2) race-safe lock
          const [res] = await safeQuery(
            pool,
            `UPDATE matches
             SET is_locked = 1
             WHERE id = ? AND is_locked = 0`,
            [m.id],
            {
              guildId,
              scope: 'cron:matchLockWatcher',
              label: 'lock match',
            }
          );

          if (!res.affectedRows) continue;

          logger.info('matches', 'Auto-locked match', {
            guildId,
            matchId: m.id,
            lockBeforeSec,
          });

          // 3) UI lock
          if (!m.panel_channel_id || !m.panel_message_id) continue;

          try {
            const channel = await client.channels
              .fetch(m.panel_channel_id)
              .catch(() => null);
            if (!channel || !channel.messages) continue;

            const msg = await channel.messages
              .fetch(m.panel_message_id)
              .catch(() => null);
            if (!msg) continue;

            const newComponents = disableAllComponents(msg);
            await msg.edit({ components: newComponents });

            logger.info('matches', 'Disabled match panel components', {
              guildId,
              matchId: m.id,
              channelId: m.panel_channel_id,
              messageId: m.panel_message_id,
            });
          } catch (err) {
            logger.warn('matches', 'Failed to disable match panel UI', {
              guildId,
              matchId: m.id,
              channelId: m.panel_channel_id,
              messageId: m.panel_message_id,
              message: err.message,
            });
          }
        }
      });

      consecutiveDbFails = 0;
      scheduleNext(intervalMs);
    } catch (err) {
      consecutiveDbFails += 1;

      const backoff = Math.min(
        intervalMs * (2 ** Math.min(consecutiveDbFails, 5)),
        5 * 60_000
      );

      logger.warn('matches', 'matchLockWatcher failed', {
        guildId,
        message: err.message,
        consecutiveDbFails,
        nextRetryMs: backoff,
      });

      scheduleNext(backoff);
    } finally {
      running = false;
    }
  };

  scheduleNext(500 + Math.floor(Math.random() * 750));
}

module.exports = { startMatchLockWatcher };
