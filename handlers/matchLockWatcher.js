// handlers/matchLockWatcher.js
const pool = require('../db');
const logger = require('../utils/logger');
const { getLockBeforeSec } = require('../utils/matchLock');
const { disableAllComponents } = require('../utils/disableAllComponents');
const { withGuild } = require('../utils/guildContext');

function startMatchLockWatcher(client, guildId) {
  if (!guildId) {
    logger.error('matches', 'startMatchLockWatcher called without guildId');
    return;
  }

  const intervalMs = Math.max(10_000, Number(process.env.MATCH_LOCK_CHECK_MS || 30_000));

  setInterval(async () => {
    try {
      // ✅ Użyj withGuild aby zapewnić właściwy kontekst bazy danych
      await withGuild(guildId, async () => {
        const lockBeforeSec = getLockBeforeSec();

        const timeCond = lockBeforeSec > 0
          ? `start_time_utc <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)`
          : `start_time_utc <= UTC_TIMESTAMP()`;

        const params = lockBeforeSec > 0 ? [lockBeforeSec] : [];

        // 1) weź kandydatów do locka (żeby znać message_id)
        const [rows] = await pool.query(
          `SELECT id, panel_channel_id, panel_message_id
           FROM matches
           WHERE is_locked = 0
             AND start_time_utc IS NOT NULL
             AND ${timeCond}
           ORDER BY start_time_utc ASC
           LIMIT 50`,
          params
        );

        if (!rows.length) return;

        for (const m of rows) {
          // 2) spróbuj ustawić is_locked=1 (race-safe)
          const [res] = await pool.query(
            `UPDATE matches
             SET is_locked = 1
             WHERE id = ? AND is_locked = 0`,
            [m.id]
          );

          if (!res.affectedRows) continue; // ktoś inny już zablokował

          logger.info('matches', 'Auto-locked match', {
            guildId,
            matchId: m.id,
            lockBeforeSec,
          });

          // 3) UI lock: disable komponenty w panelu (jeśli znamy gdzie jest)
          if (!m.panel_channel_id || !m.panel_message_id) continue;

          try {
            const channel = await client.channels.fetch(m.panel_channel_id);
            if (!channel || !channel.messages) continue;

            const msg = await channel.messages.fetch(m.panel_message_id);
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
            // Nie blokuj watchera – tylko zaloguj
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
    } catch (err) {
      logger.error('matches', 'matchLockWatcher failed', {
        guildId,
        message: err.message,
        stack: err.stack,
      });
    }
  }, intervalMs);
}

module.exports = { startMatchLockWatcher };
