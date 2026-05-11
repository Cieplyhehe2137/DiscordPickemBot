const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');
const {
  getGuildConfig,
  getGuildPaths,
  ensureGuildDirs
} = require('../utils/guildRegistry');
const { withGuild } = require('../utils/guildContext');
const { logInfo, logWarn, logError } = require('../utils/logger');

module.exports = async function backupDatabase(interaction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  return withGuild(guildId, async () => {
    try {
      await interaction.editReply({
        content: '💽 **Tworzę backup danych tego serwera...**'
      });

      const cfg = getGuildConfig(guildId);
      if (!cfg) {
        return interaction.editReply({
          content: '❌ Brak konfiguracji bazy danych dla tego serwera.'
        });
      }

      ensureGuildDirs(guildId);
      const { backupDir } = getGuildPaths(guildId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup_${guildId}_${timestamp}.sql`;
      const filePath = path.join(backupDir, fileName);

      // 🔒 LISTA TABEL Z guild_id
      const tablesWithGuild = [
        'active_panels',
        'matches',

        'swiss_predictions',
        'playoffs_predictions',
        'doubleelim_predictions',
        'playin_predictions',

        'swiss_results',
        'playoffs_results',
        'doubleelim_results',
        'playin_results',

        'swiss_scores',
        'playoffs_scores',
        'doubleelim_scores',
        'playin_scores'
      ];

      // 🔑 where per tabela
      const where = {};
      for (const table of tablesWithGuild) {
        where[table] = `guild_id = '${guildId}'`;
      }

      await mysqldump({
        connection: {
          host: cfg.DB_HOST,
          port: Number(cfg.DB_PORT) || 3306,
          user: cfg.DB_USER,
          password: cfg.DB_PASS,
          database: cfg.DB_NAME,
        },
        dump: {
          tables: tablesWithGuild,
          where,
        },
        dumpToFile: filePath,
      });

      logInfo('backup', 'Guild backup created', {
        guildId,
        fileName,
        filePath
      });

      await interaction.editReply({
        content:
          `✅ Backup ukończony!\n` +
          `📦 Zapisano tylko dane **tego serwera**.\n` +
          `🗂️ Plik: \`${fileName}\``
      });

    } catch (error) {
      logError('backup', 'Backup failed', {
        guildId,
        message: error.message,
        stack: error.stack,
      });

      await interaction.editReply({
        content: '❌ Backup nie powiódł się. Sprawdź logi.'
      });
    }
  });
};
