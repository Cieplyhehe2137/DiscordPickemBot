// handlers/confirmRestoreBackup.js
const path = require('path');
const restoreBackup = require('../../utils/restoreBackup');
const { getGuildPaths, ensureGuildDirs } = require('../../utils/guildRegistry');
const { withGuild } = require('../../utils/guildContext');
const { logInfo, logWarn, logError } = require('../../utils/logger');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  // Cancel
  if (interaction.customId === 'cancel_restore_backup') {
    return interaction.update({
      content: '❎ Anulowano przywracanie backupu.',
      components: []
    });
  }

  // Confirm (prefix)
  if (!interaction.customId.startsWith('confirm_restore_backup:')) return;

  const fileName = interaction.customId.split(':').slice(1).join(':'); // na wypadek ':' w nazwie

  // prosta walidacja nazwy (ochrona przed ../)
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return interaction.update({
      content: '❌ Nieprawidłowa nazwa pliku backupu.',
      components: []
    });
  }

  return withGuild(guildId, async () => {
    // ✅ Użyj guild-specific backup directory
    ensureGuildDirs(guildId);
    const { backupDir } = getGuildPaths(guildId);
    const backupPath = path.join(backupDir, fileName);

    // Dodatkowa walidacja: sprawdź czy plik istnieje w guild-specific katalogu
    if (!require('fs').existsSync(backupPath)) {
      return interaction.reply({
        content: '❌ Plik backupu nie istnieje dla tego serwera.',
        ephemeral: true
      });
    }

    // od razu "ACK" na button
    await interaction.update({
      content: `♻️ Przywracanie backupu:\n📦 \`${fileName}\``,
      components: []
    });

    try {
      // Przekaż guildId jawnie (nawet jeśli restore potrafi go wziąć z kontekstu)
      await restoreBackup(backupPath, { guildId });

      logInfo('restore', 'Backup restored', { guildId, fileName });

      // edit tego samego message (ephemeral też się da update'ować)
      await interaction.editReply({
        content: `✅ Backup **${fileName}** został przywrócony.`,
        components: []
      });
    } catch (err) {
      logError('restore', 'Restore failed', {
        guildId,
        fileName,
        message: err.message,
        stack: err.stack,
      });
      await interaction.editReply({
        content: `❌ Błąd restore:\n\`\`\`${err.message}\`\`\``,
        components: []
      });
    }
  });
};
