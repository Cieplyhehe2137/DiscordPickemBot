// handlers/teamsRenameSubmit.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
const teamsState = require('../utils/teamsState');
const { renameTeam } = require('../utils/teamsStore');

module.exports = async function teamsRenameSubmit(interaction) {
    try {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const st = teamsState.get(guildId, userId);
        if (!st?.selectedTeamId) {
            return interaction.reply({ content: '⚠️ Najpierw wybierz drużynę z listy.', ephemeral: true });
        }

        const newName = interaction.fields.getTextInputValue('team_name')?.trim();
        const newShort = interaction.fields.getTextInputValue('team_short')?.trim() || null;

        await interaction.deferReply({ ephemeral: true });
        await renameTeam(guildId, st.selectedTeamId, newName, newShort);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel:open:teams')
                .setLabel('👥 Otwórz manager drużyn')
                .setStyle(ButtonStyle.Secondary)
        );

        return interaction.editReply({ content: `✅ Zmieniono nazwę na **${newName}**`, components: [row] });
    } catch (err) {
        logger.error('teams', 'teamsRenameSubmit failed', { message: err.message, stack: err.stack });
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply('❌ Nie udało się zmienić nazwy drużyny.');
        }
        return interaction.reply({ content: '❌ Nie udało się zmienić nazwy drużyny.', ephemeral: true });
    }
};
