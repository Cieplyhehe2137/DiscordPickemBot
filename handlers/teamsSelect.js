// handlers/teamsSelect.js
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const openTeamsManager = require('./openTeamsManager');

module.exports = async function teamsSelect(interaction) {
    try {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const value = interaction.values?.[0];

        if (!value || value === 'none') {
            return interaction.deferUpdate();
        }

        const st = teamsState.get(guildId, userId) || { page: 0, selectedTeamId: null };
        st.selectedTeamId = Number(value);
        teamsState.set(guildId, userId, st);

        return openTeamsManager(interaction);
    } catch (err) {
        logger.error('teams', 'teamsSelect failed', { message: err.message, stack: err.stack });
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: '❌ Nie udało się wybrać drużyny.', ephemeral: true });
        }
    }
};
