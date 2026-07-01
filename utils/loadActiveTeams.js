// utils/loadActiveTeams.js

async function loadActiveTeams(pool, guildId) {
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
}

module.exports = { loadActiveTeams };
