const { getAllGuildIds } = require('./guildRegistry');
const { withGuild } = require('./guildContext');
const { disablePickemComponents } = require('../utils/disablePickemComponents');

let _running = false;

async function closeExpiredPanels(client) {
  if (_running) return;
  _running = true;

  try {
    const guildIds = getAllGuildIds();

    for (const guildId of guildIds) {
      if (!guildId) continue;

      await withGuild(guildId, async ({ pool }) => {
        const [rows] = await pool.query(`
          SELECT *
          FROM active_panels
          WHERE active = 1
            AND deadline IS NOT NULL
            AND UTC_TIMESTAMP() >= deadline
        `);

        for (const panel of rows) {
          const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
          if (!channel) continue;

          const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
          if (!msg) continue;

          await disablePickemComponents(msg);

          await pool.query(
            `UPDATE active_panels SET active = 0 WHERE id = ?`,
            [panel.id]
          );
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
