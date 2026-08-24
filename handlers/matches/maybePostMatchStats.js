const {
  calculateMatchPopularity,
} = require("../../utils/calculateMatchPopularity");
const {
  buildMatchPopularityEmbed,
} = require("../../utils/matchPopularityEmbed");
const {
  wasStatsPosted,
  markStatsPosted,
} = require("../../utils/communityStatsPosts");

async function maybePostMatchStats({
  client,
  pool,
  guildId,
  channelId,
  matchId,
  statsType = "match_start",
}) {
  if (!client) throw new Error("client is required");
  if (!pool) throw new Error("pool is required");
  if (!guildId) throw new Error("guildId is required");
  if (!channelId) throw new Error("channelId is required");
  if (!matchId) throw new Error("matchId is required");

  const alreadyPosted = await wasStatsPosted(pool, guildId, matchId, statsType);

  if (alreadyPosted) {
    return {
      posted: false,
      reason: "already_posted",
    };
  }

  const stats = await calculateMatchPopularity({
    pool,
    guildId,
    matchId,
  });

  if (!stats.totalUsers) {
    return {
      posted: false,
      reason: "no_predictions",
    };
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return {
      posted: false,
      reason: "channel_not_found",
    };
  }

  const embed = buildMatchPopularityEmbed(stats);

  await channel.send({
    embeds: [embed],
  });

  await markStatsPosted(pool, guildId, matchId, statsType);

  return {
    posted: true,
  };
}

module.exports = {
  maybePostMatchStats,
};
