const { checkDatabaseSize } = require('./utils/checkDatabaseSize');
const { startMatchLockWatcher } = require('./handlers/matchLockWatcher');
const { startDeadlineReminder } = require('./handlers/deadlineReminder');

module.exports = async function onReady(client) {
  console.log('🔐 DB_PASSWORD:', process.env.DB_PASS ? '✅ załadowane' : '❌ brak');
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  require('./utils/sendArchivePanel')(client);
  startMatchLockWatcher();

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.members.fetch();

  await checkDatabaseSize();


  startDeadlineReminder(client);
  startMatchLockWatcher(client);

  require('./utils/startPresence')(client);
  require('./utils/startExportPanel')(client);
};
