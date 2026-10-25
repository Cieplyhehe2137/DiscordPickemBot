const { logInfo, logWarn, logError } = require("../../utils/logger");
const { getLockBeforeSec } = require("../../utils/matchLock");
const { withGuild } = require("../../utils/guildContext");
const {
  disableMatchComponents,
} = require("../../utils/disableMatchComponents");
const { maybePostMatchStats } = require("./maybePostMatchStats");

const _startedWatchers = new Set();

function startMatchLockWatcher(client, guildId) {
  if (!guildId) {
    logError("matches", "startMatchLockWatcher called without guildId");
    return;
  }

  guildId = String(guildId);

  if (_startedWatchers.has(guildId)) return;
  _startedWatchers.add(guildId);

  const intervalMs = Math.max(
    10_000,
    Number(process.env.MATCH_LOCK_CHECK_MS || 30_000),
  );

  let running = false;
  let consecutiveDbFails = 0;

  const scheduleNext = (ms) => setTimeout(() => void tick(), ms);

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      await withGuild(guildId, async ({ pool }) => {
        const lockBeforeSec = getLockBeforeSec();

        const timeCond =
          lockBeforeSec > 0
            ? `start_time_utc <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)`
            : `start_time_utc <= UTC_TIMESTAMP()`;

        const params = lockBeforeSec > 0 ? [guildId, lockBeforeSec] : [guildId];

        // 1️⃣ Kandydaci do locka (guild-safe)
        const [rows] = await pool.query(
          `
          SELECT id, panel_channel_id, panel_message_id
          FROM matches
          WHERE guild_id = ?
            AND is_locked = 0
            AND lock_override IS NULL
            AND start_time_utc IS NOT NULL
            AND ${timeCond}
          ORDER BY start_time_utc ASC
          LIMIT 50
          `,
          params,
        );

        if (!rows.length) return;

        for (const m of rows) {
          // 2️⃣ Race-safe lock
          const [res] = await pool.query(
            `
            UPDATE matches
            SET is_locked = 1
            WHERE id = ?
              AND guild_id = ?
              AND is_locked = 0
              AND lock_override is NULL
            `,
            [m.id, guildId],
          );

          if (!res.affectedRows) continue;

          logInfo("matches", "Auto-locked match", {
            guildId,
            matchId: m.id,
            lockBeforeSec,
          });

          /*
           * 2️⃣½ ROZKŁAD TYPÓW NA KANAŁ.
           *
           * Moment jest tu nieprzypadkowy: typy właśnie się zamknęły, więc
           * rozkład jest ostateczny i jego pokazanie nie może już nikogo
           * skłonić do zmiany typu. Przed blokadą ta sama wiadomość byłaby
           * zaproszeniem do kopiowania większości.
           *
           * Funkcja sama decyduje, czy mecz zasługuje na wiadomość (próg pola
           * i próg jednomyślności) i sama pilnuje, żeby nie wysłać dwa razy -
           * stąd wołamy ją bezwarunkowo przy każdym zablokowanym meczu.
           *
           * Stoi PRZED blokadą UI, bo tamta wymaga panel_message_id,
           * a do wysłania wiadomości wystarczy sam kanał.
           */
          if (m.panel_channel_id) {
            try {
              const wynik = await maybePostMatchStats({
                client,
                pool,
                guildId,
                channelId: m.panel_channel_id,
                matchId: m.id,
                statsType: "match_start",
              });

              if (wynik?.posted) {
                logInfo("matches", "Posted community stats on lock", {
                  guildId,
                  matchId: m.id,
                  channelId: m.panel_channel_id,
                });
              }
            } catch (err) {
              // Wiadomość ze statystykami jest dodatkiem. Jej błąd nie może
              // przerwać pętli, w której blokują się kolejne mecze.
              logWarn("matches", "Failed to post community stats", {
                guildId,
                matchId: m.id,
                message: err.message,
              });
            }
          }

          // 3️⃣ UI lock
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

            await disableMatchComponents(msg);

            logInfo("matches", "Disabled match panel components", {
              guildId,
              matchId: m.id,
              channelId: m.panel_channel_id,
              messageId: m.panel_message_id,
            });
          } catch (err) {
            logWarn("matches", "Failed to disable match panel UI", {
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
        intervalMs * 2 ** Math.min(consecutiveDbFails, 5),
        5 * 60_000,
      );

      logWarn("matches", "matchLockWatcher failed", {
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
