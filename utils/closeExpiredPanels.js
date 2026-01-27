const { getAllGuildIds } = require('./guildRegistry');
const { withGuild } = require('./guildContext');
const { disablePickemComponents } = require('../utils/disablePickemComponents');
const { disableMatchComponents } = require('../utils/disableMatchComponents');

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
        // 1️⃣ DEADLINE DRUŻYN (PICK'EM)
        // =========================
        const [pickemPanels] = await pool.query(`
          SELECT *
          FROM active_panels
          WHERE active = 1
            AND deadline IS NOT NULL
            AND UTC_TIMESTAMP() >= deadline
        `);

        for (const panel of pickemPanels) {
          const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
          if (!channel) continue;

          const message = await channel.messages.fetch(panel.message_id).catch(() => null);
          if (!message) continue;

          // 🔒 zamykamy TYLKO picki drużyn
          await disablePickemComponents(message);
        }

        // =========================
        // 2️⃣ DEADLINE MECZÓW (RESULTS)
        // =========================
        const [matchPanels] = await pool.query(`
          SELECT *
          FROM active_panels
          WHERE active = 1
            AND match_deadline IS NOT NULL
            AND UTC_TIMESTAMP() >= match_deadline
        `);

        for (const panel of matchPanels) {
          const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
          if (!channel) continue;

          const message = await channel.messages.fetch(panel.message_id).catch(() => null);
          if (!message) continue;

          // 🔒 zamykamy TYLKO match / results
          await disableMatchComponents(message);
        }
      });
    }
  } catch (err) {
    console.error('[PANEL WATCHER] ERROR', err);
  } finally {
    _running = false;
  }
}

module.exports = { closeExpiredPanels };
