const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const { withGuild } = require('../../utils/guildContext');
const { getOpenEventId } = require('../../utils/getOpenEventId');

module.exports = async function openMvpCandidatesModalEntry(interaction) {
  await withGuild(interaction, async ({ pool, guildId }) => {
    const eventId = await getOpenEventId(pool, guildId);

    if (!eventId) {
      return interaction.reply({
        content: '❌ Nie znaleziono aktywnego eventu.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`mvp_admin_candidates_modal:${eventId}`)
      .setTitle('Ustaw kandydatów MVP');

    const candidatesInput = new TextInputBuilder()
      .setCustomId('mvp_candidates_input')
      .setLabel('Każda linia: nickname|team')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('donk|Spirit\nm0NESY|G2\nZywOo|Vitality')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(candidatesInput)
    );

    return interaction.showModal(modal);
  });
};