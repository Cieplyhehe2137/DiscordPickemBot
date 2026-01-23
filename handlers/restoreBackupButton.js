// handlers/restoreBackupButton.js
const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { getGuildPaths, ensureGuildDirs } = require('../utils/guildRegistry');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getBackupFiles(guildId) {
  ensureGuildDirs(guildId);
  const { backupDir } = getGuildPaths(guildId);

  if (!fs.existsSync(backupDir)) return [];

  return fs.readdirSync(backupDir)
    .filter(f =>
      /^[\w.-]+\.(sql|json)$/.test(f) // ✅ whitelist nazw
    )
    .sort()
    .reverse();
}

module.exports = async (interaction) => {
  if (interaction.customId !== 'restore_backup') return;

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '⛔ Tylko administrator może przywracać backup.',
      ephemeral: true
    });
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }
    return interaction.editReply({
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).'
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const files = getBackupFiles(guildId);

  if (files.length === 0) {
    return interaction.editReply({
      content: '❌ Brak dostępnych backupów dla tego serwera.'
    });
  }

  const visible = files.slice(0, 25);
  const more = files.length - visible.length;

  const select = new StringSelectMenuBuilder()
    .setCustomId('restore_backup_select')
    .setPlaceholder('Wybierz backup do przywrócenia')
    .addOptions(
      visible.map(f => ({
        label: f,
        value: f
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  return interaction.editReply({
    content:
      '📦 **Wybierz backup do przywrócenia**' +
      (more > 0 ? `\n⚠️ Pokazano 25 z ${files.length} backupów.` : ''),
    components: [row]
  });
};
