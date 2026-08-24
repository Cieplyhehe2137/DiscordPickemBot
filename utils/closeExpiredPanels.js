const { getAllGuildIds } = require("./guildRegistry");
const { withGuild } = require("./guildContext");
const { disablePickemComponents } = require("../utils/disablePickemComponents");
const { disableMatchComponents } = require("../utils/disableMatchComponents");
const { logInfo, logWarn, logError } = require("../utils/logger");

let _running = false;

async function closeExpiredPanels(client) {
  if (_running) return;

  _running = true;

  try {
    const guildIds = getAllGuildIds();

    for (const guildId of guildIds) {
      if (!guildId) continue;

      await withGuild(guildId, async ({ pool }) => {
        // =========================
        // 1️⃣ DEADLINE DRUŻYN PICK'EM
        // =========================
        const [pickemPanels] = await pool.query(
          `
          SELECT *
          FROM active_panels
          WHERE guild_id = ?
            AND active = 1
            AND deadline IS NOT NULL
            AND UTC_TIMESTAMP() >= deadline
          `,
          [guildId],
        );

        for (const panel of pickemPanels) {
          const channel = await client.channels
            .fetch(panel.channel_id)
            .catch(() => null);

          if (!channel) {
            logWarn("deadline", "Pickem panel channel not found", {
              guildId,
              panelId: panel.id,
              channelId: panel.channel_id,
            });
            continue;
          }

          const message = await channel.messages
            .fetch(panel.message_id)
            .catch(() => null);

          if (!message) {
            await pool.query(
              `
              UPDATE active_panels
              SET active = 0,
                  closed = 1,
                  closed_at = NOW()
              WHERE id = ?
              `,
              [panel.id],
            );

            logWarn(
              "deadline",
              "Pickem panel message not found, marked closed",
              {
                guildId,
                panelId: panel.id,
                messageId: panel.message_id,
              },
            );

            continue;
          }

          await disablePickemComponents(message);

          await pool.query(
            `
            UPDATE active_panels
            SET active = 0,
                closed = 1,
                closed_at = NOW()
            WHERE id = ?
            `,
            [panel.id],
          );

          logInfo("deadline", "Pickem panel closed by deadline", {
            guildId,
            panelId: panel.id,
            phase: panel.phase,
            stage: panel.stage,
            stage_key: panel.stage_key,
            channelId: panel.channel_id,
            messageId: panel.message_id,
          });
        }

        // =========================
        // 2️⃣ DEADLINE MECZÓW / RESULTS
        // =========================
        const [matchPanels] = await pool.query(
          `
          SELECT *
          FROM active_panels
          WHERE guild_id = ?
            AND active = 1
            AND match_deadline IS NOT NULL
            AND UTC_TIMESTAMP() >= match_deadline
          `,
          [guildId],
        );

        for (const panel of matchPanels) {
          const channel = await client.channels
            .fetch(panel.channel_id)
            .catch(() => null);

          if (!channel) {
            logWarn("deadline", "Match panel channel not found", {
              guildId,
              panelId: panel.id,
              channelId: panel.channel_id,
            });
            continue;
          }

          const message = await channel.messages
            .fetch(panel.message_id)
            .catch(() => null);

          if (!message) {
            await pool.query(
              `
              UPDATE active_panels
              SET active = 0,
                  closed = 1,
                  closed_at = NOW()
              WHERE id = ?
              `,
              [panel.id],
            );

            logWarn(
              "deadline",
              "Match panel message not found, marked closed",
              {
                guildId,
                panelId: panel.id,
                messageId: panel.message_id,
              },
            );

            continue;
          }

          await disableMatchComponents(message);

          await pool.query(
            `
            UPDATE active_panels
            SET active = 0,
                closed = 1,
                closed_at = NOW()
            WHERE id = ?
            `,
            [panel.id],
          );

          logInfo("deadline", "Match panel closed by deadline", {
            guildId,
            panelId: panel.id,
            phase: panel.phase,
            stage: panel.stage,
            stage_key: panel.stage_key,
            channelId: panel.channel_id,
            messageId: panel.message_id,
          });
        }
      });
    }
  } catch (err) {
    logError("deadline", "closeExpiredPanels failed", {
      message: err.message,
      stack: err.stack,
    });
  } finally {
    _running = false;
  }
}

module.exports = {
  closeExpiredPanels,
};
