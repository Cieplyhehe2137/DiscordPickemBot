// utils/swissRepository.js
//
// Data access for swiss_results. Extracted from handlers/swiss/ where two
// near-identical copies existed - openSwissResultsDropdown.js's version
// (correctly scoped by event_id) and submitSwissResultsDropdown.js's own
// copy (missing the event_id filter, so it could merge with a stale
// swiss_results row left over from a previous event using the same stage
// name). This is the event_id-scoped version; both call sites now use it.

function parseList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String);

  const s = String(input).trim();
  if (!s) return [];

  try {
    const j = JSON.parse(s);
    if (Array.isArray(j)) return j.map(String);
  } catch (_) { }

  return s
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

async function getCurrentSwissResults(pool, guildId, eventId, stage) {
  const [rows] = await pool.query(
    `
    SELECT correct_3_0, correct_0_3, correct_advancing
    FROM swiss_results
    WHERE guild_id = ?
      AND event_id = ?
      AND stage = ?
      AND active = 1
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId, eventId, stage]
  );

  if (!rows.length) {
    return { x3_0: [], x0_3: [], adv: [] };
  }

  return {
    x3_0: parseList(rows[0].correct_3_0),
    x0_3: parseList(rows[0].correct_0_3),
    adv: parseList(rows[0].correct_advancing)
  };
}

module.exports = { getCurrentSwissResults, parseList };
