// handlers/teamsExport.js
const { PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { getTeamNames } = require('../utils/teamsStore');

module.exports = async function teamsExport(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });

    const names = await getTeamNames(guildId, { includeInactive: false });
    const json = JSON.stringify(names, null, 2);

    const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), {
      name: `teams_${guildId}.json`
    });

    return interaction.editReply({
      content: `📤 Export drużyn: **${names.length}** (aktywne).`,
      files: [file]
    });
  } catch (err) {
    logger.error('teams', 'teamsExport failed', { message: err.message, stack: err.stack });
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: '❌ Nie udało się wyeksportować drużyn.' });
    }
    return interaction.reply({ content: '❌ Nie udało się wyeksportować drużyn.', ephemeral: true });
  }
};
