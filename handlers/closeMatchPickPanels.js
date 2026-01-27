const pool = require('../db');
const { disableMatchComponents } = require('../utils/disableMatchComponents');

let running = false;

async function closeMatchPickPanels(client) {
  if (running) return;
  running = true;

  try {
    const [rows] = await pool.query(`
      SELECT id, guild_id, channel_id, message_id
      FROM active_panels
      WHERE match_deadline IS NOT NULL
        AND UTC_TIMESTAMP() >= match_deadline
    `);

    if (!rows.length) return;

    for (const panel of rows) {
      console.log('[MATCH WATCHER] closing panel', panel.id);

      const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
      if (!channel) continue;

      const message = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (!message) continue;

      await disableMatchComponents(message);

      await pool.query(
        `UPDATE active_panels SET match_deadline = NULL WHERE id = ?`,
        [panel.id]
      );
    }
  } catch (err) {
    console.error('[MATCH WATCHER] ERROR', err);
  } finally {
    running = false;
  }
}

module.exports = { closeMatchPickPanels };
