const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const adminState = require('../utils/matchAdminState');

module.exports = async function matchAdminExactOpen(interaction) {
    const ctx = adminState.get(interaction.user.id);
    if (!ctx) {
        return interaction.reply({ content: '❌ Brak wybranego meczu. Wybierz najpierw mecz z listy.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId('match_admin_exact_submit')
        .setTitle(`Dokładny wynik ${ctx.teamA} vs ${ctx.teamB}`);

    const aInput = new TextInputBuilder()
        .setCustomId('exact_a')
        .setLabel(`Wynik ${ctx.teamA} (np. 13)`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const bInput = new TextInputBuilder()
        .setCustomId('exact_b')
        .setLabel(`Wynik ${ctx.teamB} (np. 8)`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(aInput),
        new ActionRowBuilder().addComponents(bInput)
    );

    return interaction.showModal(modal);
}