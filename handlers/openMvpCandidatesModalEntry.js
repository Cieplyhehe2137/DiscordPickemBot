const getActiveOrLatestEventId = require('../utils/getActiveOrLatestEventId');
const openMvpCandidatesModal = require('./openMvpCandidatesModal');

module.exports = async function openMvpCandidatesModalEntry(interaction) {
  const eventId = await getActiveOrLatestEventId(interaction.guildId);

  if (!eventId) {
    return interaction.reply({
      content: '❌ Nie udało się ustalić aktywnego eventu dla MVP.',
      ephemeral: true
    });
  }

  return openMvpCandidatesModal(interaction, eventId);
};