const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getActiveOrLatestEventId } = require('../utils/getActiveOrLatestEventId');

module.exports = async function openMvpCandidatesModalEntry(interaction, { pool }) {
  const eventId = await getActiveOrLatestEventId(pool);

  if (!eventId) {
    return interaction.reply({
      content: '❌ Nie znaleziono aktywnego ani ostatniego eventu.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`mvp:candidates:modal:${eventId}`)
    .setTitle('Ustaw kandydatów MVP');

  const candidatesInput = new TextInputBuilder()
    .setCustomId('mvp_candidates')
    .setLabel('Kandydaci MVP')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('np. ZywOo, m0NESY, donk')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(candidatesInput));

  return interaction.showModal(modal);
};