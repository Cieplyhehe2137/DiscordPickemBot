const { checkDatabaseSize } = require('./utils/checkDatabaseSize');

module.exports = async function onReady(client) {
  console.log('🔐 DB_PASSWORD:', process.env.DB_PASS ? '✅ załadowane' : '❌ brak');
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  require('./utils/sendArchivePanel')(client);

  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  await guild.members.fetch();

  await checkDatabaseSize();

  const { startDeadlineReminder } = require('./handlers/deadlineReminder');
  startDeadlineReminder(client);

  require('./utils/startPresence')(client);
  require('./startExportPanel')(client);
};
