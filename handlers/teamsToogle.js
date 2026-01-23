// handlers/teamsToggle.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { toggleTeamActive } = require('../utils/teamsStore');
const openTeamsManager = require('./openTeamsManager');
const { PermissionFlagsBits } = require('discord.js');

module.exports = async function teamsToggle(interaction) {
  try {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ Tylko administracja.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    const st = teamsState.getState(guildId, userId);
    const teamId = Number(st?.selectedTeamId);

    if (!Number.isFinite(teamId) || teamId <= 0) {
      return interaction.reply({
        content: '⚠️ Najpierw wybierz **jedną** drużynę z listy.',
        ephemeral: true
      });
    }

    await toggleTeamActive(guildId, teamId);

    // 🔁 Po zmianie statusu czyścimy zaznaczenie (bezpiecznik)
    teamsState.setState(guildId, userId, {
      ...st,
      selectedTeamIds: [],
      selectedTeamId: null
    });

    return openTeamsManager(interaction);

  } catch (err) {
    logger.error('teams', 'teamsToggle failed', {
      message: err.message,
      stack: err.stack,
      guildId: interaction.guildId,
      userId: interaction.user?.id
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: '❌ Nie udało się zmienić statusu drużyny.',
        ephemeral: true
      });
    }
  }
};
