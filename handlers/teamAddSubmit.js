// handlers/teamsAddSubmit.js
const logger = require('../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addTeam } = require('../utils/teamsStore');

module.exports = async function teamsAddSubmit(interaction) {
    try {
        const guildId = interaction.guildId;
        const name = interaction.fields.getTextInputValue('team_name')?.trim();
        const short = interaction.fields.getTextInputValue('team_short')?.trim() || null;

        await interaction.deferReply({ ephemeral: true });
        await addTeam(guildId, name, short);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel:open:teams')
                .setLabel('👥 Otwórz manager drużyn')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({
            content: `✅ Dodano drużynę: **${name}**`,
            components: [row]
        });

        return;
    } catch (err) {
        logger.error('teams', 'teamsAddSubmit failed', { message: err.message, stack: err.stack });
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply('❌ Nie udało się dodać drużyny.');
        }
        return interaction.reply({ content: '❌ Nie udało się dodać drużyny.', ephemeral: true });
    }
};
