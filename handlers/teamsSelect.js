// handlers/teamsSelect.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const openTeamsManager = require('./openTeamsManager');

module.exports = async function teamsSelect(interaction) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const values = Array.isArray(interaction.values) ? interaction.values : [];

    const st = teamsState.getState(guildId, userId) || { page: 0, selectedTeamIds: [] };

    // allow clear (minValues=0)
    if (!values.length || values.includes('none')) {
      st.selectedTeamIds = [];
      st.selectedTeamId = null; // legacy
      teamsState.setState(guildId, userId, st);
      return openTeamsManager(interaction);
    }

    const ids = values
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n > 0);

    st.selectedTeamIds = [...new Set(ids)];
    st.selectedTeamId = st.selectedTeamIds[0] || null; // legacy compat

    teamsState.setState(guildId, userId, st);
    return openTeamsManager(interaction);
  } catch (err) {
    logger.error('teams', 'teamsSelect failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się wybrać drużyn.', ephemeral: true });
    }
  }
};
