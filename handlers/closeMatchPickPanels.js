const { withGuild } = require('../utils/guildContext');
const { disableMatchComponents } = require('../utils/disableMatchComponents');

async function closeMatchPickPanelsForGuild(client, guildId) {
  await withGuild(guildId, async ({ pool }) => {

    const [rows] = await pool.query(
      `
      SELECT id, channel_id, message_id
      FROM active_panels
      WHERE match_deadline IS NOT NULL
        AND UTC_TIMESTAMP() >= match_deadline
      `
    );

    for (const panel of rows) {
      const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
      if (!channel) continue;

      const msg = await channel.messages.fetch(panel.message_id).catch(() => null);
      if (!msg) continue;

      // 🔒 WYŁĄCZAMY TYLKO MATCH BUTTONY
      await disableMatchComponents(msg);

      // czyścimy deadline, żeby watcher nie strzelał drugi raz
      await pool.query(
        `UPDATE active_panels SET match_deadline = NULL WHERE id = ?`,
        [panel.id]
      );
    }
  });
}

module.exports = { closeMatchPickPanelsForGuild };
