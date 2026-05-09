const { logError } = require('./logger');

function bump(map, key) {
  if (!key) return;
  const clean = String(key).trim();
  if (!clean) return;

  map.set(clean, (map.get(clean) || 0) + 1);
}

function toPercentList(counter, total) {
  const out = [];

  counter.forEach((count, label) => {
    out.push({
      label,
      count,
      pct: total ? (count / total) * 100 : 0
    });
  });

  return out.sort(
    (a, b) =>
      b.count - a.count ||
      b.pct - a.pct ||
      String(a.label).localeCompare(String(b.label))
  );
}

async function pickExistingColumn(pool, table, candidates) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  const names = new Set(cols.map(c => c.Field));

  return candidates.find(c => names.has(c)) || null;
}

async function calculateMatchPopularity({
  pool,
  guildId,
  matchId
}) {
  if (!pool) throw new Error('pool is required');
  if (!guildId) throw new Error('guildId is required');
  if (!matchId) throw new Error('matchId is required');

  try {
    const predTable = 'match_predictions';

    const cUserId = await pickExistingColumn(pool, predTable, ['user_id']);
    const cMatchId = await pickExistingColumn(pool, predTable, ['match_id']);
    const cGuildId = await pickExistingColumn(pool, predTable, ['guild_id']);

    const cPredA = await pickExistingColumn(pool, predTable, ['pred_a', 'score_a', 'team_a_score']);
    const cPredB = await pickExistingColumn(pool, predTable, ['pred_b', 'score_b', 'team_b_score']);

    if (!cMatchId || !cUserId) {
      return {
        totalUsers: 0,
        winner: [],
        scores: [],
        match: null
      };
    }

    const [matchRows] = await pool.query(
      `
      SELECT *
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId]
    );

    const match = matchRows?.[0] || null;

    const teamA =
      match?.team_a ||
      match?.team1 ||
      match?.team_a_name ||
      match?.team1_name ||
      match?.a_team ||
      'Team A';

    const teamB =
      match?.team_b ||
      match?.team2 ||
      match?.team_b_name ||
      match?.team2_name ||
      match?.b_team ||
      'Team B';

    const where = [`${cMatchId} = ?`];
    const params = [matchId];

    if (cGuildId) {
      where.push(`${cGuildId} = ?`);
      params.push(guildId);
    }

    const sql = `
      SELECT
        ${cUserId} AS user_id,
        ${cPredA || 'NULL'} AS pred_a,
        ${cPredB || 'NULL'} AS pred_b
      FROM ${predTable}
      WHERE ${where.join(' AND ')}
    `;

    const [rows] = await pool.query(sql, params);

    const users = new Set(rows.map(r => r.user_id));
    const totalUsers = users.size;

    const winnerMap = new Map();
    const scoreMap = new Map();

    for (const row of rows) {
      const a = Number(row.pred_a);
      const b = Number(row.pred_b);

      if (Number.isNaN(a) || Number.isNaN(b)) continue;

      bump(scoreMap, `${a}:${b}`);

      if (a > b) {
        bump(winnerMap, teamA);
      } else if (b > a) {
        bump(winnerMap, teamB);
      } else {
        bump(winnerMap, 'Remis');
      }
    }

    return {
      totalUsers,
      match: {
        id: matchId,
        teamA,
        teamB,
        raw: match
      },
      winner: toPercentList(winnerMap, totalUsers),
      scores: toPercentList(scoreMap, totalUsers)
    };
  } catch (err) {
    logError('stats', 'calculateMatchPopularity failed', {
      guildId,
      matchId,
      message: err.message,
      stack: err.stack
    });

    return {
      totalUsers: 0,
      match: null,
      winner: [],
      scores: []
    };
  }
}

module.exports = {
  calculateMatchPopularity
};