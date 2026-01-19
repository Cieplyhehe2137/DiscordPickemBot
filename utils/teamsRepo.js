// utils/teamsRepo.js
const db = require('../db');

async function getActiveTeams(guildId) {
  const pool = db.getPoolForGuild(guildId);

  const [rows] = await pool.query(
    `SELECT name, short_name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY sort_order ASC, name ASC`,
    [guildId]
  );

  return rows.map(r => ({
    name: r.name,
    short: r.short_name || r.name,
  }));
}

module.exports = { getActiveTeams };
