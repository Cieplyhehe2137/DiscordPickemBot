const { withGuild } = require("../../utils/guildContext");

const { publishPickemPanel } = require("../../utils/pickemPanelPublisher");

const { logInfo, logError } = require("../../utils/logger");

const startedGuilds = new Set();
const runningGuilds = new Set();

function startPickemAutoStartWatcher(client, guildId) {
  const key = String(guildId || "");

  if (!key || startedGuilds.has(key)) {
    return;
  }

  startedGuilds.add(key);

  logInfo("PickEm auto-start watcher started", { guildId });

  const tick = async () => {
    if (runningGuilds.has(key)) {
      return;
    }

    runningGuilds.add(key);

    try {
      await withGuild(guildId, async ({ pool }) => {
        // ==================================================
        // EVENTY GOTOWE DO AUTO-STARTU
        // ==================================================
        //
        // Auto-start może podnieść tylko event:
        //
        // status    = UPCOMING
        // is_open   = 0
        // is_active = 0
        //
        // Sam watcher NIE aktywuje eventu.
        // Robi to publishPickemPanel() dopiero po
        // poprawnym opublikowaniu panelu na Discordzie.
        // ==================================================

        const [rows] = await pool.query(
          `
          SELECT
            id,
            name,
            auto_start_phase,
            auto_start_channel_id,
            auto_start_at
          FROM events
          WHERE guild_id = ?
            AND status = 'UPCOMING'
            AND is_open = 0
            AND is_active = 0
            AND COALESCE(is_archived, 0) = 0
            AND auto_start_at IS NOT NULL
            AND auto_start_phase IS NOT NULL
            AND auto_start_channel_id IS NOT NULL
            AND auto_started_at IS NULL
            AND auto_start_at <= UTC_TIMESTAMP()
          ORDER BY auto_start_at ASC, id ASC
          `,
          [guildId],
        );

        for (const event of rows) {
          try {
            // ================================================
            // PUBLIKACJA + AKTYWACJA EVENTU
            // ================================================
            //
            // publishPickemPanel() jest jedynym miejscem,
            // które przeprowadza:
            //
            // UPCOMING / 0 / 0
            //       ↓
            // OPEN / 1 / 1
            // ================================================

            await publishPickemPanel({
              client,
              pool,
              guildId,
              eventId: Number(event.id),
              phase: event.auto_start_phase,
              channelId: event.auto_start_channel_id,
            });

            // ================================================
            // OZNACZ AUTO-START JAKO WYKONANY
            // ================================================

            const [updateResult] = await pool.query(
              `
              UPDATE events
              SET auto_started_at = UTC_TIMESTAMP()
              WHERE id = ?
                AND guild_id = ?
                AND status = 'OPEN'
                AND is_open = 1
                AND is_active = 1
                AND auto_started_at IS NULL
              `,
              [event.id, guildId],
            );

            if (updateResult.affectedRows !== 1) {
              throw new Error(
                `Event ${event.id} został opublikowany, ale nie udało się oznaczyć auto-startu jako wykonanego.`,
              );
            }

            logInfo("PickEm started automatically", {
              guildId,
              eventId: Number(event.id),
              eventName: event.name,
              phase: event.auto_start_phase,
              channelId: event.auto_start_channel_id,
            });
          } catch (err) {
            logError("PickEm automatic start failed", err, {
              guildId,
              eventId: event.id,
              phase: event.auto_start_phase,
            });
          }
        }
      });
    } catch (err) {
      logError("PickEm auto-start watcher tick failed", err, {
        guildId,
      });
    } finally {
      runningGuilds.delete(key);
    }
  };

  // pierwszy check 3 sekundy po starcie
  setTimeout(tick, 3000);

  // potem co 30 sekund
  setInterval(tick, 30000);
}

module.exports = {
  startPickemAutoStartWatcher,
};
