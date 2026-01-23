// handlers/calculateScoresButton.js
const calculateScores = require('./calculateScores');
const { withGuild } = require('../utils/guildContext');

module.exports = async function calculateScoresButton(interaction, client) {
  const guildId = interaction.guildId;

  if (!guildId) {
    throw new Error('calculateScoresButton called without guildId');
  }

  await withGuild(guildId, async () => {
    await calculateScores(guildId);
  });

  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({
      content: '✅ Punkty zostały przeliczone',
      ephemeral: true,
    });
  }
};
