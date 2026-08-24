// utils/matchesStore.js
//
// Replaces the ~15 copies of "SELECT <some columns> FROM matches WHERE id = ?
// AND guild_id = ? LIMIT 1" that were scattered across handlers/matches/,
// each selecting a different subset of columns. getMatchById selects the
// whole row - callers destructure whatever fields they need, same as before.

async function getMatchById(pool, guildId, matchId) {
  const [[match]] = await pool.query(
    `
    SELECT *
    FROM matches
    WHERE id = ?
      AND guild_id = ?
    LIMIT 1
    `,
    [matchId, guildId],
  );

  return match || null;
}

async function setMatchLock(pool, guildId, matchId, locked) {
  const [result] = await pool.query(
    `
    UPDATE matches
    SET is_locked = ?
    WHERE id = ?
      AND guild_id = ?
    `,
    [locked ? 1 : 0, matchId, guildId],
  );

  return result.affectedRows > 0;
}

module.exports = { getMatchById, setMatchLock };
