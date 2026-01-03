// handlers/teamsRenameOpen.js
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    PermissionFlagsBits
} = require('discord.js');

const teamsState = require('../utils/teamsState');

module.exports = async function teamsRenameOpen(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '⛔ Tylko administracja.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const st = teamsState.get(guildId, userId);
    if (!st?.selectedTeamId) {
        return interaction.reply({ content: '⚠️ Najpierw wybierz drużynę z listy.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId('teams:rename_modal')
        .setTitle('Zmień nazwę drużyny');

    const nameInput = new TextInputBuilder()
        .setCustomId('team_name')
        .setLabel('Nowa nazwa drużyny')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const shortInput = new TextInputBuilder()
        .setCustomId('team_short')
        .setLabel('Nowy skrót (opcjonalnie)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(30);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(shortInput),
    );

    return interaction.showModal(modal);
};
