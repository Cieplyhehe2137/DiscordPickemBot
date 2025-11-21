const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = async function openHLTVEventModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId("hltv_event_modal")
        .setTitle("Ustaw ID turnieju HLTV");

    const input = new TextInputBuilder()
        .setCustomId("hltv_event_id")
        .setLabel("Podaj HLTV Event ID (np. 7741)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);

    modal.addComponents(row);

    await interaction.showModal(modal);
};
