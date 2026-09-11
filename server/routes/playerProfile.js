// Profil gracza w evencie: punkty, skutecznosc, serie, rekordy, porownanie
// z reszta stawki i historia typow.
//
// Jedna trasa i ponad 900 linii. Klasyfikacja bierze sie z tabeli
// `leaderboard`, a nie z sumowania match_points - to jest zrodlo prawdy o
// miejscu w rankingu i tylko ono przezywa zakonczenie turnieju z cleanupem.

export function registerPlayerProfileRoutes(
  app,
  {
    assertPredictionsAllowed,
    isMatchDeadlinePassed,
    matchPanelPhaseFor,
    findNameFromPicks,
    pool,
  },
) {
  app.get("/api/public/events/:slug/players/:userId", async (req, res) => {
    try {
      const { slug, userId } = req.params;

      const [[event]] = await pool.query(
        `
          SELECT
            id,
            guild_id,
            name,
            slug
          FROM events
          WHERE slug = ?
          LIMIT 1
          `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      const [[userProfile]] = await pool.query(
        `
          SELECT
            user_id,
            displayname,
            username,
            avatar
          FROM user_profiles
          WHERE user_id = ?
          LIMIT 1
          `,
        [userId],
      );

      // Dopiero gdy profilu nie ma - nie ma po co odpytywac osmiu tabel faz
      // dla kogos, kto logowal sie na stronie i ma tam swoja nazwe.
      const nazwaZapasowa =
        userProfile?.displayname || userProfile?.username
          ? null
          : await findNameFromPicks(event.id, userId);

      /*
       * Punkty dla tego eventu.
       * match_points może mieć kilka rekordów dla jednego meczu,
       * np. source = series i source = map.
       */
      const [[pointsStats]] = await pool.query(
        `
          SELECT
            COALESCE(SUM(points), 0) AS total_points,

            COALESCE(
              SUM(
                CASE
                  WHEN source = 'series'
                  THEN points
                  ELSE 0
                END
              ),
              0
            ) AS series_points,

            COALESCE(
              SUM(
                CASE
                  WHEN source = 'map'
                  THEN points
                  ELSE 0
                END
              ),
              0
            ) AS map_points

          FROM match_points
          WHERE event_id = ?
            AND user_id = ?
          `,
        [event.id, userId],
      );

      /*
       * Statystyki typów serii.
       */
      const [[predictionStats]] = await pool.query(
        `
          SELECT
            COUNT(*) AS total_predictions,

            SUM(
              CASE
                WHEN mr.match_id IS NOT NULL
                THEN 1
                ELSE 0
              END
            ) AS finished_predictions,

            SUM(
              CASE
                WHEN mr.match_id IS NOT NULL
                 AND (
                   (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
                   OR
                   (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
                 )
                THEN 1
                ELSE 0
              END
            ) AS correct_winners,

            SUM(
              CASE
                WHEN mr.match_id IS NOT NULL
                 AND mp.pred_a = mr.res_a
                 AND mp.pred_b = mr.res_b
                THEN 1
                ELSE 0
              END
            ) AS exact_series

          FROM match_predictions mp

          LEFT JOIN match_results mr
            ON mr.event_id = mp.event_id
           AND mr.match_id = mp.match_id

          WHERE mp.event_id = ?
            AND mp.user_id = ?
          `,
        [event.id, userId],
      );

      /*
       * Statystyki map.
       */
      const [[mapStats]] = await pool.query(
        `
          SELECT
            COUNT(*) AS predicted_maps,

            SUM(
              CASE
                WHEN mmr.match_id IS NOT NULL
                 AND (
                   (
                     mmp.pred_exact_a > mmp.pred_exact_b
                     AND mmr.exact_a > mmr.exact_b
                   )
                   OR
                   (
                     mmp.pred_exact_b > mmp.pred_exact_a
                     AND mmr.exact_b > mmr.exact_a
                   )
                 )
                THEN 1
                ELSE 0
              END
            ) AS correct_maps,

            SUM(
              CASE
                WHEN mmr.match_id IS NOT NULL
                 AND mmp.pred_exact_a = mmr.exact_a
                 AND mmp.pred_exact_b = mmr.exact_b
                THEN 1
                ELSE 0
              END
            ) AS exact_maps

          FROM match_map_predictions mmp

          LEFT JOIN match_map_results mmr
            ON mmr.event_id = mmp.event_id
           AND mmr.match_id = mmp.match_id
           AND mmr.map_no = mmp.map_no

          WHERE mmp.event_id = ?
            AND mmp.user_id = ?
          `,
        [event.id, userId],
      );

      /*
       * Pozycja gracza w samym tym evencie.
       *
       * Klasyfikacja idzie z tabeli `leaderboard` - tej samej, ktora karmi
       * strone "Ranking graczy", bota i eksport. Wczesniej bylo tu osobne
       * ROW_NUMBER() liczone z samych match_points i tylko wsrod typujacych
       * mecze. Przez to profil pokazywal miejsce nawet wtedy, gdy w rankingu
       * eventu nie bylo jeszcze nikogo, i pomijal punkty ze Swiss, Playoffs,
       * Play-In, Double Elim oraz MVP.
       */
      const [[rankRow]] = await pool.query(
        `
    SELECT ranked.rank_position, ranked.total_points
    FROM (
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        COALESCE(total_points, 0) AS total_points,

        ROW_NUMBER() OVER (
          ORDER BY
            COALESCE(total_points, 0) DESC,
            user_id ASC
        ) AS rank_position

      FROM leaderboard
      WHERE event_id = ?
    ) ranked

    WHERE ranked.user_id = ?

    LIMIT 1
    `,
        [event.id, userId],
      );

      // Miejsce i punkty musza pochodzic z tego samego zrodla, inaczej
      // sasiadujace kafelki potrafia sobie zaprzeczyc.
      const punktyKlasyfikacji = rankRow ? Number(rankRow.total_points || 0) : 0;

      const totalPredictions = Number(predictionStats?.finished_predictions || 0);

      const correctWinners = Number(predictionStats?.correct_winners || 0);

      const [recentPredictions] = await pool.query(
        `
    SELECT
      mp.match_id,
      mp.pred_a,
      mp.pred_b,

      mr.res_a,
      mr.res_b,

      m.team_a,
      m.team_b,

      COALESCE(SUM(pts.points), 0) AS points

    FROM match_predictions mp

    INNER JOIN matches m
      ON m.id = mp.match_id
     AND m.event_id = mp.event_id

    LEFT JOIN match_results mr
      ON mr.match_id = mp.match_id
     AND mr.event_id = mp.event_id

    LEFT JOIN match_points pts
      ON pts.match_id = mp.match_id
     AND pts.event_id = mp.event_id
     AND pts.user_id = mp.user_id

    WHERE mp.event_id = ?
      AND mp.user_id = ?

    GROUP BY
      mp.match_id,
      mp.pred_a,
      mp.pred_b,
      mr.res_a,
      mr.res_b,
      m.team_a,
      m.team_b

    ORDER BY mp.match_id DESC
    LIMIT 10
    `,
        [event.id, userId],
      );

      const [recentMapPredictions] = await pool.query(
        `
    SELECT
      mmp.match_id,
      mmp.map_no,

      mmp.pred_exact_a,
      mmp.pred_exact_b,

      mmr.exact_a AS res_exact_a,
      mmr.exact_b AS res_exact_b

    FROM match_map_predictions mmp

    LEFT JOIN match_map_results mmr
      ON mmr.event_id = mmp.event_id
     AND mmr.match_id = mmp.match_id
     AND mmr.map_no = mmp.map_no

    WHERE mmp.event_id = ?
      AND mmp.user_id = ?

    ORDER BY
      mmp.match_id DESC,
      mmp.map_no ASC
    `,
        [event.id, userId],
      );

      const [[bestMatch]] = await pool.query(
        `
    SELECT
      match_id,
      SUM(points) AS points

    FROM match_points

    WHERE event_id = ?
      AND user_id = ?

    GROUP BY match_id

    ORDER BY
      points DESC,
      match_id ASC

    LIMIT 1
    `,
        [event.id, userId],
      );

      const [streakRows] = await pool.query(
        `
    SELECT
      mp.match_id,
      mp.pred_a,
      mp.pred_b,
      mr.res_a,
      mr.res_b,
      COALESCE(m.match_no, m.id) AS sort_order

    FROM match_predictions mp

    INNER JOIN match_results mr
      ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    INNER JOIN matches m
      ON m.id = mp.match_id
     AND m.event_id = mp.event_id

    WHERE mp.event_id = ?
      AND mp.user_id = ?

    ORDER BY
      sort_order ASC,
      mp.match_id ASC
    `,
        [event.id, userId],
      );

      let currentCorrectStreak = 0;
      let bestCorrectStreak = 0;

      for (const row of streakRows) {
        const correct =
          (Number(row.pred_a) > Number(row.pred_b) &&
            Number(row.res_a) > Number(row.res_b)) ||
          (Number(row.pred_b) > Number(row.pred_a) &&
            Number(row.res_b) > Number(row.res_a));

        if (correct) {
          currentCorrectStreak += 1;

          if (currentCorrectStreak > bestCorrectStreak) {
            bestCorrectStreak = currentCorrectStreak;
          }
        } else {
          currentCorrectStreak = 0;
        }
      }

      const [perfectMatchRows] = await pool.query(
        `
    SELECT
      mp.match_id,
      mp.pred_a,
      mp.pred_b,
      mr.res_a,
      mr.res_b,

      COUNT(mmp.map_no) AS predicted_maps,

      SUM(
        CASE
          WHEN mmr.match_id IS NOT NULL
           AND mmp.pred_exact_a = mmr.exact_a
           AND mmp.pred_exact_b = mmr.exact_b
          THEN 1
          ELSE 0
        END
      ) AS exact_maps

    FROM match_predictions mp

    INNER JOIN match_results mr
      ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    LEFT JOIN match_map_predictions mmp
      ON mmp.event_id = mp.event_id
     AND mmp.match_id = mp.match_id
     AND mmp.user_id = mp.user_id

    LEFT JOIN match_map_results mmr
      ON mmr.event_id = mmp.event_id
     AND mmr.match_id = mmp.match_id
     AND mmr.map_no = mmp.map_no

    WHERE mp.event_id = ?
      AND mp.user_id = ?

    GROUP BY
      mp.match_id,
      mp.pred_a,
      mp.pred_b,
      mr.res_a,
      mr.res_b
    `,
        [event.id, userId],
      );

      let perfectMatches = 0;

      for (const row of perfectMatchRows) {
        const exactSeries =
          Number(row.pred_a) === Number(row.res_a) &&
          Number(row.pred_b) === Number(row.res_b);

        const predictedMaps = Number(row.predicted_maps || 0);
        const exactMaps = Number(row.exact_maps || 0);

        const allMapsExact = predictedMaps > 0 && predictedMaps === exactMaps;

        if (exactSeries && allMapsExact) {
          perfectMatches += 1;
        }
      }

      const [[bestMapMatch]] = await pool.query(
        `
    SELECT
      match_id,
      SUM(points) AS points

    FROM match_points

    WHERE event_id = ?
      AND user_id = ?
      AND source = 'map'

    GROUP BY match_id

    ORDER BY
      points DESC,
      match_id ASC

    LIMIT 1
    `,
        [event.id, userId],
      );

      const [[correctMatchPointsStats]] = await pool.query(
        `
    SELECT
      COALESCE(AVG(match_total_points), 0) AS average_points

    FROM (
      SELECT
        mp.match_id,
        COALESCE(SUM(mpts.points), 0) AS match_total_points

      FROM match_predictions mp

      INNER JOIN match_results mr
        ON mr.event_id = mp.event_id
       AND mr.match_id = mp.match_id

      LEFT JOIN match_points mpts
        ON mpts.event_id = mp.event_id
       AND mpts.match_id = mp.match_id
       AND mpts.user_id = mp.user_id

      WHERE mp.event_id = ?
        AND mp.user_id = ?

        AND (
          (
            mp.pred_a > mp.pred_b
            AND mr.res_a > mr.res_b
          )
          OR
          (
            mp.pred_b > mp.pred_a
            AND mr.res_b > mr.res_a
          )
        )

      GROUP BY mp.match_id
    ) correct_matches
    `,
        [event.id, userId],
      );

      const [eventComparisonRows] = await pool.query(
        `
    SELECT
      users.user_id,

      COALESCE(points.total_points, 0) AS total_points,

      COALESCE(preds.correct_winners, 0) AS correct_winners,
      COALESCE(preds.finished_predictions, 0) AS finished_predictions,

      COALESCE(maps.correct_maps, 0) AS correct_maps,
      COALESCE(maps.exact_maps, 0) AS exact_maps

    FROM (
      SELECT DISTINCT user_id
      FROM match_predictions
      WHERE event_id = ?
    ) users

    LEFT JOIN (
      SELECT
        user_id,
        SUM(points) AS total_points
      FROM match_points
      WHERE event_id = ?
      GROUP BY user_id
    ) points
      ON points.user_id = users.user_id

    LEFT JOIN (
      SELECT
        mp.user_id,

        COUNT(DISTINCT mp.match_id) AS finished_predictions,

        COUNT(
          DISTINCT CASE
            WHEN (
              (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
              OR
              (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
            )
            THEN mp.match_id
            ELSE NULL
          END
        ) AS correct_winners

      FROM match_predictions mp

      INNER JOIN match_results mr
        ON mr.event_id = mp.event_id
       AND mr.match_id = mp.match_id

      WHERE mp.event_id = ?

      GROUP BY mp.user_id
    ) preds
      ON preds.user_id = users.user_id

    LEFT JOIN (
      SELECT
        mmp.user_id,

        SUM(
          CASE
            WHEN (
              (mmp.pred_exact_a > mmp.pred_exact_b AND mmr.exact_a > mmr.exact_b)
              OR
              (mmp.pred_exact_b > mmp.pred_exact_a AND mmr.exact_b > mmr.exact_a)
            )
            THEN 1
            ELSE 0
          END
        ) AS correct_maps,

        SUM(
          CASE
            WHEN mmp.pred_exact_a = mmr.exact_a
             AND mmp.pred_exact_b = mmr.exact_b
            THEN 1
            ELSE 0
          END
        ) AS exact_maps

      FROM match_map_predictions mmp

      INNER JOIN match_map_results mmr
        ON mmr.event_id = mmp.event_id
       AND mmr.match_id = mmp.match_id
       AND mmr.map_no = mmp.map_no

      WHERE mmp.event_id = ?

      GROUP BY mmp.user_id
    ) maps
      ON maps.user_id = users.user_id
    `,
        [event.id, event.id, event.id, event.id],
      );

      const comparisonPlayers = eventComparisonRows.map((row) => {
        const finished = Number(row.finished_predictions || 0);
        const correct = Number(row.correct_winners || 0);

        return {
          user_id: String(row.user_id),

          points: Number(row.total_points || 0),

          accuracy: finished > 0 ? (correct / finished) * 100 : 0,

          exact_maps: Number(row.exact_maps || 0),
          correct_maps: Number(row.correct_maps || 0),
        };
      });

      function getComparison(metric, value) {
        const total = comparisonPlayers.length;

        if (total === 0) {
          return {
            rank: 0,
            total: 0,
            top_percent: 0,
          };
        }

        const better = comparisonPlayers.filter(
          (player) => player[metric] > value,
        ).length;

        const rank = better + 1;

        return {
          rank,
          total,

          top_percent: Math.max(1, Math.ceil((rank / total) * 100)),
        };
      }

      const playerComparison = comparisonPlayers.find(
        (row) => row.user_id === String(userId),
      );

      const eventComparison = playerComparison
        ? {
          points: getComparison("points", playerComparison.points),

          accuracy: getComparison("accuracy", playerComparison.accuracy),

          exact_maps: getComparison("exact_maps", playerComparison.exact_maps),

          correct_maps: getComparison(
            "correct_maps",
            playerComparison.correct_maps,
          ),
        }
        : null;

      res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        profile: {
          best_match_points: Number(bestMatch?.points || 0),
          best_correct_streak: bestCorrectStreak,
          current_correct_streak: currentCorrectStreak,
          perfect_matches: perfectMatches,
          best_map_match_points: Number(bestMapMatch?.points || 0),
          average_points_correct_match: Number(
            Number(correctMatchPointsStats?.average_points || 0).toFixed(1),
          ),
          event_comparison: eventComparison,
          user_id: userId,

          recent_predictions: recentPredictions.map((row) => {
            const maps = recentMapPredictions
              .filter((map) => Number(map.match_id) === Number(row.match_id))
              .map((map) => {
                const predA = Number(map.pred_exact_a);
                const predB = Number(map.pred_exact_b);

                const resultA =
                  map.res_exact_a !== null ? Number(map.res_exact_a) : null;

                const resultB =
                  map.res_exact_b !== null ? Number(map.res_exact_b) : null;

                const finished = resultA !== null && resultB !== null;

                const exact = finished && predA === resultA && predB === resultB;

                const correctWinner =
                  finished &&
                  ((predA > predB && resultA > resultB) ||
                    (predB > predA && resultB > resultA));

                return {
                  map_no: Number(map.map_no),

                  pred_a: predA,
                  pred_b: predB,

                  res_a: resultA,
                  res_b: resultB,

                  finished,
                  exact,
                  correct_winner: correctWinner,
                };
              });

            return {
              match_id: row.match_id,

              team_a: row.team_a,
              team_b: row.team_b,

              pred_a: Number(row.pred_a),
              pred_b: Number(row.pred_b),

              res_a: row.res_a !== null ? Number(row.res_a) : null,

              res_b: row.res_b !== null ? Number(row.res_b) : null,

              points: Number(row.points || 0),

              maps,
            };
          }),

          displayname:
            userProfile?.displayname ||
            userProfile?.username ||
            nazwaZapasowa ||
            userId,

          avatar: userProfile?.avatar || null,

          // null, a nie 0 - brak wiersza znaczy "jeszcze nie sklasyfikowany",
          // co front pokazuje jako "-", zamiast zmyslac pozycje.
          rank: rankRow ? Number(rankRow.rank_position) : null,

          // Suma z tabeli `leaderboard`, czyli ta sama, ktora pokazuje ranking
          // i ktora decyduje o miejscu tuz obok. Wczesniej szla tu wylacznie
          // suma match_points, wiec gracz z turnieju bez typowania meczow
          // ogladal "Ranking #193" nad "Punkty 0", choc w rankingu mial 15.
          // Rozbicie na serie i mapy nizej zostaje meczowe - tam to ma sens.
          total_points: punktyKlasyfikacji,

          series_points: Number(pointsStats?.series_points || 0),

          map_points: Number(pointsStats?.map_points || 0),

          total_predictions: Number(predictionStats?.total_predictions || 0),

          finished_predictions: totalPredictions,

          correct_winners: correctWinners,

          exact_series: Number(predictionStats?.exact_series || 0),

          predicted_maps: Number(mapStats?.predicted_maps || 0),

          correct_maps: Number(mapStats?.correct_maps || 0),

          exact_maps: Number(mapStats?.exact_maps || 0),

          accuracy:
            totalPredictions > 0
              ? Math.round((correctWinners / totalPredictions) * 100)
              : 0,
        },
      });
    } catch (err) {
      console.error("EVENT PLAYER PROFILE ERROR:", err);

      res.status(500).json({
        error: "Event player profile load failed",
      });
    }
  });
}
