// utils/doubleelimRepository.js
//
// Data access for doubleelim_results. Discord's submit handler
// (handlers/doubleelim/submitDoubleElimResultsDropdown.js) never needed to
// read the current active row - the admin fills all 4 slots in one sitting
// via the draft cache before confirming. The web panel needs a "current
// results" read to display already-saved state, same as
// utils/swissRepository.js / utils/playoffsRepository.js.

function toArr(s) {
  return !s ? [] : String(s).split(',').map(v => v.trim()).filter(Boolean);
}

async function getCurrentDoubleElimResults(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
     FROM doubleelim_results
     WHERE guild_id = ?
       AND event_id = ?
       AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [guildId, eventId]
  );

  if (!rows.length) {
    return { upperFinalA: [], lowerFinalA: [], upperFinalB: [], lowerFinalB: [] };
  }

  const r = rows[0];
  return {
    upperFinalA: toArr(r.upper_final_a),
    lowerFinalA: toArr(r.lower_final_a),
    upperFinalB: toArr(r.upper_final_b),
    lowerFinalB: toArr(r.lower_final_b),
  };
}

module.exports = { getCurrentDoubleElimResults };
