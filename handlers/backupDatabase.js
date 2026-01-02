const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');
const { getGuildConfig, getGuildPaths, ensureGuildDirs } = require('../utils/guildRegistry');
const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

module.exports = async function backupDatabase(interaction) {
  const guildId = interaction.guildId;
  
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  return withGuild(guildId, async () => {
    try {
      // Powiadomienie przed rozpoczęciem
      await interaction.reply({
        content: '💽 **Tworzę kopię zapasową...** Trzymaj kciuki, żeby nie wybuchło! 💥',
        ephemeral: true
      });

      const cfg = getGuildConfig(guildId);
      if (!cfg) {
        return interaction.editReply({
          content: '❌ Brak konfiguracji dla tego serwera.',
        });
      }

      // ✅ Użyj guild-specific backup directory
      ensureGuildDirs(guildId);
      const { backupDir } = getGuildPaths(guildId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup_${timestamp}.sql`;
      const filePath = path.join(backupDir, fileName);

      // ✅ Użyj guild-specific database credentials
      await mysqldump({
        connection: {
          host: cfg.DB_HOST,
          port: parseInt(cfg.DB_PORT) || 3306,
          user: cfg.DB_USER,
          password: cfg.DB_PASS,
          database: cfg.DB_NAME,
        },
        dumpToFile: filePath,
      });

      logger.info('backup', 'Backup created', { guildId, fileName, filePath });

      // Po zakończeniu
      await interaction.editReply({
        content: `✅ Backup zakończony! Plik zapisany jako \`${fileName}\`\n📦 Twoje dane są teraz zabezpieczone jak w skarbcu FBI 🔐`,
      });

    } catch (error) {
      logger.error('backup', 'Backup failed', {
        guildId,
        message: error.message,
        stack: error.stack,
      });
      try {
        await interaction.editReply({
          content: '❌ Coś poszło nie tak przy backupie... Może Gremliny w kablach? 🐭💥',
        });
      } catch (err2) {
        console.error('❌ Błąd przy edytowaniu wiadomości (interakcja już wygasła)');
      }
    }
  });
};
