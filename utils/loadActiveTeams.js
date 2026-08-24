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
    [guildId],
  );

  return rows.map((r) => r.name);
}

// Same as loadActiveTeams but ordered by sort_order first - used by the
// admin "enter official results" dropdowns, where team order in the
// select menu should follow the configured bracket/seed order rather
// than alphabetical.
async function loadActiveTeamsBySortOrder(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId],
  );

  return rows.map((r) => r.name).filter(Boolean);
}

module.exports = { loadActiveTeams, loadActiveTeamsBySortOrder };
