// handlers/matchLockWatcher.js
const db = require('../db');
const logger = require('../utils/logger');
const { getLockBeforeSec } = require('../utils/matchLock');
const { disableAllComponents } = require('../utils/disableAllComponents');
const { withGuild } = require('../utils/guildContext');

/* ======================================================
   🔒 BEZPIECZNE ZAPYTANIA SQL (retry + backoff dla transientów)
   ====================================================== */
const TRANSIENT_DB_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'PROTOCOL_ENQUEUE_AFTER_QUIT',
  'ER_SERVER_SHUTDOWN',
  'ER_CON_COUNT_ERROR',
  'ER_TOO_MANY_USER_CONNECTIONS',
]);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function safeQuery(pool, sql, params = [], opts = {}) {
  const guildId = opts.guildId ? String(opts.guildId) : undefined;
  const label = opts.label ? String(opts.label) : undefined;

  const maxAttempts = Math.max(1, Number(opts.maxAttempts || 3));
  const baseDelayMs = Math.max(200, Number(opts.baseDelayMs || 500));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      const code = err?.code;
      const transient = code && TRANSIENT_DB_CODES.has(code);

      if (!transient || attempt === maxAttempts) {
        throw err;
      }

      const jitter = Math.floor(Math.random() * 200);
      const delay = baseDelayMs * (2 ** (attempt - 1)) + jitter;

      logger.warn('matches', 'MySQL chwilowo niedostępny (retry)', {
        guildId,
        code,
        label,
        attempt,
        maxAttempts,
        nextRetryMs: delay,
        message: err.message,
      });

      await sleep(delay);
    }
  }
}

/* ====================================================== */

const _startedWatchers = new Set();

function startMatchLockWatcher(client, guildId) {
  if (!guildId) {
    logger.error('matches', 'startMatchLockWatcher called without guildId');
    return;
  }

  guildId = String(guildId);

  // bezpieczeństwo: nie uruchamiaj drugi raz tego samego watchera
  if (_startedWatchers.has(guildId)) return;
  _startedWatchers.add(guildId);

  const intervalMs = Math.max(10_000, Number(process.env.MATCH_LOCK_CHECK_MS || 30_000));

  let running = false;
  let consecutiveDbFails = 0;

  const scheduleNext = (ms) => setTimeout(() => void tick(), ms);

  const tick = async () => {
    if (running) return; // anti-overlap
    running = true;

    try {
      await withGuild(guildId, async () => {
        const pool = db.getPoolForGuild(guildId);
        const lockBeforeSec = getLockBeforeSec();

        const timeCond = lockBeforeSec > 0
          ? `start_time_utc <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)`
          : `start_time_utc <= UTC_TIMESTAMP()`;

        const params = lockBeforeSec > 0 ? [lockBeforeSec] : [];

        // 1) weź kandydatów do locka (żeby znać message_id)
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
          { guildId, label: 'select_candidates' }
        );

        if (!rows.length) return;

        for (const m of rows) {
          // 2) spróbuj ustawić is_locked=1 (race-safe)
          const [res] = await safeQuery(
            pool,
            `UPDATE matches
             SET is_locked = 1
             WHERE id = ? AND is_locked = 0`,
            [m.id],
            { guildId, label: 'lock_match' }
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
            const channel = await client.channels.fetch(m.panel_channel_id).catch(() => null);
            if (!channel || !channel.messages) continue;

            const msg = await channel.messages.fetch(m.panel_message_id).catch(() => null);
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

      // sukces
      consecutiveDbFails = 0;
      scheduleNext(intervalMs);
    } catch (err) {
      const code = err?.code;
      const transient = code && TRANSIENT_DB_CODES.has(code);
      consecutiveDbFails += 1;

      const backoff = transient
        ? Math.min(intervalMs * (2 ** Math.min(consecutiveDbFails, 5)), 5 * 60_000)
        : intervalMs;

      if (transient) {
        logger.warn('matches', 'matchLockWatcher db unavailable', {
          guildId,
          code,
          message: err.message,
          consecutiveDbFails,
          nextRetryMs: backoff,
        });
      } else {
        logger.error('matches', 'matchLockWatcher failed', {
          guildId,
          message: err.message,
          stack: err.stack,
        });
      }

      scheduleNext(backoff);
    } finally {
      running = false;
    }
  };

  // start z małym jitterem, żeby nie odpalać wszystkich watcherów równocześnie po restarcie
  scheduleNext(500 + Math.floor(Math.random() * 750));
}

module.exports = { startMatchLockWatcher };
