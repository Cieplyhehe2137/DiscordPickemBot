const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const {
  computeSeriesPoints,
  computeMapPoints
} = require('../utils/matchScoring');

// =========================
// HELPERY
// =========================
const cleanList = (val) => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) { }

  return String(val)
    .replace(/[\[\]"]+/g, '')
    .split(/[;,]+/)
    .map(t => t.trim())
    .filter(Boolean);
};

module.exports = async function calculateScores(guildId) {
  if (!guildId) {
    throw new Error('calculateScores called without guildId');
  }

  logger.info('scores', 'Score calculation started', { guildId });

  await withGuild({ guildId }, async ({ pool, guildId }) => {
    console.log('=== SCORE RUN START ===', guildId);


    /* =========================
       SWISS
    ========================= */
    try {
      const [rows] = await pool.query(`
        SELECT *
        FROM swiss_results
        WHERE guild_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
      `, [guildId]);

      if (!rows.length) {
        logger.warn('scores', 'No data, skipping phase', { guildId });
      }

      for (const correct of rows) {

        const stage = correct.stage;

        const correct30 = cleanList(correct.correct_3_0);
        const correct03 = cleanList(correct.correct_0_3);
        const correctAdv = cleanList(correct.correct_advancing);

        const [preds] = await pool.query(
          `SELECT * FROM swiss_predictions WHERE guild_id=? AND stage=?`,
          [guildId, stage]
        );

        const scoreRows = [];

        for (const p of preds) {

          let score = 0;

          cleanList(p.pick_3_0).forEach(t => {
            if (correct30.includes(t)) score += 4;
          });

          cleanList(p.pick_0_3).forEach(t => {
            if (correct03.includes(t)) score += 4;
          });

          cleanList(p.advancing).forEach(t => {
            if (correctAdv.includes(t)) score += 2;
          });

          scoreRows.push([
            guildId,
            p.user_id,
            stage,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(`
            INSERT INTO swiss_scores
              (guild_id,user_id,stage,displayname,points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname=VALUES(displayname),
              points=VALUES(points)
          `, [scoreRows]);
        }
      }

      logger.info('scores', 'Swiss done', { guildId });

    } catch (e) {
      logger.error('scores', 'Swiss failed', e);
    }


    /* =========================
       PLAYOFFS
    ========================= */
    try {

      const [rows] = await pool.query(`
        SELECT *
        FROM playoffs_results
        WHERE guild_id=?
          AND active=1
        ORDER BY id DESC
        LIMIT 1
      `, [guildId]);

      if (!rows.length) {
        logger.warn('scores', 'No data, skipping phase', { guildId });
      }


      const correct = rows[0];

      const [preds] = await pool.query(
        `SELECT * FROM playoffs_predictions WHERE guild_id=?`,
        [guildId]
      );

      const scoreRows = [];

      for (const p of preds) {

        let score = 0;

        cleanList(p.semifinalists).forEach(t => {
          if (cleanList(correct.correct_semifinalists).includes(t)) score += 1;
        });

        cleanList(p.finalists).forEach(t => {
          if (cleanList(correct.correct_finalists).includes(t)) score += 2;
        });

        if (p.winner === correct.correct_winner) score += 3;
        if (p.third_place_winner === correct.correct_third_place_winner) score += 2;

        scoreRows.push([
          guildId,
          p.user_id,
          p.displayname || p.user_id,
          score
        ]);
      }

      if (scoreRows.length) {
        await pool.query(`
          INSERT INTO playoffs_scores
            (guild_id,user_id,displayname,points)
          VALUES ?
          ON DUPLICATE KEY UPDATE
            displayname=VALUES(displayname),
            points=VALUES(points)
        `, [scoreRows]);
      }

      logger.info('scores', 'Playoffs done', { guildId });

    } catch (e) {
      logger.error('scores', 'Playoffs failed', e);
    }



    /* =========================
   DOUBLE ELIM
========================= */
    try {

      await pool.query(`
    DELETE FROM doubleelim_scores
    WHERE guild_id = ?
  `, [guildId]);

      const [rows] = await pool.query(`
    SELECT *
    FROM doubleelim_results
    WHERE guild_id=?
      AND active=1
    ORDER BY id DESC
    LIMIT 1
  `, [guildId]);

      if (rows.length) {

        const correct = rows[0];

        const [preds] = await pool.query(
          `SELECT * FROM doubleelim_predictions WHERE guild_id=?`,
          [guildId]
        );

        const scoreRows = [];

        for (const p of preds) {

          let score = 0;

          // Upper Final A
          cleanList(p.upper_final_a).forEach(t => {
            if (cleanList(correct.upper_final_a).includes(t)) score += 1;
          });

          // Lower Final A
          cleanList(p.lower_final_a).forEach(t => {
            if (cleanList(correct.lower_final_a).includes(t)) score += 1;
          });

          // Upper Final B
          cleanList(p.upper_final_b).forEach(t => {
            if (cleanList(correct.upper_final_b).includes(t)) score += 1;
          });

          // Lower Final B
          cleanList(p.lower_final_b).forEach(t => {
            if (cleanList(correct.lower_final_b).includes(t)) score += 1;
          });

          scoreRows.push([
            guildId,
            p.user_id,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(`
        INSERT INTO doubleelim_scores
          (guild_id,user_id,displayname,points)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          displayname=VALUES(displayname),
          points=VALUES(points)
      `, [scoreRows]);
        }

        logger.info('scores', 'DoubleElim done', { guildId });
      }

    } catch (e) {
      logger.error('scores', 'DoubleElim failed', e);
    }


    /* =========================
       PLAY-IN
    ========================= */
    try {
      await pool.query(`
  DELETE FROM playin_scores
  WHERE guild_id=?
`, [guildId]);

      const [rows] = await pool.query(`
    SELECT *
    FROM playin_results
    WHERE guild_id=?
      AND active=1
    ORDER BY id DESC
    LIMIT 1
  `, [guildId]);

      if (rows.length) {

        const correct = rows[0];

        const official =
          correct.correct_teams ??
          correct.official_playin_teams ??
          correct.teams ??
          '';

        const correctTeams = cleanList(official);

        const [preds] = await pool.query(
          `SELECT * FROM playin_predictions WHERE guild_id=?`,
          [guildId]
        );

        const scoreRows = [];

        for (const p of preds) {

          let score = 0;

          cleanList(p.teams).forEach(t => {
            if (correctTeams.includes(t)) score += 1;
          });

          scoreRows.push([
            guildId,
            p.user_id,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(`
        INSERT INTO playin_scores
          (guild_id,user_id,displayname,points)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          displayname=VALUES(displayname),
          points=VALUES(points)
      `, [scoreRows]);
        }

        logger.info('scores', 'Play-In done', { guildId });
      }

    } catch (e) {
      logger.error('scores', 'Play-In failed', e);
    }


    /* =========================
    MATCHES – TOTAL (SERIES + MAPS)
 ========================= */
    try {

      // bierzemy mecze z wynikami
      const [matches] = await pool.query(`
    SELECT
      m.id AS match_id,
      r.res_a,
      r.res_b
    FROM matches m
    JOIN match_results r
      ON r.match_id = m.id
     AND r.guild_id = m.guild_id
    WHERE m.guild_id = ?
  `, [guildId]);

      // czyścimy stare punkty
      await pool.query(`
    DELETE FROM match_points
    WHERE guild_id = ?
  `, [guildId]);

      const [preds] = await pool.query(`
    SELECT match_id,user_id,pred_a,pred_b
    FROM match_predictions
    WHERE guild_id = ?
  `, [guildId]);

      const predsByMatch = new Map();
      for (const p of preds) {
        if (!predsByMatch.has(p.match_id)) {
          predsByMatch.set(p.match_id, []);
        }
        predsByMatch.get(p.match_id).push(p);
      }

      const rows = [];

      // =========================
      // MAPY – pobieramy WSZYSTKO RAZ
      // =========================
      const [allMaps] = await pool.query(`
  SELECT
    mp.match_id,
    mp.user_id,
    mp.pred_exact_a AS predA,
    mp.pred_exact_b AS predB,
    mr.exact_a AS resA,
    mr.exact_b AS resB
  FROM match_map_predictions mp
  JOIN match_map_results mr
    ON mr.match_id = mp.match_id
   AND mr.map_no = mp.map_no
   AND mr.guild_id = mp.guild_id
  WHERE mp.guild_id = ?
`, [guildId]);

      const mapsByMatchUser = new Map();

      for (const m of allMaps) {
        const key = `${m.match_id}:${m.user_id}`;
        if (!mapsByMatchUser.has(key)) {
          mapsByMatchUser.set(key, []);
        }
        mapsByMatchUser.get(key).push(m);
      }

      for (const m of matches) {
        const users = predsByMatch.get(m.match_id) || [];

        for (const p of users) {

          // === SERIA ===
          const seriesPts = computeSeriesPoints({
            predA: p.pred_a,
            predB: p.pred_b,
            resA: m.res_a,
            resB: m.res_b
          });

          // === MAPY (z cache, bez SQL) ===
          const maps =
            mapsByMatchUser.get(`${m.match_id}:${p.user_id}`) || [];

          let mapPts = 0;
          for (const map of maps) {
            mapPts += computeMapPoints({
              predExactA: map.predA,
              predExactB: map.predB,
              exactA: map.resA,
              exactB: map.resB
            });
          }



          const total = seriesPts + mapPts;

          rows.push([
            guildId,
            m.match_id,
            p.user_id,
            total,
            'series'
          ]);
        }
      }

      if (rows.length) {
        await pool.query(`
      INSERT INTO match_points
        (guild_id,match_id,user_id,points,source)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        points = VALUES(points),
        computed_at = CURRENT_TIMESTAMP
    `, [rows]);
      }

      logger.info('scores', 'Matches total score done', { guildId });

    } catch (e) {
      logger.error('scores', 'Matches total failed', e);
    }


    logger.info('scores', 'Score calculation finished', { guildId });
  });
};
