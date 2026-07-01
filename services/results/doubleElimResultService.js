// services/results/doubleElimResultService.js

async function loadDoubleElimTeams(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId]
  );

  return rows.map(r => ({ name: r.name })).filter(t => t.name);
}

module.exports = { loadDoubleElimTeams };
