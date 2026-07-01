const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = async function openSetMatchTimeModal(interaction) {
  const [, matchId] = interaction.customId.split(':');

  if (!matchId) {
    return interaction.reply({
      content: '❌ Brak ID meczu.',
      ephemeral: true
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`match_set_time_modal:${matchId}`)
    .setTitle('Ustaw godzinę meczu')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('match_time')
          .setLabel('Data i godzina (UTC)')
          .setPlaceholder('2026-01-28 18:00')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

  return interaction.showModal(modal);
};
