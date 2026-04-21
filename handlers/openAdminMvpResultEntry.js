const getActiveOrLatestEventId = require('../utils/getActiveOrLatestEventId');
const openAdminMvpResult = require('../handlers/openAdminMvpResult');

module.exports = async function openAdminMvpResultEntry(interaction) {
  const eventId = await getActiveOrLatestEventId(interaction.guildId);

  if (!eventId) {
    return interaction.reply({
      content: '❌ Nie udało się ustalić aktywnego eventu dla MVP.',
      ephemeral: true
    });
  }

  return openAdminMvpResult(interaction, eventId);
};