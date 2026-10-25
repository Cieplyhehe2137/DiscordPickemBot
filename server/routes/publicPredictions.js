// Typy MECZOWE gracza - trzy trasy wokol jednego zasobu:
//
//   POST /api/public/matches/:matchId/prediction          zapis typu
//   GET  /api/public/matches/:matchId/prediction          wlasny typ
//   GET  /api/public/events/:eventId/predictions/:userId  typy w turnieju
//
// To typowanie POJEDYNCZYCH MECZOW - kto wygra, jakim wynikiem, na
// ktorych mapach. Typowanie FAZ (kto awansuje, kto wygra turniej) to
// zupelnie inny zasob i inne tabele; siedzi w publicPickem*.js.
//
// Zapis idzie przez runInTransaction, bo dotyka typu i jego map naraz.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerPublicPredictionRoutes(
  app,
  {
    assertPredictionsAllowed,
    isGuildMember,
    isMatchDeadlinePassed,
    isMatchLocked,
    matchPanelPhaseFor,
    pool,
    runInTransaction,
    toWebMessage,
    validateCs2Score,
    validateSeriesMapOrder,
  },
) {
  app.post("/api/public/matches/:matchId/prediction", async (req, res) => {
    try {
      const { matchId } = req.params;
      const user_id = req.session?.user?.id;

      if (!user_id) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
          code: "server.mustLogin",
        });
      }

      // ============================================
      // MATCH
      // ============================================

      const [[match]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          event_id,
          phase,
          team_a,
          team_b,
          best_of,
          is_locked,
          lock_override,
          start_time_utc
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
          code: "server.matchNotFound",
        });
      }

      // ============================================
      // GUILD ACCESS
      // ============================================

      if (!isGuildMember(req.session.user, match.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
          code: "server.notMember",
        });
      }

      // ============================================
      // FINAL RESULT
      // ============================================

      const [[existingResult]] = await pool.query(
        `
        SELECT 1
        FROM match_results
        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
        LIMIT 1
        `,
        [match.guild_id, match.event_id, match.id],
      );

      if (existingResult) {
        return res.status(403).json({
          error: "Mecz został już zakończony.",
          code: "server.matchAlreadyFinished",
        });
      }

      // ============================================
      // GLOBAL PREDICTION GATE
      // ============================================

      const gate = await assertPredictionsAllowed({
        guildId: match.guild_id,
        kind: "MATCHES",
      });

      if (!gate.allowed) {
        return res.status(403).json({
          error: toWebMessage(gate.message, "Typowanie meczów jest aktualnie zamknięte."),
        });
      }

      // ============================================
      // MATCH LOCK
      // ============================================

      if (isMatchLocked(match)) {
        return res.status(403).json({
          error: "Typowanie tego meczu jest już zamknięte.",
          code: "server.matchPickingClosed",
        });
      }

      // ============================================
      // PHASE DEADLINE
      // ============================================

      const matchPanelPhase = matchPanelPhaseFor(match.phase);

      if (matchPanelPhase) {
        const { passed } = await isMatchDeadlinePassed(
          pool,
          match.guild_id,
          matchPanelPhase,
        );

        if (passed) {
          return res.status(403).json({
            error: "Deadline typowania wyników meczów dla tej fazy minął.",
            code: "server.matchDeadlinePassed",
          });
        }
      }

      // ============================================
      // BEST OF
      // ============================================

      const bestOf = Number(match.best_of || 1);

      if (![1, 3, 5].includes(bestOf)) {
        return res.status(400).json({
          error: `Nieobsługiwany format BO${bestOf}.`,
        });
      }

      const hasSeriesPayload = Boolean(req.body?.series);

      if (bestOf === 1 && hasSeriesPayload) {
        return res.status(400).json({
          error: "BO1 nie przyjmuje payloadu serii.",
        });
      }

      if (bestOf > 1 && !hasSeriesPayload) {
        return res.status(400).json({
          error: `BO${bestOf} wymaga payloadu serii.`,
        });
      }

      let predA = null;
      let predB = null;

      let bo1ExactA = null;
      let bo1ExactB = null;

      let mapPicks = [];

      // ============================================
      // BO3 / BO5
      // ============================================

      if (hasSeriesPayload) {
        predA = Number(req.body.series.pred_a);

        predB = Number(req.body.series.pred_b);

        if (
          !Number.isInteger(predA) ||
          !Number.isInteger(predB) ||
          predA < 0 ||
          predB < 0 ||
          predA === predB
        ) {
          return res.status(400).json({
            error: "Nieprawidłowy typ serii.",
            code: "server.badSeriesPick",
          });
        }

        // ============================================
        // VALID SERIES SCORE
        // ============================================

        if (bestOf === 3) {
          const validBo3 =
            (predA === 2 && (predB === 0 || predB === 1)) ||
            (predB === 2 && (predA === 0 || predA === 1));

          if (!validBo3) {
            return res.status(400).json({
              error: "BO3 series must be 2:0 / 2:1 / 1:2 / 0:2",
            });
          }
        }

        if (bestOf === 5) {
          const validBo5 =
            (predA === 3 && [0, 1, 2].includes(predB)) ||
            (predB === 3 && [0, 1, 2].includes(predA));

          if (!validBo5) {
            return res.status(400).json({
              error: "BO5 series must be 3:x or x:3",
            });
          }
        }

        // ============================================
        // MAPS
        // ============================================

        mapPicks = Array.isArray(req.body.maps) ? req.body.maps : [];

        const requiredMaps = predA + predB;

        if (mapPicks.length !== requiredMaps) {
          return res.status(400).json({
            error:
              `Dla wyniku ${predA}:${predB} wymagane są ` +
              `${requiredMaps} mapy.`,
          });
        }

        // ============================================
        // UNIQUE MAP NUMBERS
        // ============================================

        const mapNumbers = mapPicks.map((map) => Number(map.map_no));

        const uniqueMapNumbers = new Set(mapNumbers);

        if (uniqueMapNumbers.size !== mapNumbers.length) {
          return res.status(400).json({
            error: "Numery map nie mogą się powtarzać.",
            code: "server.mapNumbersUnique",
          });
        }

        // ============================================
        // MAP NUMBERS 1,2,3...
        // ============================================

        const expectedMapNumbers = Array.from(
          {
            length: mapPicks.length,
          },
          (_, index) => index + 1,
        );

        const actualMapNumbers = mapPicks
          .map((map) => Number(map.map_no))
          .sort((a, b) => a - b);

        const hasValidMapNumbers = expectedMapNumbers.every(
          (mapNo, index) => mapNo === actualMapNumbers[index],
        );

        if (!hasValidMapNumbers) {
          return res.status(400).json({
            error: "Numery map muszą być kolejne: 1, 2, 3...",
            code: "server.mapNumbersSequential",
          });
        }

        // ============================================
        // MAP SCORE VALIDATION
        // ============================================

        for (const map of mapPicks) {
          const mapNo = Number(map.map_no);

          const exactA = Number(map.pred_exact_a);

          const exactB = Number(map.pred_exact_b);

          if (
            !Number.isInteger(mapNo) ||
            mapNo < 1 ||
            mapNo > bestOf ||
            !validateCs2Score(exactA, exactB)
          ) {
            return res.status(400).json({
              error: `Nieprawidłowy wynik mapy ` + `${mapNo || "?"}.`,
            });
          }
        }

        // ============================================
        // MAP WINNERS MUST MATCH SERIES
        // ============================================

        const winsA = mapPicks.filter(
          (map) => Number(map.pred_exact_a) > Number(map.pred_exact_b),
        ).length;

        const winsB = mapPicks.filter(
          (map) => Number(map.pred_exact_b) > Number(map.pred_exact_a),
        ).length;

        if (winsA !== predA || winsB !== predB) {
          return res.status(400).json({
            error: "Wyniki map nie zgadzają się z wynikiem serii.",
            code: "server.mapsMismatch",
          });
        }

        // ============================================
        // SERIES CANNOT END TOO EARLY
        // ============================================

        if (!validateSeriesMapOrder(mapPicks, bestOf)) {
          return res.status(400).json({
            error: "Seria kończy się za wcześnie względem podanych map.",
            code: "server.seriesEndsEarly",
          });
        }
      }

      // ============================================
      // BO1
      // ============================================
      else {
        const { winner, score_a, score_b } = req.body;

        if (!["team_a", "team_b"].includes(winner)) {
          return res.status(400).json({
            error: "Nieprawidłowy zwycięzca.",
            code: "server.badWinner",
          });
        }

        const scoreA = Number(score_a);
        const scoreB = Number(score_b);

        if (!validateCs2Score(scoreA, scoreB)) {
          return res.status(400).json({
            error: "Nieprawidłowy wynik CS2.",
            code: "server.badCs2Score",
          });
        }

        if (
          (winner === "team_a" && scoreA <= scoreB) ||
          (winner === "team_b" && scoreB <= scoreA)
        ) {
          return res.status(400).json({
            error: "Wybrany zwycięzca nie zgadza się z wynikiem.",
            code: "server.winnerMismatch",
          });
        }

        predA = winner === "team_a" ? 1 : 0;

        predB = winner === "team_b" ? 1 : 0;

        bo1ExactA = scoreA;
        bo1ExactB = scoreB;
      }

      // ============================================
      // SAVE
      // ============================================

      await runInTransaction(pool, async (conn) => {
        await conn.query(
          `
            INSERT INTO match_predictions (
              match_id,
              guild_id,
              event_id,
              user_id,
              pred_a,
              pred_b,
              pred_exact_a,
              pred_exact_b
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE
              pred_a = VALUES(pred_a),
              pred_b = VALUES(pred_b),
              pred_exact_a = VALUES(pred_exact_a),
              pred_exact_b = VALUES(pred_exact_b),
              updated_at = CURRENT_TIMESTAMP
            `,
          [
            match.id,
            match.guild_id,
            match.event_id,
            user_id,
            predA,
            predB,

            bestOf === 1 ? bo1ExactA : null,

            bestOf === 1 ? bo1ExactB : null,
          ],
        );

        // ============================================
        // BO3 / BO5 MAPS
        // ============================================

        if (bestOf > 1) {
          await conn.query(
            `
              DELETE FROM match_map_predictions
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
                AND user_id = ?
              `,
            [match.guild_id, match.event_id, match.id, user_id],
          );

          const values = mapPicks.map((map) => [
            match.id,
            match.guild_id,
            match.event_id,
            user_id,
            Number(map.map_no),
            Number(map.pred_exact_a),
            Number(map.pred_exact_b),
          ]);

          if (values.length) {
            await conn.query(
              `
                INSERT INTO match_map_predictions (
                  match_id,
                  guild_id,
                  event_id,
                  user_id,
                  map_no,
                  pred_exact_a,
                  pred_exact_b
                )
                VALUES ?
                `,
              [values],
            );
          }
        }

        // ============================================
        // BO1 CLEANUP
        // ============================================

        if (bestOf === 1) {
          await conn.query(
            `
              DELETE FROM match_map_predictions
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
                AND user_id = ?
              `,
            [match.guild_id, match.event_id, match.id, user_id],
          );
        }
      });

      // ============================================
      // RESPONSE
      // ============================================

      return res.json({
        ok: true,

        prediction: {
          match_id: Number(match.id),

          user_id,

          series: {
            pred_a: predA,
            pred_b: predB,
          },

          maps:
            bestOf === 1
              ? [
                {
                  map_no: 1,
                  pred_exact_a: bo1ExactA,
                  pred_exact_b: bo1ExactB,
                },
              ]
              : mapPicks.map((map) => ({
                map_no: Number(map.map_no),

                pred_exact_a: Number(map.pred_exact_a),

                pred_exact_b: Number(map.pred_exact_b),
              })),
        },
      });
    } catch (err) {
      console.error("MATCH PREDICTION SAVE ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się zapisać typu.",
        code: "server.pickSaveFailed",
      });
    }
  });

  app.get("/api/public/matches/:matchId/prediction", async (req, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.session?.user?.id;

      // ============================================
      // AUTH
      // ============================================

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
          code: "server.mustLogin",
        });
      }

      // ============================================
      // MATCH
      // ============================================

      const [[match]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          event_id,
          best_of
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
          code: "server.matchNotFound",
        });
      }

      // ============================================
      // GUILD ACCESS
      // ============================================

      if (!isGuildMember(req.session.user, match.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
          code: "server.notMember",
        });
      }

      // ============================================
      // SERIES PREDICTION
      // ============================================

      const [[prediction]] = await pool.query(
        `
        SELECT
          match_id,
          user_id,
          pred_a,
          pred_b,
          pred_exact_a,
          pred_exact_b
        FROM match_predictions
        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [match.guild_id, match.event_id, match.id, userId],
      );

      if (!prediction) {
        return res.json({
          prediction: null,
        });
      }

      // ============================================
      // MAPS
      // ============================================

      let maps = [];

      if (Number(match.best_of) === 1) {
        maps = [
          {
            map_no: 1,
            pred_exact_a: prediction.pred_exact_a,
            pred_exact_b: prediction.pred_exact_b,
          },
        ];
      } else {
        const [mapRows] = await pool.query(
          `
          SELECT
            map_no,
            pred_exact_a,
            pred_exact_b
          FROM match_map_predictions
          WHERE guild_id = ?
            AND event_id = ?
            AND match_id = ?
            AND user_id = ?
          ORDER BY map_no ASC
          `,
          [match.guild_id, match.event_id, match.id, userId],
        );

        maps = mapRows.map((row) => ({
          map_no: Number(row.map_no),
          pred_exact_a: row.pred_exact_a,
          pred_exact_b: row.pred_exact_b,
        }));
      }

      // ============================================
      // RESPONSE
      // ============================================

      return res.json({
        prediction: {
          match_id: Number(prediction.match_id),

          user_id: prediction.user_id,

          winner:
            Number(prediction.pred_a) > Number(prediction.pred_b)
              ? "team_a"
              : "team_b",

          score_a: prediction.pred_exact_a,

          score_b: prediction.pred_exact_b,

          series: {
            pred_a: Number(prediction.pred_a),

            pred_b: Number(prediction.pred_b),
          },

          maps,
        },
      });
    } catch (err) {
      console.error("MATCH PREDICTION LOAD ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać typu.",
        code: "server.pickLoadFailed",
      });
    }
  });

  app.get("/api/public/events/:eventId/predictions/:userId", async (req, res) => {
    try {
      const { eventId, userId } = req.params;

      const [rows] = await pool.query(
        `
              SELECT
                  mp.match_id,
                  mp.user_id,
                  mp.pred_a,
                  mp.pred_b,
                  mp.pred_exact_a,
                  mp.pred_exact_b,
                  m.best_of
              FROM match_predictions mp
              JOIN matches m
                ON m.id = mp.match_id
              WHERE mp.event_id = ?
                AND mp.user_id = ?
              `,
        [eventId, userId],
      );

      const [mapRows] = await pool.query(
        `
              SELECT
                  match_id,
                  map_no,
                  pred_exact_a,
                  pred_exact_b
              FROM match_map_predictions
              WHERE event_id = ?
                AND user_id = ?
              ORDER BY match_id ASC, map_no ASC
              `,
        [eventId, userId],
      );

      const mapsByMatch = new Map();

      for (const row of mapRows) {
        const matchId = Number(row.match_id);

        if (!mapsByMatch.has(matchId)) {
          mapsByMatch.set(matchId, []);
        }

        mapsByMatch.get(matchId).push({
          map_no: Number(row.map_no),
          pred_exact_a: row.pred_exact_a,
          pred_exact_b: row.pred_exact_b,
        });
      }

      res.json({
        predictions: rows.map((row) => {
          const bestOf = Number(row.best_of || 1);

          const maps =
            bestOf === 1
              ? [
                {
                  map_no: 1,
                  pred_exact_a: row.pred_exact_a,
                  pred_exact_b: row.pred_exact_b,
                },
              ]
              : mapsByMatch.get(Number(row.match_id)) || [];

          return {
            match_id: row.match_id,
            user_id: row.user_id,

            winner: Number(row.pred_a) > Number(row.pred_b) ? "team_a" : "team_b",

            score_a: row.pred_exact_a,
            score_b: row.pred_exact_b,

            series: {
              pred_a: Number(row.pred_a),
              pred_b: Number(row.pred_b),
            },

            maps,
          };
        }),
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Predictions load failed",
      });
    }
  });
}
