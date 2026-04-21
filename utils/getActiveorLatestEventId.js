const { withGuild } = require('./guildContext');

module.exports = async function getActiveOrLatestEventId(guildId) {
  if (!guildId) return null;

  return withGuild({ guildId }, async ({ pool, guildId }) => {
    try {
      const [rows] = await pool.query(
        `
          SELECT id
          FROM events
          WHERE guild_id = ?
            AND (archived = 0 OR archived IS NULL)
          ORDER BY id DESC
          LIMIT 1
        `,
        [guildId]
      );

      if (rows.length) return rows[0].id;
    } catch (_) {
      // fallback niżej
    }

    try {
      const [rows2] = await pool.query(
        `
          SELECT id
          FROM events
          WHERE guild_id = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        [guildId]
      );

      if (rows2.length) return rows2[0].id;
    } catch (_) {
      // fallback niżej
    }

    const [rows3] = await pool.query(
      `
        SELECT id
        FROM events
        ORDER BY id DESC
        LIMIT 1
      `
    );

    return rows3[0]?.id ?? null;
  });
};