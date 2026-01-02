// handlers/restoreBackupButton.js
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { getGuildPaths, ensureGuildDirs } = require('../utils/guildRegistry');
const { withGuild } = require('../utils/guildContext');

function getBackupFiles(guildId) {
  // ✅ Użyj guild-specific backup directory
  ensureGuildDirs(guildId);
  const { backupDir } = getGuildPaths(guildId);

  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.sql') || f.endsWith('.json'))
    .sort()
    .reverse();
}

module.exports = async (interaction) => {
  if (interaction.customId !== 'restore_backup') return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  return withGuild(guildId, async () => {
    const files = getBackupFiles(guildId);

    if (files.length === 0) {
      return interaction.reply({
        content: '❌ Brak dostępnych backupów dla tego serwera.',
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
      components: [row],
      ephemeral: true
    });
  });
};
