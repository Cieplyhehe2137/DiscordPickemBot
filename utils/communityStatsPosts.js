const { logError } = require("./logger");

async function wasStatsPosted(pool, guildId, matchId, statsType) {
  try {
    const [rows] = await pool.query(
      `
      SELECT id
      FROM community_stats_posts
      WHERE guild_id = ?
        AND match_id = ?
        AND stats_type = ?
      LIMIT 1
      `,
      [guildId, matchId, statsType],
    );

    return !!rows?.length;
  } catch (err) {
    logError("stats", "wasStatsPosted failed", {
      guildId,
      matchId,
      statsType,
      message: err.message,
    });

    return false;
  }
}

async function markStatsPosted(pool, guildId, matchId, statsType) {
  try {
    await pool.query(
      `
      INSERT IGNORE INTO community_stats_posts
        (guild_id, match_id, stats_type)
      VALUES (?, ?, ?)
      `,
      [guildId, matchId, statsType],
    );
  } catch (err) {
    logError("stats", "markStatsPosted failed", {
      guildId,
      matchId,
      statsType,
      message: err.message,
    });
  }
}

module.exports = {
  wasStatsPosted,
  markStatsPosted,
};
