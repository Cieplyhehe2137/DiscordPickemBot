// handlers/teamsExport.js
const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { getTeamNames } = require('../utils/teamsStore');

module.exports = async function teamsExport(interaction) {
  try {
    const guildId = interaction.guildId;

    // tylko serwer
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    // tylko admin
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const names = await getTeamNames(guildId, { includeInactive: false });

    if (!names.length) {
      return interaction.editReply({
        content: '⚠️ Brak aktywnych drużyn do eksportu.'
      });
    }

    const json = JSON.stringify(names, null, 2);
    const fileName = `teams_${guildId}_${new Date().toISOString().slice(0, 10)}.json`;

    const file = new AttachmentBuilder(
      Buffer.from(json, 'utf8'),
      { name: fileName }
    );

    return interaction.editReply({
      content: `📤 Wyeksportowano **${names.length}** aktywnych drużyn.`,
      files: [file]
    });
  } catch (err) {
    logger.error('teams', 'teamsExport failed', {
      message: err.message,
      stack: err.stack
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: '❌ Nie udało się wyeksportować drużyn.'
      });
    }

    return interaction.reply({
      content: '❌ Nie udało się wyeksportować drużyn.',
      ephemeral: true
    });
  }
};
