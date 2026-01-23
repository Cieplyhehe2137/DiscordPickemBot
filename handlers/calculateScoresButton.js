const calculateScores = require('./calculateScores');
const { withGuild } = require('../utils/guildContext');

module.exports = async function calculateScoresButton(interaction) {
  return withGuild(interaction, async ({ guildId }) => {
    await interaction.deferReply({ ephemeral: true });
    await calculateScores(guildId);
    await interaction.editReply('✅ Punkty przeliczone.');
  });
};
