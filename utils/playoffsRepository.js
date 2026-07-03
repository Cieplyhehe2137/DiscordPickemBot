// utils/playoffsRepository.js
//
// Data access for playoffs_results. Extracted from
// handlers/playoffs/submitPlayoffsResultsDropdown.js so the web admin
// panel (server/index.js) can reuse the exact same "current results" read
// instead of duplicating it, matching the pattern already used for Swiss
// (utils/swissRepository.js).

function toArr(s) {
  return !s ? [] : String(s).split(',').map(v => v.trim()).filter(Boolean);
}

async function getCurrentPlayoffs(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `SELECT correct_semifinalists,
            correct_finalists,
            correct_winner,
            correct_third_place_winner
     FROM playoffs_results
     WHERE guild_id = ?
       AND event_id = ?
       AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [guildId, eventId]
  );

  if (!rows.length) {
    return { semifinalists: [], finalists: [], winner: [], third: [] };
  }

  const r = rows[0];
  return {
    semifinalists: toArr(r.correct_semifinalists),
    finalists: toArr(r.correct_finalists),
    winner: toArr(r.correct_winner),
    third: toArr(r.correct_third_place_winner),
  };
}

module.exports = { getCurrentPlayoffs };
