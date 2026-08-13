const {
  phasesConfig
} = require('../../utils/pickemPanelPublisher');

const {
  buildChannelPage
} = require('./autoStartPhaseSelect');

module.exports = async function autoStartChannelPage(interaction) {
  const parts = interaction.customId.split(':');

  const eventId = Number(parts[2]);
  const phase = String(parts[3] || '');
  const page = Number(parts[4]);

  if (
    !eventId ||
    !phasesConfig[phase] ||
    !Number.isInteger(page)
  ) {
    return interaction.reply({
      content: '❌ Niepoprawne dane paginacji kanałów.',
      ephemeral: true
    });
  }

  await interaction.guild.channels.fetch();

  const payload = buildChannelPage(
    interaction,
    eventId,
    phase,
    page
  );

  return interaction.update(payload);
};