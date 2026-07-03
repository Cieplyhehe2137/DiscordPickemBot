// utils/playinRepository.js
//
// Data access for playin_results. Discord's submit handler
// (handlers/playin/submitPlayinResultsDropdown.js) never needed to read
// the current active row - the admin picks all 8 teams in one sitting via
// the draft cache before confirming. The web panel needs a "current
// results" read to display already-saved state, same as
// utils/swissRepository.js / utils/playoffsRepository.js /
// utils/doubleelimRepository.js.

function toArr(s) {
  return !s ? [] : String(s).split(',').map(v => v.trim()).filter(Boolean);
}

async function getCurrentPlayinResults(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `SELECT correct_teams
     FROM playin_results
     WHERE guild_id = ?
       AND event_id = ?
       AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [guildId, eventId]
  );

  if (!rows.length) {
    return { teams: [] };
  }

  return { teams: toArr(rows[0].correct_teams) };
}

module.exports = { getCurrentPlayinResults };
