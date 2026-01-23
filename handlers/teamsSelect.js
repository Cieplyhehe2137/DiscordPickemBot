// handlers/teamsSelect.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const openTeamsManager = require('./openTeamsManager');

module.exports = async function teamsSelect(interaction) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    const values = Array.isArray(interaction.values) ? interaction.values : [];
    const st = teamsState.getState(guildId, userId) || {
      page: 0,
      selectedTeamIds: [],
      selectedTeamId: null
    };

    // ===============================
    // CLEAR SELECTION (minValues=0)
    // ===============================
    if (!values.length || values.includes('none')) {
      teamsState.setState(guildId, userId, {
        ...st,
        selectedTeamIds: [],
        selectedTeamId: null
      });

      return openTeamsManager(interaction);
    }

    // ===============================
    // NORMAL SELECTION
    // ===============================
    const ids = values
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n > 0);

    const uniq = Array.from(new Set(ids));

    teamsState.setState(guildId, userId, {
      ...st,
      selectedTeamIds: uniq,
      selectedTeamId: uniq[0] || null // legacy compatibility
    });

    return openTeamsManager(interaction);

  } catch (err) {
    logger.error('teams', 'teamsSelect failed', {
      message: err.message,
      stack: err.stack,
      guildId: interaction.guildId,
      userId: interaction.user?.id
    });

    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({
        content: '❌ Nie udało się wybrać drużyn.',
        ephemeral: true
      });
    }
  }
};
