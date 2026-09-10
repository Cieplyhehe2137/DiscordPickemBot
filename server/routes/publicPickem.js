// Publiczne API typowania: statystyki gracza, typy meczowe i formularze faz.
//
// Czternascie tras - najwieksza ciagla seria, jaka zostala w app.js. Stad
// rozmiar tego pliku: to nie jest jedna dziedzina, tylko jeden ciag rejestracji.
// Pobieranie archiwum na koncu nie ma z typowaniem nic wspolnego, ale lezy
// wewnatrz tej serii, a przeniesienie go gdzie indziej przestawiloby kolejnosc
// rejestracji - czyli zmienilo zachowanie, bo Express bierze pierwsza pasujaca.
//
// Jak w pozostalych modulach tras: rejestracja na `app`, nie przez Router, zeby
// ksztalt tablicy tras sie nie zmienil (npm run routes to sprawdza), a
// zaleznosci przychodza argumentem pod tymi samymi nazwami, ktorych uzywal
// app.js - dzieki temu przeniesiony kod jest niezmieniony poza wcieciem.
//
// Zaleznosci jest tu 32. Przy takiej liczbie latwo jedna przeoczyc, a kontrola
// tras tego nie zobaczy - trasa zarejestruje sie mimo wszystko i wywali dopiero
// przy zapytaniu. Dlatego po kazdym takim przeniesieniu leci npm run lint z
// regula no-undef, ktora widzi to statycznie.

export function registerPublicPickemRoutes(
  app,
  {
    assertPredictionsAllowed,
    calculateCommunityAnalysis,
    calculateContrarianStats,
    calculateMapAccuracy,
    calculatePlayerStyle,
    calculateRecentForm,
    calculateStreaks,
    calculateTeamStats,
    calculateTrendStats,
    fs,
    getBoStats,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    isMapExact,
    isMapWinnerCorrect,
    isMatchDeadlinePassed,
    isMatchLocked,
    isSeriesExact,
    isWinnerCorrect,
    komunikatNaWWW,
    loadActiveTeams,
    matchPanelPhaseFor,
    parseCsvPick,
    path,
    percentageNumber,
    pickemGate,
    policzUczestnikow,
    pool,
    runInTransaction,
    sprawdzTyp,
    validateCs2Score,
    validateSeriesMapOrder,
  },
) {
  app.get("/api/public/events/:slug/my-stats", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug } = req.params;

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

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const guildId = event.guild_id;
      const eventId = event.id;

      // ============================================
      // LICZBA WSZYSTKICH TYPÓW
      // ============================================

      const [[predictionCount]] = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM match_predictions
        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
        `,
        [guildId, eventId, userId],
      );

      const totalPredictions = Number(predictionCount?.total || 0);

      if (!totalPredictions) {
        return res.json({
          event: {
            id: event.id,
            name: event.name,
            slug: event.slug,
          },
          has_data: false,
        });
      }

      // ============================================
      // ROZLICZONE MECZE
      // ============================================

      const [settledRows] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,

          mp.pred_a,
          mp.pred_b,
          mp.pred_exact_a,
          mp.pred_exact_b,

          mr.res_a,
          mr.res_b,
          mr.exact_a,
          mr.exact_b,
          mr.finished_at

        FROM match_predictions mp

        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.guild_id = mp.guild_id
         AND m.event_id = mp.event_id

        INNER JOIN match_results mr
          ON mr.match_id = mp.match_id
         AND mr.guild_id = mp.guild_id
         AND mr.event_id = mp.event_id

        WHERE mp.guild_id = ?
          AND mp.event_id = ?
          AND mp.user_id = ?

        ORDER BY
          mr.finished_at ASC,
          m.id ASC
        `,
        [guildId, eventId, userId],
      );

      const settledMatches = settledRows.length;

      const winnerHits = settledRows.filter(isWinnerCorrect).length;

      const seriesExacts = settledRows.filter(isSeriesExact).length;

      const { current: currentStreak, best: bestStreak } =
        calculateStreaks(settledRows);

      const bo1 = getBoStats(settledRows, 1);
      const bo3 = getBoStats(settledRows, 3);
      const bo5 = getBoStats(settledRows, 5);

      // ============================================
      // MAPY
      // ============================================

      const [mapRowsRaw] = await pool.query(
        `
        SELECT
          p.match_id,
          p.map_no,
          p.pred_exact_a,
          p.pred_exact_b,
          r.exact_a,
          r.exact_b

        FROM match_map_predictions p

        INNER JOIN match_map_results r
          ON r.guild_id = p.guild_id
         AND r.event_id = p.event_id
         AND r.match_id = p.match_id
         AND r.map_no = p.map_no

        WHERE p.guild_id = ?
          AND p.event_id = ?
          AND p.user_id = ?
        `,
        [guildId, eventId, userId],
      );

      const mapRows = [...mapRowsRaw];

      const existingMapKeys = new Set(
        mapRows.map((row) => `${row.match_id}:${row.map_no}`),
      );

      for (const row of settledRows) {
        if (Number(row.best_of) !== 1) {
          continue;
        }

        const key = `${row.match_id}:1`;

        if (existingMapKeys.has(key)) {
          continue;
        }

        if (
          row.pred_exact_a == null ||
          row.pred_exact_b == null ||
          row.exact_a == null ||
          row.exact_b == null
        ) {
          continue;
        }

        mapRows.push({
          match_id: row.match_id,
          map_no: 1,
          pred_exact_a: row.pred_exact_a,
          pred_exact_b: row.pred_exact_b,
          exact_a: row.exact_a,
          exact_b: row.exact_b,
        });

        existingMapKeys.add(key);
      }

      const settledMaps = mapRows.length;

      const mapWinnerHits = mapRows.filter(isMapWinnerCorrect).length;

      const exactMaps = mapRows.filter(isMapExact).length;

      const mapAccuracy = calculateMapAccuracy(mapRows);

      const teamStats = calculateTeamStats(settledRows);

      // ============================================
      // PUNKTY USERA
      // ============================================

      const [[points]] = await pool.query(
        `
        SELECT
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
          ) AS map_points,

          COALESCE(
            SUM(points),
            0
          ) AS total_points

        FROM match_points

        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
        `,
        [guildId, eventId, userId],
      );

      const totalPoints = Number(points?.total_points || 0);

      const seriesPoints = Number(points?.series_points || 0);

      const mapPoints = Number(points?.map_points || 0);

      const averagePoints = settledMatches ? totalPoints / settledMatches : 0;

      // ============================================
      // PUNKTY PER MECZ / TRENDY
      // ============================================

      const [pointsPerMatchRows] = await pool.query(
        `
        SELECT
          match_id,
          COALESCE(SUM(points), 0) AS total_points
        FROM match_points
        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
        GROUP BY match_id
        `,
        [guildId, eventId, userId],
      );

      const pointsByMatch = new Map(
        pointsPerMatchRows.map((row) => [
          String(row.match_id),
          Number(row.total_points || 0),
        ]),
      );

      const trends = calculateTrendStats({
        settledRows,
        mapRows,
        pointsByMatch,
      });

      // ============================================
      // SPOŁECZNOŚĆ
      // ============================================

      const [communityRows] = await pool.query(
        `
        SELECT
          mp.user_id,

          m.id AS match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,

          mp.pred_a,
          mp.pred_b,
          mp.pred_exact_a,
          mp.pred_exact_b,

          mr.res_a,
          mr.res_b,
          mr.exact_a,
          mr.exact_b

        FROM match_predictions mp

        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.guild_id = mp.guild_id
         AND m.event_id = mp.event_id

        INNER JOIN match_results mr
          ON mr.match_id = mp.match_id
         AND mr.guild_id = mp.guild_id
         AND mr.event_id = mp.event_id

        WHERE mp.guild_id = ?
          AND mp.event_id = ?
        `,
        [guildId, eventId],
      );

      const communitySettledMatches = communityRows.length;

      const communityWinnerHits = communityRows.filter(isWinnerCorrect).length;

      const communitySeriesExacts = communityRows.filter(isSeriesExact).length;

      const contrarianStats = calculateContrarianStats(
        settledRows,
        communityRows,
      );

      const communityAnalysis = calculateCommunityAnalysis(communityRows);

      const style = calculatePlayerStyle({
        settledMatches,
        winnerHits,
        seriesExacts,

        settledMaps,
        mapWinnerHits,
        exactMaps,

        contrarianPicks: contrarianStats.contrarianPicks,

        contrarianHits: contrarianStats.contrarianHits,

        majorityPicks: contrarianStats.majorityPicks,

        majorityHits: contrarianStats.majorityHits,
      });

      // ============================================
      // UCZESTNICY / RANKING
      // ============================================

      // Miejsce w klasyfikacji bierzemy z tabeli `leaderboard` - tej samej, ktora
      // karmi strone "Ranking graczy", bota i eksport. Wczesniej liczylo sie to
      // tutaj po swojemu: z samych match_points i tylko wsrod typujacych mecze.
      // Przez to profil pokazywal "Miejsce #1" nawet wtedy, gdy ranking eventu
      // byl jeszcze pusty, i pomijal punkty ze Swiss, Playoffs, Play-In,
      // Double Elim oraz MVP.
      const participantCount = await policzUczestnikow(eventId);

      const [klasyfikacja] = await pool.query(
        `
        SELECT
          CAST(user_id AS CHAR CHARACTER SET utf8mb4)
            COLLATE utf8mb4_unicode_ci AS user_id,
          COALESCE(total_points, 0) AS total_points
        FROM leaderboard
        WHERE event_id = ?
        `,
        [eventId],
      );

      const mojWiersz = klasyfikacja.find(
        (row) => String(row.user_id) === String(userId),
      );

      // Brak wiersza znaczy, ze dla tego gracza nic jeszcze nie zostalo
      // rozliczone. Wtedy nie ma miejsca w klasyfikacji - front pokaze "-"
      // zamiast zmyslac pozycje.
      const rank = mojWiersz
        ? klasyfikacja.filter(
          (row) => Number(row.total_points) > Number(mojWiersz.total_points),
        ).length + 1
        : null;

      const topPercent =
        rank && klasyfikacja.length
          ? Math.max(0.1, (rank / klasyfikacja.length) * 100)
          : null;

      // Srednie spolecznosci zostaja na punktach meczowych, bo zestawiamy je
      // ze statystykami meczowymi gracza (skutecznosc, punkty na mecz).
      const [allPlayerPoints] = await pool.query(
        `
        SELECT
          user_id,
          COALESCE(SUM(points), 0) AS total_points
        FROM match_points
        WHERE guild_id = ?
          AND event_id = ?
        GROUP BY user_id
        `,
        [guildId, eventId],
      );

      const [[matchParticipants]] = await pool.query(
        `
        SELECT COUNT(DISTINCT user_id) AS ilu
        FROM match_predictions
        WHERE guild_id = ?
          AND event_id = ?
        `,
        [guildId, eventId],
      );

      const matchParticipantCount = Number(matchParticipants?.ilu || 0);

      const communityTotalPoints = allPlayerPoints.reduce(
        (sum, row) => sum + Number(row.total_points || 0),
        0,
      );

      const communityAverageTotalPoints = matchParticipantCount
        ? communityTotalPoints / matchParticipantCount
        : 0;

      const communityAveragePoints = communitySettledMatches
        ? communityTotalPoints / communitySettledMatches
        : 0;

      // ============================================
      // NAJLEPSZY MECZ
      // ============================================

      const [[bestMatch]] = await pool.query(
        `
        SELECT
          m.id AS match_id,
          m.match_no,
          m.team_a,
          m.team_b,
          SUM(mp.points) AS points

        FROM match_points mp

        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.guild_id = mp.guild_id
         AND m.event_id = mp.event_id

        WHERE mp.guild_id = ?
          AND mp.event_id = ?
          AND mp.user_id = ?

        GROUP BY
          m.id,
          m.match_no,
          m.team_a,
          m.team_b

        ORDER BY
          points DESC,
          m.match_no ASC,
          m.id ASC

        LIMIT 1
        `,
        [guildId, eventId, userId],
      );

      // ============================================
      // RESPONSE
      // ============================================

      const last5 = calculateRecentForm(settledRows, 5);

      const last10 = calculateRecentForm(settledRows, 10);

      const recentForm = settledRows
        .slice(-10)
        .map((row) => (isWinnerCorrect(row) ? "W" : "L"));

      res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        has_data: true,

        general: {
          total_predictions: totalPredictions,
          settled_matches: settledMatches,

          winner_hits: winnerHits,
          series_exacts: seriesExacts,

          settled_maps: settledMaps,
          map_winner_hits: mapWinnerHits,
          exact_maps: exactMaps,

          total_points: totalPoints,
          series_points: seriesPoints,
          map_points: mapPoints,
          average_points: Number(averagePoints.toFixed(2)),

          rank,
          participant_count: participantCount,
          top_percent:
            topPercent === null ? null : Number(topPercent.toFixed(1)),

          style,
          trends,
        },

        accuracy: {
          winner_hits: winnerHits,
          settled_matches: settledMatches,

          series_exacts: seriesExacts,

          map_winner_hits: mapWinnerHits,
          settled_maps: settledMaps,
          exact_maps: exactMaps,

          bo1,
          bo3,
          bo5,
        },

        form: {
          recent: recentForm,

          last5,
          last10,

          current_streak: currentStreak,
          best_streak: bestStreak,

          best_match: bestMatch
            ? {
              match_id: Number(bestMatch.match_id),
              match_no:
                bestMatch.match_no !== null ? Number(bestMatch.match_no) : null,
              team_a: bestMatch.team_a,
              team_b: bestMatch.team_b,
              points: Number(bestMatch.points || 0),
            }
            : null,
        },

        comparison: {
          rank,
          participant_count: participantCount,
          top_percent:
            topPercent === null ? null : Number(topPercent.toFixed(1)),

          user: {
            winner_accuracy: percentageNumber(winnerHits, settledMatches),

            exact_accuracy: percentageNumber(seriesExacts, settledMatches),

            average_points: Number(averagePoints.toFixed(2)),

            total_points: totalPoints,
          },

          community: {
            winner_accuracy: percentageNumber(
              communityWinnerHits,
              communitySettledMatches,
            ),

            exact_accuracy: percentageNumber(
              communitySeriesExacts,
              communitySettledMatches,
            ),

            average_points: Number(communityAveragePoints.toFixed(2)),

            average_total_points: Number(communityAverageTotalPoints.toFixed(2)),

            settled_predictions: communitySettledMatches,
          },
        },

        analysis: {
          team_stats: teamStats,
          map_accuracy: mapAccuracy,
          community: communityAnalysis,
        },

        style: {
          profile: style,
          contrarian: contrarianStats,
          settled_matches: settledMatches,
        },

        trends,
      });
    } catch (err) {
      console.error("MY STATS ERROR:", err);

      res.status(500).json({
        error: "My stats load failed",
      });
    }
  });

  app.post("/api/public/matches/:matchId/prediction", async (req, res) => {
    try {
      const { matchId } = req.params;
      const user_id = req.session?.user?.id;

      if (!user_id) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
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
        });
      }

      // ============================================
      // GUILD ACCESS
      // ============================================

      if (!isGuildMember(req.session.user, match.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
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
          error: komunikatNaWWW(gate.message, "Typowanie meczów jest aktualnie zamknięte."),
        });
      }

      // ============================================
      // MATCH LOCK
      // ============================================

      if (isMatchLocked(match)) {
        return res.status(403).json({
          error: "Typowanie tego meczu jest już zamknięte.",
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
          });
        }

        // ============================================
        // SERIES CANNOT END TOO EARLY
        // ============================================

        if (!validateSeriesMapOrder(mapPicks, bestOf)) {
          return res.status(400).json({
            error: "Seria kończy się za wcześnie względem podanych map.",
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
          });
        }

        const scoreA = Number(score_a);
        const scoreB = Number(score_b);

        if (!validateCs2Score(scoreA, scoreB)) {
          return res.status(400).json({
            error: "Nieprawidłowy wynik CS2.",
          });
        }

        if (
          (winner === "team_a" && scoreA <= scoreB) ||
          (winner === "team_b" && scoreB <= scoreA)
        ) {
          return res.status(400).json({
            error: "Wybrany zwycięzca nie zgadza się z wynikiem.",
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
        });
      }

      // ============================================
      // GUILD ACCESS
      // ============================================

      if (!isGuildMember(req.session.user, match.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
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


  app.post("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug, stage } = req.params;

      if (!["stage1", "stage2", "stage3"].includes(stage)) {
        return res.status(400).json({
          error: "Nieprawidłowy etap Swiss.",
        });
      }

      const { three_zero, zero_three, advancing } = req.body;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          phase,
          status
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

      /*
       * Discord działa wyłącznie z poziomu gildii,
       * więc WWW również wymaga członkostwa.
       */
      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      /*
       * Ten sam gate co Discord + webowy odpowiednik deadline.
       */
      const gate = await pickemGate(event.guild_id, "SWISS", stage);

      if (!gate.allowed) {
        return res.status(403).json({
          error: komunikatNaWWW(gate.message, "Typowanie tej fazy jest zamknięte."),
        });
      }

      /*
       * AKTUALNY EVENT - Discord robi to przez getOpenEventId().
       *
       * Bez tego zapis szedł na event_id odczytany ze sluga w URL-u, a gate
       * sprawdzał fazę BIEŻĄCEGO eventu. Przy otwartym Swiss 1 dawało się więc
       * wejść pod slugiem starego turnieju i zapisać typ do cudzego event_id.
       * Playoffs, Play-In i Double Elim mają ten sam check; Swiss był jedynym
       * bez niego.
       */
      const currentEventId = await getOpenEventId(pool, event.guild_id);

      if (!currentEventId) {
        return res.status(403).json({
          error: "Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(currentEventId) !== Number(event.id)) {
        return res.status(409).json({
          error:
            "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Swiss.",
        });
      }

      const threeZero = Array.isArray(three_zero) ? three_zero.map(String) : [];

      const zeroThree = Array.isArray(zero_three) ? zero_three.map(String) : [];

      const advancingTeams = Array.isArray(advancing)
        ? advancing.map(String)
        : [];

      /*
       * Liczby drużyn biorą się z konfiguracji TEGO eventu, a nie z liczb
       * wpisanych na sztywno. Event bez konfiguracji dostaje wartości
       * domyślne (2/2/6), czyli zachowanie sprzed tej zmiany.
       */
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        stage,
      );

      const walidacja = sprawdzTyp(stage, limity, {
        x3_0: threeZero,
        x0_3: zeroThree,
        advancing: advancingTeams,
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      const allPicked = [...threeZero, ...zeroThree, ...advancingTeams];

      /*
       * Tak samo jak Discord:
       * jeszcze raz sprawdzamy aktywne drużyny
       * tuż przed zapisem.
       */
      const validTeams = await loadActiveTeams(pool, event.guild_id);

      const invalidTeams = allPicked.filter((team) => !validTeams.includes(team));

      if (invalidTeams.length) {
        return res.status(400).json({
          error: `Unknown or inactive teams: ${invalidTeams.join(", ")}`,
        });
      }

      /*
       * Finalny zapis.
       * WAŻNE: stage musi być zapisany.
       */
      await pool.query(
        `
        INSERT INTO swiss_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          stage,
          pick_3_0,
          pick_0_3,
          advancing,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          pick_3_0 = VALUES(pick_3_0),
          pick_0_3 = VALUES(pick_0_3),
          advancing = VALUES(advancing),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          stage,
          threeZero.join(", "),
          zeroThree.join(", "),
          advancingTeams.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          three_zero: threeZero,
          zero_three: zeroThree,
          advancing: advancingTeams,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Swiss.",
      });
    }
  });

  // Lista drużyn do formularza fazy uzupełniona o drużyny z zapisanego typu.
  //
  // Formularze faz budowały listę wyboru wyłącznie z loadActiveTeams()
  // (active = 1), a typy trzymane są jako nazwy tekstowe. Drużyna wyłączona
  // albo przemianowana PO turnieju znikała z listy, więc historyczny typ nie
  // podświetlał się jako wybrany - gracz oglądał własny typ jako pusty.
  //
  // Dokładamy brakujące nazwy na koniec, oznaczone active: false, żeby widok
  // historyczny pokazywał to, co faktycznie zostało zapisane.
  function withPickedTeams(teams, ...nameLists) {
    const known = new Set((teams || []).map((team) => team.name));
    const missing = [];

    for (const list of nameLists) {
      for (const name of list || []) {
        if (name && !known.has(name)) {
          known.add(name);
          missing.push(name);
        }
      }
    }

    return [
      ...(teams || []).map((team) => ({ ...team, active: true })),
      // ujemne id, żeby nie kolidowały z prawdziwymi (front używa ich jako key)
      ...missing.map((name, index) => ({
        id: -(index + 1),
        name,
        active: false,
      })),
    ];
  }

  app.get("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
    try {
      const { slug, stage } = req.params;
      const userId = req.session?.user?.id || null;

      if (!["stage1", "stage2", "stage3"].includes(stage)) {
        return res.status(400).json({
          error: "Nieprawidłowy etap Swiss.",
        });
      }

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          phase,
          status
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

      let prediction = null;

      if (userId) {
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
          });
        }

        const [[row]] = await pool.query(
          `
          SELECT
            pick_3_0,
            pick_0_3,
            advancing
          FROM swiss_predictions
          WHERE guild_id = ?
            AND event_id = ?
            AND user_id = ?
            AND stage = ?
            AND active = 1
          LIMIT 1
          `,
          [
            event.guild_id,
            event.id,
            userId,
            stage,
          ],
        );

        if (row) {
          prediction = {
            three_zero: parseCsvPick(row.pick_3_0),
            zero_three: parseCsvPick(row.pick_0_3),
            advancing: parseCsvPick(row.advancing),
          };
        }
      }

      const teamNames = await loadActiveTeams(
        pool,
        event.guild_id,
      );

      const teams = withPickedTeams(
        teamNames.map((name, index) => ({ id: index + 1, name })),
        prediction?.three_zero,
        prediction?.zero_three,
        prediction?.advancing,
      );

      const gate = await pickemGate(
        event.guild_id,
        "SWISS",
        stage,
      );

      return res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        stage,

        teams,

        // Limity z konfiguracji TEGO eventu - front nie ma ich już zaszytych.
        limity: await getPhaseLimits(pool, event.guild_id, event.id, stage),

        prediction,

        lock: {
          allowed: Boolean(gate.allowed),
          message: gate.allowed
            ? null
            : komunikatNaWWW(gate.message, "Typowanie tej fazy jest zamknięte."),
        },
      });
    } catch (err) {
      console.error("SWISS PICKEM LOAD ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać typów Swiss.",
      });
    }
  });


  app.get("/api/public/events/:slug/swiss-stats/:stage", async (req, res) => {
    try {
      const { slug, stage } = req.params;

      if (!["stage1", "stage2", "stage3"].includes(stage)) {
        return res.status(400).json({
          error: "Nieprawidłowy etap Swiss.",
        });
      }

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug
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

      const [rows] = await pool.query(
        `
              SELECT pick_3_0, pick_0_3, advancing
              FROM swiss_predictions
              WHERE event_id = ?
                AND stage = ?
                AND active = 1
              `,
        [event.id, stage],
      );

      function countCsvValues(values) {
        const counts = new Map();

        values.forEach((value) => {
          if (!value) return;

          String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach((team) => {
              counts.set(team, (counts.get(team) || 0) + 1);
            });
        });

        return [...counts.entries()]
          .map(([team, count]) => ({
            team,
            count,
            percentage:
              rows.length > 0 ? Math.round((count / rows.length) * 100) : 0,
          }))
          .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
      }

      res.json({
        event,
        stage,
        total_predictions: rows.length,
        stats: {
          three_zero: countCsvValues(rows.map((row) => row.pick_3_0)),
          zero_three: countCsvValues(rows.map((row) => row.pick_0_3)),
          advancing: countCsvValues(rows.map((row) => row.advancing)),
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać statystyk Swiss.",
      });
    }
  });


  app.get("/api/public/events/:slug/playin-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id || null;
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug, status
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

      const gate = await pickemGate(event.guild_id, "PLAYIN");

      const [teams] = await pool.query(
        `
              SELECT id, name
              FROM teams
              WHERE guild_id = ?
                AND active = 1
              ORDER BY name ASC
              `,
        [event.guild_id],
      );

      let prediction = null;

      if (userId) {
        // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
        // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
        // endpointy jako jedyne pozwalały odpytać event obcego serwera.
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
          });
        }

        const [[row]] = await pool.query(
          `
                  SELECT teams
                  FROM playin_predictions
                  WHERE guild_id = ?
                  AND event_id = ?
                    AND user_id = ?
                    AND active = 1
                  LIMIT 1
                  `,
          [event.guild_id, event.id, userId],
        );

        if (row) {
          prediction = {
            teams: parseCsvPick(row.teams),
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(teams, prediction?.teams),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "playin"),

        prediction,
        lock: {
          allowed: gate.allowed,
          message: komunikatNaWWW(gate.message, null),
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać typów Play-In.",
      });
    }
  });

  app.post("/api/public/events/:slug/playin-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug } = req.params;
      const { teams } = req.body;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          status
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

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const gate = await pickemGate(event.guild_id, "PLAYIN");

      if (!gate.allowed) {
        return res.status(403).json({
          error: komunikatNaWWW(gate.message, "Typowanie Play-In jest zamknięte."),
        });
      }

      // ============================================
      // AKTUALNY EVENT - zgodność z Discordem 1:1
      // ============================================

      const currentEventId = await getOpenEventId(pool, event.guild_id);

      if (!currentEventId) {
        return res.status(403).json({
          error: "Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(currentEventId) !== Number(event.id)) {
        return res.status(409).json({
          error:
            "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Play-In.",
        });
      }

      // ============================================
      // WYBÓR DRUŻYN
      // ============================================

      const selectedTeams = Array.isArray(teams)
        ? teams
          .map((team) => String(team).trim())
          .filter(Boolean)
        : [];

      // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
      // czyli zachowanie sprzed tej zmiany).
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "playin",
      );

      const walidacja = sprawdzTyp(limity && "playin", limity, { teams: selectedTeams });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      // ============================================
      // AKTYWNE DRUŻYNY
      // ============================================

      const validTeamNames = await loadActiveTeams(pool, event.guild_id);

      const validTeams = new Set(validTeamNames);

      const invalidTeams = selectedTeams.filter((team) => !validTeams.has(team));

      if (invalidTeams.length > 0) {
        return res.status(400).json({
          error: `Invalid teams: ${invalidTeams.join(", ")}`,
        });
      }

      // ============================================
      // ZAPIS
      // ============================================

      await pool.query(
        `
        INSERT INTO playin_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          teams,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          teams = VALUES(teams),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          selectedTeams.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          teams: selectedTeams,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Play-In.",
      });
    }
  });

  app.get("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id || null;
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug, status
              FROM events
              WHERE slug = ?
              LIMIT 1
              `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const gate = await pickemGate(event.guild_id, "PLAYOFFS");

      const [teams] = await pool.query(
        `
              SELECT id, name
              FROM teams
              WHERE guild_id = ?
                AND active = 1
              ORDER BY name ASC
              `,
        [event.guild_id],
      );

      let prediction = null;

      if (userId) {
        // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
        // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
        // endpointy jako jedyne pozwalały odpytać event obcego serwera.
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
          });
        }

        const [[row]] = await pool.query(
          `
                  SELECT semifinalists, finalists, winner, third_place_winner
                  FROM playoffs_predictions
                  WHERE event_id = ?
                    AND user_id = ?
                    AND active = 1
                  LIMIT 1
                  `,
          [event.id, userId],
        );

        if (row) {
          prediction = {
            semifinalists: parseCsvPick(row.semifinalists),
            finalists: parseCsvPick(row.finalists),
            winner: row.winner || null,
            third_place_winner: row.third_place_winner || null,
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(
          teams,
          prediction?.semifinalists,
          prediction?.finalists,
          prediction?.winner ? [prediction.winner] : [],
          prediction?.third_place_winner ? [prediction.third_place_winner] : [],
        ),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "playoffs"),

        prediction,
        lock: {
          allowed: gate.allowed,
          message: komunikatNaWWW(gate.message, null),
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się wczytać typów Playoffs." });
    }
  });

  app.post("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug } = req.params;

      const { semifinalists, finalists, winner, third_place_winner } = req.body;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          status
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

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      // ============================================
      // GATE
      // ============================================

      const gate = await pickemGate(event.guild_id, "PLAYOFFS");

      if (!gate.allowed) {
        return res.status(403).json({
          error: komunikatNaWWW(gate.message, "Typowanie Playoffs jest zamknięte."),
        });
      }

      // ============================================
      // AKTUALNY EVENT
      // Discord robi to przez getOpenEventId()
      // ============================================

      const currentEventId = await getOpenEventId(pool, event.guild_id);

      if (!currentEventId) {
        return res.status(403).json({
          error: "Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(currentEventId) !== Number(event.id)) {
        return res.status(409).json({
          error:
            "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Playoffs.",
        });
      }

      // ============================================
      // NORMALIZACJA
      // ============================================

      const normalizeTeams = (value) =>
        Array.isArray(value)
          ? value.map((team) => String(team).trim()).filter(Boolean)
          : [];

      const semifinalistsPick = normalizeTeams(semifinalists);
      const finalistsPick = normalizeTeams(finalists);

      const winnerPick = winner ? String(winner).trim() : null;

      // 3. miejsce jest OPCJONALNE
      const thirdPick = third_place_winner
        ? String(third_place_winner).trim()
        : null;
      // ============================================
      // LICZBA WYBORÓW I DUPLIKATY
      // ============================================
      //
      // Limity z konfiguracji TEGO eventu. sprawdzTyp celowo NIE wymusza tu
      // unikalności między grupami - Playoffs to hierarchia, więc finaliści
      // powtarzają się w półfinalistach, a zwycięzca w finalistach. Zależności
      // drabinki sprawdzamy niżej, bo to reguła formatu, nie liczba drużyn.

      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "playoffs",
      );

      const walidacja = sprawdzTyp("playoffs", limity, {
        semifinalists: semifinalistsPick,
        finalists: finalistsPick,
        winner: winnerPick ? [winnerPick] : [],
        third: thirdPick ? [thirdPick] : [],
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      // ============================================
      // LOGIKA DRABINKI 1:1 Z DISCORDEM
      // ============================================

      if (!finalistsPick.includes(winnerPick)) {
        return res.status(400).json({
          error: "Zwycięzca musi być jednym z finalistów.",
        });
      }

      for (const finalist of finalistsPick) {
        if (!semifinalistsPick.includes(finalist)) {
          return res.status(400).json({
            error: "Finaliści muszą pochodzić z półfinalistów.",
          });
        }
      }

      if (thirdPick && [winnerPick, ...finalistsPick].includes(thirdPick)) {
        return res.status(400).json({
          error: "3. miejsce nie może być finalistą ani zwycięzcą.",
        });
      }

      if (thirdPick && !semifinalistsPick.includes(thirdPick)) {
        return res.status(400).json({
          error: "3. miejsce musi być jednym z półfinalistów.",
        });
      }

      // ============================================
      // AKTYWNE DRUŻYNY
      // ============================================

      const teamNames = await loadActiveTeams(pool, event.guild_id);

      const allowed = new Set(teamNames);

      const allPicked = [
        ...semifinalistsPick,
        ...finalistsPick,
        winnerPick,
        ...(thirdPick ? [thirdPick] : []),
      ];

      const invalid = [
        ...new Set(allPicked.filter((team) => !allowed.has(team))),
      ];

      if (invalid.length) {
        return res.status(400).json({
          error: `Unknown or inactive teams: ${invalid.join(", ")}`,
        });
      }

      // ============================================
      // SAVE
      // ============================================

      await pool.query(
        `
        INSERT INTO playoffs_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          semifinalists,
          finalists,
          winner,
          third_place_winner,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          semifinalists = VALUES(semifinalists),
          finalists = VALUES(finalists),
          winner = VALUES(winner),
          third_place_winner = VALUES(third_place_winner),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          semifinalistsPick.join(", "),
          finalistsPick.join(", "),
          winnerPick,
          thirdPick,
        ],
      );

      res.json({
        ok: true,

        prediction: {
          semifinalists: semifinalistsPick,
          finalists: finalistsPick,
          winner: winnerPick,
          third_place_winner: thirdPick,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Playoffs.",
      });
    }
  });

  app.get("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id || null;
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug, status
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

      const gate = await pickemGate(event.guild_id, "DOUBLEELIM");

      const [teams] = await pool.query(
        `
              SELECT id, name
              FROM teams
              WHERE guild_id = ?
                AND active = 1
              ORDER BY name ASC
              `,
        [event.guild_id],
      );

      let prediction = null;

      if (userId) {
        // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
        // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
        // endpointy jako jedyne pozwalały odpytać event obcego serwera.
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
          });
        }

        const [[row]] = await pool.query(
          `
                  SELECT
                      upper_final_a,
                      lower_final_a,
                      upper_final_b,
                      lower_final_b
                  FROM doubleelim_predictions
                  WHERE guild_id = ?
    AND event_id = ?
    AND user_id = ?
    AND active = 1
                  LIMIT 1
                  `,
          [event.guild_id, event.id, userId],
        );

        if (row) {
          prediction = {
            upper_final_a: parseCsvPick(row.upper_final_a),
            lower_final_a: parseCsvPick(row.lower_final_a),
            upper_final_b: parseCsvPick(row.upper_final_b),
            lower_final_b: parseCsvPick(row.lower_final_b),
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(
          teams,
          prediction?.upper_final_a,
          prediction?.lower_final_a,
          prediction?.upper_final_b,
          prediction?.lower_final_b,
        ),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "doubleelim"),

        prediction,
        lock: {
          allowed: gate.allowed,
          message: komunikatNaWWW(gate.message, null),
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać typów Double Elimination.",
      });
    }
  });

  app.post("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
        });
      }

      const { slug } = req.params;

      const { upper_final_a, lower_final_a, upper_final_b, lower_final_b } =
        req.body;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id
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

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      // ============================================
      // GATE
      // ============================================

      const gate = await pickemGate(event.guild_id, "DOUBLEELIM");

      if (!gate.allowed) {
        return res.status(403).json({
          error: komunikatNaWWW(gate.message, "Typowanie Double Elimination jest zamknięte."),
        });
      }

      // ============================================
      // AKTUALNY EVENT
      // ============================================

      const currentEventId = await getOpenEventId(pool, event.guild_id);

      if (!currentEventId) {
        return res.status(403).json({
          error: "Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(currentEventId) !== Number(event.id)) {
        return res.status(409).json({
          error:
            "Ten formularz dotyczy poprzedniego eventu. " +
            "Otwórz aktualny panel Double Elimination.",
        });
      }

      // ============================================
      // NORMALIZACJA
      // ============================================

      const normalizeTeams = (value) =>
        Array.isArray(value)
          ? value.map((team) => String(team).trim()).filter(Boolean)
          : [];

      const ufa = normalizeTeams(upper_final_a);
      const lfa = normalizeTeams(lower_final_a);
      const ufb = normalizeTeams(upper_final_b);
      const lfb = normalizeTeams(lower_final_b);

      // ============================================
      // KAŻDY SLOT = DOKŁADNIE 2 DRUŻYNY
      // ============================================

      // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
      // czyli zachowanie sprzed tej zmiany).
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "doubleelim",
      );

      const walidacja = sprawdzTyp(limity && "doubleelim", limity, {
        upperFinalA: ufa,
        lowerFinalA: lfa,
        upperFinalB: ufb,
        lowerFinalB: lfb,
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      const allTeams = [...ufa, ...lfa, ...ufb, ...lfb];

      // ============================================
      // TYLKO AKTYWNE DRUŻYNY
      // ============================================

      const teamNames = await loadActiveTeams(pool, event.guild_id);

      const validTeams = new Set(teamNames);

      const invalidTeams = [
        ...new Set(allTeams.filter((team) => !validTeams.has(team))),
      ];

      if (invalidTeams.length > 0) {
        return res.status(400).json({
          error: `Invalid teams: ${invalidTeams.join(", ")}`,
        });
      }

      // ============================================
      // SAVE
      // ============================================

      await pool.query(
        `
        INSERT INTO doubleelim_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          upper_final_a,
          lower_final_a,
          upper_final_b,
          lower_final_b,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          upper_final_a = VALUES(upper_final_a),
          lower_final_a = VALUES(lower_final_a),
          upper_final_b = VALUES(upper_final_b),
          lower_final_b = VALUES(lower_final_b),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          ufa.join(", "),
          lfa.join(", "),
          ufb.join(", "),
          lfb.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          upper_final_a: ufa,
          lower_final_a: lfa,
          upper_final_b: ufb,
          lower_final_b: lfb,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Double Elimination.",
      });
    }
  });

  app.get("/api/public/archives/:id/download", async (req, res) => {
    try {
      const { id } = req.params;

      const [[archive]] = await pool.query(
        `
              SELECT *
              FROM archive_files
              WHERE id = ?
              LIMIT 1
              `,
        [id],
      );

      if (!archive) {
        return res.status(404).json({
          error: "Archive not found",
        });
      }

      const dbPath = archive.path;

      const rebuiltPath = path.join(
        process.cwd(),
        "archiwum",
        String(archive.guild_id),
        archive.filename,
      );

      const finalPath = fs.existsSync(dbPath) ? dbPath : rebuiltPath;

      if (!fs.existsSync(finalPath)) {
        return res.status(404).json({
          error: "Archive file missing",
        });
      }

      return res.download(finalPath, archive.filename);
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: "Download failed",
      });
    }
  });
}
