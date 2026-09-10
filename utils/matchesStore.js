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

// Czy mecz ma już wpisany oficjalny wynik serii.
//
// Panel WWW blokuje typowanie takiego meczu (ui_status = 'FINAL' + 403),
// a Discord sprawdzał wyłącznie isMatchLocked(). Mecz z wynikiem, ale bez
// start_time_utc i z lock_override = 0, przyjmował więc typy już po ogłoszeniu
// rezultatu. Ta funkcja wyrównuje obie strony.
async function hasOfficialResult(pool, guildId, eventId, matchId) {
  const [[row]] = await pool.query(
    `
    SELECT 1 AS istnieje
    FROM match_results
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    LIMIT 1
    `,
    [guildId, eventId, matchId],
  );

  return Boolean(row);
}

module.exports = { getMatchById, setMatchLock, hasOfficialResult };
