// handlers/teamsPageNav.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const openTeamsManager = require('./openTeamsManager');

module.exports = async function teamsPageNav(interaction) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const customId = interaction.customId;

    const st = teamsState.getState(guildId, userId);
    const page = Number(st.page) || 0;

    if (customId === 'teams:page_prev') st.page = Math.max(0, page - 1);
    if (customId === 'teams:page_next') st.page = page + 1;

    // czyścimy wybór przy zmianie strony (żeby nie usunąć “przypadkiem”)
    st.selectedTeamIds = [];
    st.selectedTeamId = null;

    teamsState.setState(guildId, userId, st);
    return openTeamsManager(interaction);
  } catch (err) {
    logger.error('teams', 'teamsPageNav failed', { message: err.message, stack: err.stack });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Nie udało się zmienić strony.', ephemeral: true });
    }
  }
};
