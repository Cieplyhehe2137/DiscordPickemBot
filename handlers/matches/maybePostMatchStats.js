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
const FIELD = require("../../rules/field");

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

  /*
   * PROG: nie kazdy mecz zasluguje na wiadomosc.
   *
   * Major ma 106 meczow. Wrzucenie rozkladu po kazdym z nich to 106 wiadomosci
   * na kanale typowania - i to jest najprawdopodobniej powod, dla ktorego ta
   * funkcja stala napisana i nigdy nie podlaczona.
   *
   * Zostawiamy mecze, o ktorych jest o czym gadac, czyli te same, ktore
   * serwis liczy pozniej jako ZAROBIONE: pole musi byc prawdziwe (MIN_VOTERS)
   * i nie moze byc jednomyslne (ponizej OBVIOUS_PCT). Progi ida z
   * rules/field.js, zeby bot i strona nazywaly "oczywisty" tak samo.
   *
   * Ta sama regula, ten sam moment: typy sa juz zamkniete, wiec rozklad jest
   * ostateczny i zgodzi sie z tym, co pozniej pokaze ranking.
   */
  if (stats.totalUsers < FIELD.MIN_VOTERS) {
    return {
      posted: false,
      reason: "below_min_voters",
      totalUsers: stats.totalUsers,
    };
  }

  // winner[] przychodzi posortowane malejaco, wiec faworyt stoi pierwszy.
  const favourite = Number(stats.winner?.[0]?.pct ?? 0);

  if (favourite >= FIELD.OBVIOUS_PCT) {
    return {
      posted: false,
      reason: "obvious",
      favourite,
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
