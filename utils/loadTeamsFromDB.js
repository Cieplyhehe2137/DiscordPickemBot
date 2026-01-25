// utils/loadTeamsFromDB.js
const { withGuild } = require('./guildContext');

module.exports = async function loadTeamsFromDB(source) {
  return withGuild(source, async ({ guildId, pool }) => {
    const [rows] = await pool.query(
      `
      SELECT name
      FROM teams
      WHERE guild_id = ?
        AND active = 1
      ORDER BY name ASC
      `,
      [guildId]
    );

    return rows.map(r => r.name);
  });
};
