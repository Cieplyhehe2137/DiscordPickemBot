const {
  logInfo: baseLogInfo,
  logWarn: baseLogWarn,
  logError: baseLogError
} = require('../../utils/logger');

const { withGuild } = require('../../utils/guildContext');
const {
  computeSeriesPoints,
  computeMapPoints
} = require('../../utils/matchScoring');
const { getActiveEventId } = require('../../utils/getOpenEventId');

function logInfo(scope, message, meta = {}) {
  baseLogInfo(message, {
    ...meta,
    extra: {
      ...(meta.extra || {}),
      scope
    }
  });
}

function logWarn(scope, message, meta = {}) {
  baseLogWarn(message, {
    ...meta,
    extra: {
      ...(meta.extra || {}),
      scope
    }
  });
}

function logError(scope, message, meta = {}) {
  baseLogError(message, null, {
    guildId: meta.guildId || null,
    userId: meta.userId || null,
    command: meta.command || null,
    customId: meta.customId || null,
    eventId: meta.eventId || null,
    phase: meta.phase || null,
    stack: meta.stack || null,
    extra: {
      ...(meta.extra || {}),
      scope,
      errorMessage: meta.message || null
    }
  });
}

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

async function resolveEventId(pool, guildId, preferredEventId) {
  if (preferredEventId) return preferredEventId;

  const activeId = await getActiveEventId(pool, guildId);
  if (activeId) return activeId;

  const [matchRows] = await pool.query(
    `
    SELECT event_id
    FROM matches
    WHERE guild_id = ?
      AND event_id IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
    `,
    [guildId]
  );

  return matchRows?.[0]?.event_id || null;
}

module.exports = async function calculateScores(guildId, eventId) {
  if (!guildId) {
    throw new Error('calculateScores requires guildId');
  }

  // Zwracamy wynik z withGuild, żeby wywołujący mógł sprawdzić, czy
  // przeliczanie faktycznie się odbyło, czy zostało pominięte.
  return withGuild({ guildId }, async ({ pool, guildId }) => {
    eventId = await resolveEventId(pool, guildId, eventId).catch(() => null);

    if (!eventId) {
      logWarn('scores', 'No eventId resolved, score calculation aborted to prevent mixed event data', {
        guildId,
        eventId: null
      });
      return;
    }

    // Zarchiwizowanego turnieju nie przeliczamy. Zasady punktacji map zmieniły
    // się po IEM Cologne 2026 (commit 60008a5: wcześniej "idealnie albo zero",
    // teraz 3/2/1/0 wg odchylenia), więc ponowne przeliczenie starego eventu
    // policzyłoby go NOWYMI regułami i przepisało zamknięty ranking. Na realnych
    // danych Cologne oznaczałoby to zmianę punktów u 221 z 373 graczy i inne
    // podium - zwycięzca spadłby na 5. miejsce.
    //
    // Blokada siedzi tutaj, a nie w endpoincie, bo przeliczanie wołają cztery
    // ścieżki: przycisk w panelu, przycisk na Discordzie, eksport klasyfikacji
    // ORAZ komenda /miejsce, której używają zwykli gracze. Zabezpieczenie
    // wyłącznie endpointu chroniłoby jedną z czterech.
    const [[archiwalny]] = await pool.query(
      'SELECT is_archived, name FROM events WHERE id = ? AND guild_id = ? LIMIT 1',
      [eventId, guildId]
    );

    // Pomijamy, a NIE rzucamy wyjątkiem: przeliczanie wołają też ścieżki tylko
    // do odczytu (eksport klasyfikacji, komenda /miejsce zwykłego gracza),
    // które muszą dalej działać na zarchiwizowanym turnieju - po prostu na
    // zapisanych już punktach. Wywołania świadome (przycisk w panelu, przycisk
    // na Discordzie) sprawdzają zwrócony status i informują admina.
    if (archiwalny && Number(archiwalny.is_archived) === 1) {
      logWarn('scores', 'Skipping score calculation for archived event', {
        guildId,
        eventId,
        extra: { eventName: archiwalny.name }
      });

      return {
        skipped: true,
        reason: 'EVENT_ARCHIVED',
        eventId,
        eventName: archiwalny.name
      };
    }

    logInfo('scores', '=== SCORE RUN START ===', {
      guildId,
      eventId
    });

    await pool.query(
      `
  DELETE FROM swiss_scores
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM playoffs_scores
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM doubleelim_scores
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM playin_scores
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM mvp_scores
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM match_points
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    await pool.query(
      `
  DELETE FROM leaderboard
  WHERE guild_id = ?
    AND event_id = ?
  `,
      [guildId, eventId]
    );

    /* =========================
       SWISS
    ========================= */
    try {
      const [rows] = await pool.query(
        `
  SELECT *
  FROM swiss_results
  WHERE guild_id = ?
    AND event_id = ?
    AND active = 1
  ORDER BY
    CASE stage
      WHEN 'stage1' THEN 1
      WHEN 'stage2' THEN 2
      WHEN 'stage3' THEN 3
      ELSE 99
    END ASC,
    id DESC
  `,
        [guildId, eventId]
      );

      if (!rows.length) {
        logWarn('scores', 'No Swiss data, skipping phase', { guildId, eventId });
      }

      for (const correct of rows) {
        const stage = correct.stage;

        const correct30 = cleanList(correct.correct_3_0);
        const correct03 = cleanList(correct.correct_0_3);
        const correctAdv = cleanList(correct.correct_advancing);

        const [preds] = await pool.query(
          `
          SELECT *
          FROM swiss_predictions
          WHERE guild_id = ?
            AND event_id = ?
            AND stage = ?
          `,
          [guildId, eventId, stage]
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
            eventId,
            p.user_id,
            stage,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO swiss_scores
              (guild_id, event_id, user_id, stage, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }
      }

      logInfo('scores', 'Swiss done', { guildId, eventId });
    } catch (e) {
      logError('scores', 'Swiss failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
       PLAYOFFS
    ========================= */
    try {
      const [rows] = await pool.query(
        `
        SELECT *
        FROM playoffs_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (!rows.length) {
        logWarn('scores', 'No Playoffs data, skipping phase', { guildId, eventId });
      } else {
        const correct = rows[0];

        const [preds] = await pool.query(
          `
          SELECT *
          FROM playoffs_predictions
          WHERE guild_id = ?
            AND event_id = ?
          `,
          [guildId, eventId]
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
            eventId,
            p.user_id,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO playoffs_scores
              (guild_id, event_id, user_id, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }

        logInfo('scores', 'Playoffs done', { guildId, eventId });
      }
    } catch (e) {
      logError('scores', 'Playoffs failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
       DOUBLE ELIM
    ========================= */
    try {
      await pool.query(
        `
        DELETE FROM doubleelim_scores
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId]
      );

      const [rows] = await pool.query(
        `
        SELECT *
        FROM doubleelim_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (!rows.length) {
        logWarn('scores', 'No DoubleElim data, skipping phase', { guildId, eventId });
      } else {
        const correct = rows[0];

        const [preds] = await pool.query(
          `
          SELECT *
          FROM doubleelim_predictions
          WHERE guild_id = ?
            AND event_id = ?
          `,
          [guildId, eventId]
        );

        const scoreRows = [];

        for (const p of preds) {
          let score = 0;

          cleanList(p.upper_final_a).forEach(t => {
            if (cleanList(correct.upper_final_a).includes(t)) score += 1;
          });

          cleanList(p.lower_final_a).forEach(t => {
            if (cleanList(correct.lower_final_a).includes(t)) score += 1;
          });

          cleanList(p.upper_final_b).forEach(t => {
            if (cleanList(correct.upper_final_b).includes(t)) score += 1;
          });

          cleanList(p.lower_final_b).forEach(t => {
            if (cleanList(correct.lower_final_b).includes(t)) score += 1;
          });

          scoreRows.push([
            guildId,
            eventId,
            p.user_id,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO doubleelim_scores
              (guild_id, event_id, user_id, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }

        logInfo('scores', 'DoubleElim done', { guildId, eventId });
      }
    } catch (e) {
      logError('scores', 'DoubleElim failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
       PLAY-IN
    ========================= */
    try {
      await pool.query(
        `
        DELETE FROM playin_scores
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId]
      );

      const [rows] = await pool.query(
        `
        SELECT *
        FROM playin_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (!rows.length) {
        logWarn('scores', 'No Play-In data, skipping phase', { guildId, eventId });
      } else {
        const correct = rows[0];

        const official =
          correct.correct_teams ??
          correct.official_playin_teams ??
          correct.teams ??
          '';

        const correctTeams = cleanList(official);

        const [preds] = await pool.query(
          `
          SELECT *
          FROM playin_predictions
          WHERE guild_id = ?
            AND event_id = ?
          `,
          [guildId, eventId]
        );

        const scoreRows = [];

        for (const p of preds) {
          let score = 0;

          cleanList(p.teams).forEach(t => {
            if (correctTeams.includes(t)) score += 1;
          });

          scoreRows.push([
            guildId,
            eventId,
            p.user_id,
            p.displayname || p.user_id,
            score
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO playin_scores
              (guild_id, event_id, user_id, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }

        logInfo('scores', 'Play-In done', { guildId, eventId });
      }
    } catch (e) {
      logError('scores', 'Play-In failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
   MATCHES – SERIES + MAPS
========================= */
    try {
      await pool.query(
        `
    DELETE FROM match_points
    WHERE guild_id = ?
      AND event_id = ?
    `,
        [guildId, eventId]
      );

      const [seriesRows] = await pool.query(
        `
    SELECT
      m.id AS match_id,
      p.user_id,
      p.pred_a,
      p.pred_b,
      r.res_a,
      r.res_b
    FROM matches m
    JOIN match_predictions p
      ON p.match_id = m.id
     AND p.guild_id = m.guild_id
     AND p.event_id = m.event_id
    JOIN match_results r
      ON r.match_id = m.id
     AND r.guild_id = m.guild_id
     AND r.event_id = m.event_id
    WHERE m.guild_id = ?
      AND m.event_id = ?
    `,
        [guildId, eventId]
      );

      const rows = [];

      for (const r of seriesRows) {
        const seriesPts = computeSeriesPoints({
          predA: r.pred_a,
          predB: r.pred_b,
          resA: r.res_a,
          resB: r.res_b
        });

        rows.push([
          guildId,
          eventId,
          r.match_id,
          r.user_id,
          seriesPts,
          'series'
        ]);
      }

      const [bo1MapRows] = await pool.query(
        `
    SELECT
      m.id AS match_id,
      p.user_id,
      p.pred_exact_a AS predA,
      p.pred_exact_b AS predB,
      r.exact_a AS resA,
      r.exact_b AS resB
    FROM matches m
    JOIN match_predictions p
      ON p.match_id = m.id
     AND p.guild_id = m.guild_id
     AND p.event_id = m.event_id
    JOIN match_results r
      ON r.match_id = m.id
     AND r.guild_id = m.guild_id
     AND r.event_id = m.event_id
    WHERE m.guild_id = ?
      AND m.event_id = ?
      AND m.best_of = 1
      AND p.pred_exact_a IS NOT NULL
      AND p.pred_exact_b IS NOT NULL
      AND r.exact_a IS NOT NULL
      AND r.exact_b IS NOT NULL
    `,
        [guildId, eventId]
      );

      const [boMapRows] = await pool.query(
        `
    SELECT
      m.id AS match_id,
      p.user_id,
      p.map_no,
      p.pred_exact_a AS predA,
      p.pred_exact_b AS predB,
      r.exact_a AS resA,
      r.exact_b AS resB
    FROM matches m
    JOIN match_map_predictions p
      ON p.match_id = m.id
     AND p.guild_id = m.guild_id
     AND p.event_id = m.event_id
    JOIN match_map_results r
      ON r.match_id = p.match_id
     AND r.guild_id = p.guild_id
     AND r.event_id = p.event_id
     AND r.map_no = p.map_no
    WHERE m.guild_id = ?
      AND m.event_id = ?
      AND m.best_of IN (3, 5)
      AND p.pred_exact_a IS NOT NULL
      AND p.pred_exact_b IS NOT NULL
      AND r.exact_a IS NOT NULL
      AND r.exact_b IS NOT NULL
    `,
        [guildId, eventId]
      );

      const mapPointsByMatchUser = new Map();

      function addMapPoint(row) {
        const key = `${row.match_id}:${row.user_id}`;

        const points = computeMapPoints({
          predExactA: row.predA,
          predExactB: row.predB,
          exactA: row.resA,
          exactB: row.resB
        });

        mapPointsByMatchUser.set(
          key,
          (mapPointsByMatchUser.get(key) || 0) + points
        );
      }

      for (const r of bo1MapRows) addMapPoint(r);
      for (const r of boMapRows) addMapPoint(r);

      for (const [key, points] of mapPointsByMatchUser.entries()) {
        const [matchId, userId] = key.split(':');

        rows.push([
          guildId,
          eventId,
          Number(matchId),
          userId,
          points,
          'map'
        ]);
      }

      if (rows.length) {
        await pool.query(
          `
      INSERT INTO match_points
        (guild_id, event_id, match_id, user_id, points, source)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        points = VALUES(points),
        computed_at = CURRENT_TIMESTAMP
      `,
          [rows]
        );
      }

      logInfo('scores', 'Matches score done', {
        guildId,
        eventId,
        rowsInserted: rows.length,
        bo1Maps: bo1MapRows.length,
        boSeriesMaps: boMapRows.length
      });
    } catch (e) {
      logError('scores', 'Matches failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
       MVP
    ========================= */
    try {
      await pool.query(
        `
        DELETE FROM mvp_scores
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId]
      );

      const [resultRows] = await pool.query(
        `
        SELECT candidate_id
        FROM mvp_results
        WHERE guild_id = ?
          AND event_id = ?
          AND active = 1
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, eventId]
      );

      if (!resultRows.length) {
        logWarn('scores', 'No MVP result, skipping phase', { guildId, eventId });
      } else {
        const correctCandidateId = Number(resultRows[0].candidate_id);

        const [preds] = await pool.query(
          `
          SELECT *
          FROM mvp_predictions
          WHERE guild_id = ?
            AND event_id = ?
          `,
          [guildId, eventId]
        );

        const scoreRows = [];

        for (const p of preds) {
          const points = Number(p.candidate_id) === correctCandidateId ? 5 : 0;

          scoreRows.push([
            guildId,
            eventId,
            p.user_id,
            p.username || p.user_id,
            points
          ]);
        }

        if (scoreRows.length) {
          await pool.query(
            `
            INSERT INTO mvp_scores
              (guild_id, event_id, user_id, displayname, points)
            VALUES ?
            ON DUPLICATE KEY UPDATE
              displayname = VALUES(displayname),
              points = VALUES(points)
            `,
            [scoreRows]
          );
        }

        logInfo('scores', 'MVP done', {
          guildId,
          eventId,
          correctCandidateId
        });
      }
    } catch (e) {
      logError('scores', 'MVP failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    /* =========================
       GLOBAL LEADERBOARD
    ========================= */
    try {
      await pool.query(
        `
        DELETE FROM leaderboard
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId]
      );

      const [rows] = await pool.query(
        `
        SELECT user_id, SUM(points) AS total_points
        FROM (
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM swiss_scores
          WHERE guild_id = ? AND event_id = ?

          UNION ALL

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM playoffs_scores
          WHERE guild_id = ? AND event_id = ?

          UNION ALL

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM doubleelim_scores
          WHERE guild_id = ? AND event_id = ?

          UNION ALL

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM playin_scores
          WHERE guild_id = ? AND event_id = ?

          UNION ALL

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM match_points
          WHERE guild_id = ? AND event_id = ?

          UNION ALL

          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, points
          FROM mvp_scores
          WHERE guild_id = ? AND event_id = ?
        ) all_points
        GROUP BY user_id
        `,
        [
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId,
          guildId, eventId
        ]
      );

      if (rows.length) {
        const insertRows = rows.map(r => [
          guildId,
          eventId,
          r.user_id,
          r.total_points
        ]);

        await pool.query(
          `
          INSERT INTO leaderboard
            (guild_id, event_id, user_id, total_points)
          VALUES ?
          `,
          [insertRows]
        );
      }

      logInfo('scores', 'Leaderboard rebuilt', {
        guildId,
        eventId
      });
    } catch (e) {
      logError('scores', 'Leaderboard rebuild failed', {
        guildId,
        eventId,
        message: e.message,
        stack: e.stack
      });
    }

    logInfo('scores', 'Score calculation finished', {
      guildId,
      eventId
    });

    return { skipped: false, eventId };
  });
};