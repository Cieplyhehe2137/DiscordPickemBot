const { getAllGuildIds } = require('../utils/guildRegistry');
const { withGuild } = require('../utils/guildContext');
const { disableMatchComponents } = require('../utils/disableMatchComponents');

let _runningGlobal = false;
const _runningByGuild = new Set();

async function closeMatchPickPanelsForGuild(client, guildId) {
  if (!guildId) {
    console.warn('[MATCH WATCHER] skip empty guildId');
    return;
  }

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

      for (const panel of rows) {
        const channel = await client.channels.fetch(panel.channel_id).catch(() => null);
        if (!channel) continue;

        const message = await channel.messages.fetch(panel.message_id).catch(() => null);
        if (!message) continue;

        console.log(
          '[MATCH WATCHER] disabling match components for panel:',
          panel.id
        );

        await disableMatchComponents(message);

        await pool.query(
          `UPDATE active_panels
           SET match_deadline = NULL
           WHERE id = ?`,
          [panel.id]
        );

        console.log('[MATCH WATCHER] match panel closed:', panel.id);
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
    const guildIds = getAllGuildIds();

    for (const guildId of guildIds) {
      await closeMatchPickPanelsForGuild(client, String(guildId));
    }
  } finally {
    _runningGlobal = false;
  }
}

module.exports = closeMatchPickPanels;
