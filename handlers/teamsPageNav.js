// handlers/teamsPageNav.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const openTeamsManager = require('./openTeamsManager');

module.exports = async function teamsPageNav(interaction) {
    try {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const id = interaction.customId;

        const st = teamsState.get(guildId, userId) || { page: 0, selectedTeamId: null };
        if (id === 'teams:page_prev') st.page = Math.max(0, (Number(st.page) || 0) - 1);
        if (id === 'teams:page_next') st.page = (Number(st.page) || 0) + 1;
        teamsState.set(guildId, userId, st);

        return openTeamsManager(interaction);
    } catch (err) {
        logger.error('teams', 'teamsPageNav failed', { message: err.message, stack: err.stack });
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ Nie udało się zmienić strony.', ephemeral: true });
        }
    }
};
