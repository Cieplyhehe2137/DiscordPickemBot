const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

module.exports =
  async function autoStartChannelSelect(interaction) {

    const [
      ,
      ,
      eventId,
      phase
    ] = interaction.customId.split(':');

    const channelId =
      String(
        interaction.values?.[0] || ''
      );

    if (
      !Number(eventId) ||
      !phase ||
      !channelId
    ) {
      return interaction.reply({
        content:
          '❌ Niepoprawne dane auto-startu.',
        ephemeral: true
      });
    }

    const modal =
      new ModalBuilder()
        .setCustomId(
          `auto_start:schedule_modal:${eventId}:${phase}:${channelId}`
        )
        .setTitle(
          'Zaplanuj start Pick’Em'
        )
        .addComponents(
          new ActionRowBuilder()
            .addComponents(
              new TextInputBuilder()
                .setCustomId(
                  'start_at'
                )
                .setLabel(
                  'Data i godzina — czas PL'
                )
                .setPlaceholder(
                  '2026-08-15 18:00'
                )
                .setStyle(
                  TextInputStyle.Short
                )
                .setRequired(true)
            )
        );

    return interaction.showModal(modal);
  };