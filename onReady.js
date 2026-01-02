const { checkDatabaseSize } = require('./utils/checkDatabaseSize');
const { startMatchLockWatcher } = require('./handlers/matchLockWatcher');
const { startDeadlineReminder } = require('./handlers/deadlineReminder');
const { getAllGuildIds, getGuildConfig } = require('./utils/guildRegistry');
const { withGuild } = require('./utils/guildContext');

const sendArchivePanel = require('./utils/sendArchivePanel');
const startExportPanel = require('./utils/startExportPanel');

module.exports = async function onReady(client) {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  // globalne rzeczy odpalamy raz
  require('./utils/startPresence')(client);

  const guildIds = getAllGuildIds();
  if (!guildIds.length) {
    console.warn('⚠️ Brak skonfigurowanych guildów w config/*.env');
    return;
  }

  for (const guildId of guildIds) {
    // guard: jeśli ktoś doda bota na serwer bez env -> pomijamy
    if (!getGuildConfig(guildId)) {
      console.warn(`⚠️ Pomijam guild ${guildId} – brak konfiguracji`);
      continue;
    }

    // upewnij się, że bot jest na serwerze
    const guild =
      client.guilds.cache.get(guildId) ||
      (await client.guilds.fetch(guildId).catch(() => null));

    if (!guild) {
      console.warn(`⚠️ Pomijam guild ${guildId} – bot nie jest na tym serwerze / brak dostępu`);
      continue;
    }

    await withGuild(guildId, async () => {
      try {
        // jeśli naprawdę potrzebujesz cache członków, zrób to per guild (UWAGA: ciężkie na dużych serwerach)
        // await guild.members.fetch().catch(() => null);

        await sendArchivePanel(client, guildId);
        await startExportPanel(client, guildId);

        startDeadlineReminder(client, guildId);
        startMatchLockWatcher(client, guildId);

        // to poleci na DB właściwe dla tego guildId (bo jesteśmy w withGuild)
        await checkDatabaseSize();
      } catch (err) {
        console.error(`❌ onReady error for guild ${guildId}:`, err);
      }
    });
  }
};
