const { getAllGuildIds } = require('../utils/guildRegistry');
const { withGuild } = require('../utils/guildContext');
const { disableMatchComponents } = require('./disableMatchComponents');

let _runningGlobal = false;
const _runningByGuild = new Set();

async function closeMatchPickPanelsForGuild(client, guildId) {
  guildId = String(guildId);

  if (_runningByGuild.has(guildId)) return;
  _runningByGuild.add(guildId);

  console.log('[MATCH WATCHER] tick guild:', guildId);

  try {
    await withGuild(guildId, async ({ pool }) => {

      const [rows] = await pool.query(
        `
        SELECT id, channel_id, message_id, match_deadline
        FROM active_panels
        WHERE guild_id = ?
          AND active = 0
          AND match_deadline IS NOT NULL
          AND UTC_TIMESTAMP() >= match_deadline
        `,
        [guildId]
      );

      console.log('[MATCH WATCHER] rows:', rows);

      if (!rows.length) return;

      for (const panel of rows) {
        console.log(
          '[MATCH WATCHER] closing panel:',
          panel.id,
          'msg:',
          panel.message_id,
          'channel:',
          panel.channel_id
        );

        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) {
          console.log('[MATCH WATCHER] channel not found');
          continue;
        }

        const message = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!message) {
          console.log('[MATCH WATCHER] message not found');
          continue;
        }

        console.log(
          '[MATCH WATCHER] message components:',
          message.components.map(row =>
            row.components.map(c => ({
              type: c.type,
              customId: c.customId || c.data?.custom_id
            }))
          )
        );

        await disableMatchComponents(message);

        await pool.query(
          `UPDATE active_panels
           SET match_deadline = NULL
           WHERE id = ?`,
          [panel.id]
        );

        console.log('[MATCH WATCHER] panel closed:', panel.id);
      }
    });
  } catch (err) {
    console.error('[MATCH WATCHER] ERROR', err);
  } finally {
    _runningByGuild.delete(guildId);
  }
}

async function closeMatchPickPanels(client) {
  if (_runningGlobal) return;
  _runningGlobal = true;

  try {
    for (const guildId of getAllGuildIds()) {
      await closeMatchPickPanelsForGuild(client, guildId);
    }
  } finally {
    _runningGlobal = false;
  }
}

module.exports = { closeMatchPickPanels };
