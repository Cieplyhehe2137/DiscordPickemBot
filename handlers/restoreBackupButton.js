// handlers/restoreBackupButton.js
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

function getBackupFiles() {
  const backupDir = path.join(__dirname, '..', 'backup');

  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql') || f.endsWith('.json'))
    .sort()
    .reverse();
}

module.exports = async (interaction) => {
  if (interaction.customId !== 'restore_backup') return;

  const files = getBackupFiles();

  if (files.length === 0) {
    return interaction.reply({
      content: '❌ Brak dostępnych backupów.',
      ephemeral: true
    });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('restore_backup_select')
    .setPlaceholder('Wybierz backup do przywrócenia')
    .addOptions(
      files.slice(0, 25).map(f => ({
        label: f,
        value: f
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply({
    content: '📦 Wybierz backup do przywrócenia:',
    components: [row],   // ⬅️ TU JEST KLUCZ
    ephemeral: true
  });
};
