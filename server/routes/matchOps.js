// Operacje na pojedynczym meczu: odczyt, dokladne wyniki map, uruchomienie
// oraz dwa endpointy deweloperskie do wpisywania wyniku na zywo.
//
// Trasy /api/dev/* rejestruja sie tylko poza produkcja - to one odpowiadaja
// za roznice miedzy tablica tras w trybie dev i prod.

export function registerMatchOpsRoutes(
  app,
  {
    checkPickemGate,
    countParticipants,
    createGuildBackup,
    listGuildBackups,
    resolveMatchPredictionState,
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    assertPredictionsAllowed,
    assertSafeBackupFileName,
    buildMatchesWithPickSql,
    calculateCommunityAnalysis,
    calculateContrarianStats,
    calculateMapAccuracy,
    calculatePlayerStyle,
    calculateRecentForm,
    calculateScores,
    calculateStreaks,
    calculateTeamStats,
    calculateTrendStats,
    emitDashboardRefresh,
    exportClassification,
    fs,
    getBoStats,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    getCurrentSwissResults,
    getLockBeforeSec,
    getOpenEventId,
    getPhaseLimits,
    guildIdFromEventSlug,
    guildIdFromMatchId,
    guildRegistry,
    io,
    isGuildMember,
    isMapExact,
    isMapWinnerCorrect,
    isMatchDeadlinePassed,
    isMatchLocked,
    isMatchStarted,
    isSeriesExact,
    isWinnerCorrect,
    loadActiveTeams,
    logError,
    logInfo,
    logWarn,
    matchPanelPhaseFor,
    matchesStore,
    maxMapsFromBo,
    parseCsvPick,
    path,
    percentageNumber,
    pool,
    recalculateMatchPoints,
    registerBackupRoutes,
    registerEventAdminRoutes,
    registerEventCleanupRoutes,
    registerMatchExactRoutes,
    registerMatchRoutes,
    registerPhaseResultRoutes,
    registerPublicMatchRoutes,
    registerPublicPickemRoutes,
    requireGuildAdmin,
    restoreBackup,
    runInTransaction,
    safeFileBase,
    sprawdzTyp,
    sprawdzWynik,
    toWebMessage,
    validateCs2Score,
    validateSeriesMapOrder,
  },
) {
  app.get(
    "/api/matches/:matchId",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { guildId } = req;

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
          return res.status(404).json({
            error: "Nie znaleziono meczu.",
          });
        }

        res.json({ match });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.get(
    "/api/matches/:matchId/exact",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { guildId } = req;

        const match = await matchesStore.getMatchById(pool, guildId, matchId);

        if (!match) {
          return res.status(404).json({ error: "Nie znaleziono meczu." });
        }

        const maxMaps = maxMapsFromBo(match.best_of);
        const maps = [];

        if (maxMaps === 1) {
          const [[row]] = await pool.query(
            "SELECT exact_a, exact_b FROM match_results WHERE match_id = ? AND guild_id = ? LIMIT 1",
            [matchId, guildId],
          );

          maps.push({
            mapNo: 1,
            exactA: row?.exact_a ?? null,
            exactB: row?.exact_b ?? null,
          });
        } else {
          const [rows] = await pool.query(
            "SELECT map_no, exact_a, exact_b FROM match_map_results WHERE match_id = ? AND guild_id = ?",
            [matchId, guildId],
          );

          const byMap = new Map(rows.map((r) => [Number(r.map_no), r]));

          for (let i = 1; i <= maxMaps; i += 1) {
            const r = byMap.get(i);
            maps.push({
              mapNo: i,
              exactA: r?.exact_a ?? null,
              exactB: r?.exact_b ?? null,
            });
          }
        }

        res.json({ bestOf: match.best_of, maxMaps, maps });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  // Pojedynczy mecz w tym samym ksztalcie co element listy.
  //
  // Bez tego strona meczu wolala /api/events/:slug/matches i szukala jednego
  // meczu w calej tablicy - przy 106 meczach kazde wejscie i kazde odswiezenie
  // po zdarzeniu realtime ciagnelo pelna liste.
  //
  // Publiczny, bo dokladnie te dane pokazuje lista meczow, ktora tez jest
  // publiczna. Typ gracza (pred_*) dokleja sie tylko dla zalogowanego -
  // zapytanie joinuje match_predictions po user_id z sesji.
  // Przeniesione do server/routes/publicMatches.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerPublicMatchRoutes(app, {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    assertPredictionsAllowed,
    assertSafeBackupFileName,
    calculateScores,
    createGuildBackup,
    emitDashboardRefresh,
    exportClassification,
    fs,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    getCurrentSwissResults,
    getLockBeforeSec,
    getPhaseLimits,
    guildIdFromEventSlug,
    guildIdFromMatchId,
    guildRegistry,
    io,
    isMatchStarted,
    listGuildBackups,
    loadActiveTeams,
    logError,
    logInfo,
    logWarn,
    matchesStore,
    maxMapsFromBo,
    path,
    pool,
    recalculateMatchPoints,
    registerBackupRoutes,
    registerEventAdminRoutes,
    registerEventCleanupRoutes,
    registerMatchExactRoutes,
    registerMatchRoutes,
    registerPhaseResultRoutes,
    requireGuildAdmin,
    restoreBackup,
    runInTransaction,
    safeFileBase,
    sprawdzWynik,
    buildMatchesWithPickSql,
    resolveMatchPredictionState,
    validateCs2Score,
  });


  app.post(
    "/api/dev/matches/:matchId/score",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { score_a, score_b } = req.body;

        await pool.query(
          `
    INSERT INTO live_match_scores (match_id, score_a, score_b)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      score_a = VALUES(score_a),
      score_b = VALUES(score_b),
      updated_at = CURRENT_TIMESTAMP
    `,
          [matchId, score_a, score_b],
        );

        io.emit("match:score_updated", {
          matchId: Number(matchId),
          score_a: Number(score_a),
          score_b: Number(score_b),
          current_map: 1,
          live_status: "LIVE",
          ui_status: "LIVE",
        });

        res.json({
          ok: true,
          matchId: Number(matchId),
          score_a: Number(score_a),
          score_b: Number(score_b),
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Score update failed",
        });
      }
    },
  );

  app.post(
    "/api/dev/matches/:matchId/final",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;

        await pool.query(
          `
              UPDATE live_match_scores
              SET status = 'FINAL',
                  updated_at = CURRENT_TIMESTAMP
              WHERE match_id = ?
              `,
          [matchId],
        );

        const [[liveScore]] = await pool.query(
          `
      SELECT score_a, score_b, current_map
      FROM live_match_scores
      WHERE match_id = ?
      LIMIT 1
      `,
          [matchId],
        );

        io.emit("match:score_updated", {
          matchId: Number(matchId),

          score_a: Number(liveScore?.score_a || 0),
          score_b: Number(liveScore?.score_b || 0),

          current_map: Number(liveScore?.current_map || 1),

          live_status: "FINAL",
          ui_status: "FINAL",
        });

        res.json({
          ok: true,
          matchId: Number(matchId),
          status: "FINAL",
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Final update failed",
        });
      }
    },
  );


  // Publiczne trasy typowania siedza w server/routes/publicPickem.js.
  // Wywolanie stoi tam, gdzie byly - kolejnosc rejestracji jest zachowaniem.
  registerPublicPickemRoutes(app, {
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
    toWebMessage,
    loadActiveTeams,
    matchPanelPhaseFor,
    parseCsvPick,
    path,
    percentageNumber,
    checkPickemGate,
    countParticipants,
    pool,
    runInTransaction,
    sprawdzTyp,
    validateCs2Score,
    validateSeriesMapOrder,
  });

  app.post(
    "/api/matches/:matchId/start",
    requireGuildAdmin(async (req) => {
      const { matchId } = req.params;

      const [[match]] = await pool.query(
        `
        SELECT guild_id
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      return match?.guild_id || null;
    }),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { startTimeUtc } = req.body;

        const [[match]] = await pool.query(
          `
          SELECT id, guild_id, team_a, team_b
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

        const startDate = startTimeUtc ? new Date(startTimeUtc) : null;

        if (startDate && Number.isNaN(startDate.getTime())) {
          return res.status(400).json({
            error: "Invalid start time",
          });
        }

        const lockBeforeSec = getLockBeforeSec();

        const shouldLock =
          startDate !== null &&
          isMatchStarted({ start_time_utc: startDate }, undefined, lockBeforeSec);

        await pool.query(
          `
    UPDATE matches
    SET
      start_time_utc = ?,
      is_locked = ?
    WHERE id = ?
    `,
          [startDate, shouldLock ? 1 : 0, matchId],
        );

        res.json({
          ok: true,
          match: {
            id: match.id,
            start_time_utc: startTimeUtc || null,
          },
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );
}
