const {
  computeSeriesPoints,
  computeMapPoints
} = require('../utils/matchScoring');

module.exports = async function recalculateMatchPoints(
  pool,
  guildId,
  eventId,
  matchId,
  bestOf
) {
  const [[seriesResult]] = await pool.query(
    `
    SELECT
      res_a,
      res_b,
      exact_a,
      exact_b
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
    SELECT
      user_id,
      pred_a,
      pred_b,
      pred_exact_a,
      pred_exact_b
    FROM match_predictions
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    `,
    [guildId, eventId, matchId]
  );

  /*
   * Punkty trzymamy osobno:
   *
   * user_id -> punkty za serię
   * user_id -> suma punktów za mapy
   */
  const seriesPointsByUser = new Map();
  const mapPointsByUser = new Map();

  /* =========================
     SERIES
  ========================= */

  for (const prediction of seriesPredictions) {
    const seriesPoints = computeSeriesPoints({
      predA: prediction.pred_a,
      predB: prediction.pred_b,
      resA: seriesResult?.res_a ?? null,
      resB: seriesResult?.res_b ?? null
    });

    seriesPointsByUser.set(
      prediction.user_id,
      seriesPoints
    );

    /*
     * BO1 przechowuje dokładny wynik mapy
     * bezpośrednio w match_predictions /
     * match_results.
     */
    if (Number(bestOf) === 1) {
      const mapPoints = computeMapPoints({
        predExactA: prediction.pred_exact_a,
        predExactB: prediction.pred_exact_b,
        exactA: seriesResult?.exact_a ?? null,
        exactB: seriesResult?.exact_b ?? null
      });

      mapPointsByUser.set(
        prediction.user_id,
        mapPoints
      );
    }
  }

  /* =========================
     BO3 / BO5 MAPS
  ========================= */

  if (Number(bestOf) !== 1) {
    const [mapResults] = await pool.query(
      `
      SELECT
        map_no,
        exact_a,
        exact_b
      FROM match_map_results
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
      `,
      [guildId, eventId, matchId]
    );

    const resultByMap = new Map(
      mapResults.map((result) => [
        Number(result.map_no),
        result
      ])
    );

    const [mapPredictions] = await pool.query(
      `
      SELECT
        user_id,
        map_no,
        pred_exact_a,
        pred_exact_b
      FROM match_map_predictions
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
      `,
      [guildId, eventId, matchId]
    );

    for (const prediction of mapPredictions) {
      const result = resultByMap.get(
        Number(prediction.map_no)
      );

      const mapPoints = computeMapPoints({
        predExactA: prediction.pred_exact_a,
        predExactB: prediction.pred_exact_b,
        exactA: result?.exact_a ?? null,
        exactB: result?.exact_b ?? null
      });

      mapPointsByUser.set(
        prediction.user_id,
        (mapPointsByUser.get(prediction.user_id) || 0) +
          mapPoints
      );
    }
  }

  /* =========================
     CLEAR OLD POINTS
  ========================= */

  await pool.query(
    `
    DELETE FROM match_points
    WHERE guild_id = ?
      AND event_id = ?
      AND match_id = ?
    `,
    [guildId, eventId, matchId]
  );

  /* =========================
     BUILD ROWS
  ========================= */

  const values = [];

  for (const [userId, points] of seriesPointsByUser.entries()) {
    values.push([
      guildId,
      eventId,
      matchId,
      userId,
      points,
      'series'
    ]);
  }

  for (const [userId, points] of mapPointsByUser.entries()) {
    values.push([
      guildId,
      eventId,
      matchId,
      userId,
      points,
      'map'
    ]);
  }

  if (!values.length) return;

  /* =========================
     SAVE
  ========================= */

  await pool.query(
    `
    INSERT INTO match_points
      (
        guild_id,
        event_id,
        match_id,
        user_id,
        points,
        source
      )
    VALUES ?
    ON DUPLICATE KEY UPDATE
      points = VALUES(points),
      computed_at = CURRENT_TIMESTAMP
    `,
    [values]
  );
};