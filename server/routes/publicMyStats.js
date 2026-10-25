// Statystyki gracza w turnieju: GET /api/public/events/:slug/my-stats.
//
// Jedna trasa, a najdluzsza w calym publicznym API - stad osobny plik.
// Sklada kilkanascie roznych ujec tego samego zestawu typow: forme,
// serie, styl typowania, trafnosc map, porownanie z tlumem. Kazde liczy
// osobny kalkulator z server/lib, ta trasa je tylko zbiera i podaje
// frontowi w jednej odpowiedzi.
//
// Siedemnascie zaleznosci bierze sie wlasnie z tego: szesnascie to
// kalkulatory i predykaty punktowania, nie zrodla danych.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerPublicMyStatsRoutes(
  app,
  {
    calculateCommunityAnalysis,
    calculateContrarianStats,
    calculateMapAccuracy,
    calculatePlayerStyle,
    calculateRecentForm,
    calculateStreaks,
    calculateTeamStats,
    calculateTrendStats,
    countParticipants,
    getBoStats,
    isGuildMember,
    isMapExact,
    isMapWinnerCorrect,
    isSeriesExact,
    isWinnerCorrect,
    percentageNumber,
    pool,
  },
) {
  app.get("/api/public/events/:slug/my-stats", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
          code: "server.mustLogin",
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
          code: "server.eventNotFound",
        });
      }

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
          code: "server.notMember",
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
      const participantCount = await countParticipants(eventId);

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
}
