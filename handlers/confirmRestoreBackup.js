// handlers/confirmRestoreBackup.js
const path = require('path');
const restoreBackup = require('../utils/restoreBackup');

module.exports = async (interaction) => {
  if (!interaction.isButton()) return;

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

  const backupPath = path.join(__dirname, '..', 'backup', fileName);

  // od razu “ACK” na button
  await interaction.update({
    content: `♻️ Przywracanie backupu:\n📦 \`${fileName}\``,
    components: []
  });

  try {
    await restoreBackup(backupPath);

    // edit tego samego message (ephemeral też się da update’ować)
    await interaction.editReply({
      content: `✅ Backup **${fileName}** został przywrócony.`,
      components: []
    });
  } catch (err) {
    await interaction.editReply({
      content: `❌ Błąd restore:\n\`\`\`${err.message}\`\`\``,
      components: []
    });
  }
};
