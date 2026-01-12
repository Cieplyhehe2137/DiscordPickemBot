// handlers/teamsToogle.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { toggleTeamActive } = require('../utils/teamsStore');
const openTeamsManager = require('./openTeamsManager');
const { PermissionFlagsBits } = require('discord.js');

module.exports = async function teamsToggle(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const st = teamsState.getState(guildId, userId);

    const teamId = Number(st?.selectedTeamId);
    if (!teamId) {
      return interaction.reply({ content: '⚠️ Najpierw wybierz drużynę z listy.', ephemeral: true });
    }

    await toggleTeamActive(guildId, teamId);
    return openTeamsManager(interaction);
  } catch (err) {
    logger.error('teams', 'teamsToggle failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się zmienić statusu drużyny.', ephemeral: true });
    }
  }
};
