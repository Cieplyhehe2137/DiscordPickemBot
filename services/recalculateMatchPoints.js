const { computeSeriesPoints, computeMapPoints } = require('../utils/matchScoring');

module.exports = async function recalculateMatchPoints(pool, guildId, eventId, matchId, bestOf) {
  const [[seriesResult]] = await pool.query(
    `
    SELECT res_a, res_b, exact_a, exact_b
    FROM match_results
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    LIMIT 1
    `,
    [guildId, eventId, matchId]
  );

  const [seriesPredictions] = await pool.query(
    `
    SELECT user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
    FROM match_predictions
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    `,
    [guildId, eventId, matchId]
  );

  const pointsByUser = new Map();

  for (const p of seriesPredictions) {
    const seriesPoints = computeSeriesPoints({
      predA: p.pred_a,
      predB: p.pred_b,
      resA: seriesResult?.res_a ?? null,
      resB: seriesResult?.res_b ?? null
    });

    let total = seriesPoints;

    if (Number(bestOf) === 1) {
      total += computeMapPoints({
        predExactA: p.pred_exact_a,
        predExactB: p.pred_exact_b,
        exactA: seriesResult?.exact_a ?? null,
        exactB: seriesResult?.exact_b ?? null
      });
    }

    pointsByUser.set(p.user_id, total);
  }

  if (Number(bestOf) !== 1) {
    const [mapResults] = await pool.query(
      `
      SELECT map_no, exact_a, exact_b
      FROM match_map_results
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
      `,
      [guildId, eventId, matchId]
    );

    const resultByMap = new Map(
      mapResults.map(r => [Number(r.map_no), r])
    );

    const [mapPredictions] = await pool.query(
      `
      SELECT user_id, map_no, pred_exact_a, pred_exact_b
      FROM match_map_predictions
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
      `,
      [guildId, eventId, matchId]
    );

    for (const p of mapPredictions) {
      const result = resultByMap.get(Number(p.map_no));

      const mapPoints = computeMapPoints({
        predExactA: p.pred_exact_a,
        predExactB: p.pred_exact_b,
        exactA: result?.exact_a ?? null,
        exactB: result?.exact_b ?? null
      });

      pointsByUser.set(
        p.user_id,
        (pointsByUser.get(p.user_id) || 0) + mapPoints
      );
    }
  }

  await pool.query(
    `
    DELETE FROM match_points
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    `,
    [guildId, eventId, matchId]
  );

  if (!pointsByUser.size) return;

  const values = [...pointsByUser.entries()].map(([userId, points]) => [
    guildId,
    eventId,
    matchId,
    userId,
    points
  ]);

  await pool.query(
    `
    INSERT INTO match_points
      (guild_id, event_id, match_id, user_id, points)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      points = VALUES(points),
      computed_at = CURRENT_TIMESTAMP
    `,
    [values]
  );
};