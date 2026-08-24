// utils/mvpRepository.js

async function getActiveMvpCandidates(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT id, nickname, team_name
    FROM mvp_candidates
    WHERE guild_id = ?
      AND is_active = 1
    ORDER BY nickname ASC
    `,
    [guildId],
  );

  return rows;
}

module.exports = { getActiveMvpCandidates };
