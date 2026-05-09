const { withGuild } = require('../utils/guildContext');
const {
  calculatePopularityForPanel
} = require('../utils/calculatePopularityForPanel');

const {
  buildPopularityEmbed
} = require('../utils/popularityEmbed');

module.exports = async function showPopularityStats(interaction) {
  await interaction.deferReply({
    ephemeral: false
  });

  const phase =
    interaction.options?.getString?.('phase') ||
    'swiss';

  const stage =
    interaction.options?.getString?.('stage') ||
    null;

  await withGuild(interaction, async ({ pool, guildId }) => {
    const stats = await calculatePopularityForPanel({
      pool,
      guildId,
      phase,
      stage,
      onlyActive: false
    });

    const embed = buildPopularityEmbed({
      title: `📊 Popularność typów — ${stage || phase}`,
      stats
    });

    await interaction.editReply({
      embeds: [embed]
    });
  });
};