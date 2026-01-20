const db = require('../db');

module.exports = async function loadTeamsFromDB(guildId) {
  const pool = db.getPoolForGuild(guildId);
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
};
