// onReady.js
const logger = require('./utils/logger');
const { getAllGuildIds, ensureGuildDirs } = require('./utils/guildRegistry');
const { withGuild } = require('./utils/guildContext');

const sendArchivePanel = require('./utils/sendArchivePanel');
const startExportPanel = require('./utils/startExportPanel');

const { startMatchLockWatcher } = require('./handlers/matchLockWatcher');
const { startDeadlineReminder } = require('./handlers/deadlineReminder');


module.exports = async function onReady(client) {
  const guildIds = getAllGuildIds();

  logger.info('ready', 'Booting multi-guild', { guildCount: guildIds.length, guildIds });

  for (const guildId of guildIds) {
    try {
      ensureGuildDirs(guildId);

      await withGuild(guildId, async () => {
        await sendArchivePanel(client, guildId);
        await startExportPanel(client, guildId);

        startDeadlineReminder(client, guildId);
        startMatchLockWatcher(client, guildId);
      });

      logger.info('ready', 'Guild boot OK', { guildId });
    } catch (err) {
      logger.error('ready', 'Guild boot FAILED', {
        guildId,
        message: err?.message,
        stack: err?.stack,
      });
    }
  }

  logger.info('ready', `✅ Logged in as ${client.user.tag}`);
};
