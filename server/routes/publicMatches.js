// Publiczny widok pojedynczego meczu: sklad spotkania i jego wynik.
//
// Dostepne bez logowania - to sa strony, ktore ludzie wrzucaja linkiem.

export function registerPublicMatchRoutes(
  app,
  {
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
  },
) {
  app.get("/api/public/matches/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.session?.user?.id || null;

      const [wiersze] = await pool.query(buildMatchesWithPickSql("m.id = ?"), [
        userId,
        userId,
        userId,
        matchId,
      ]);

      const match = wiersze[0];

      if (!match) {
        return res.status(404).json({ error: "Nie znaleziono meczu." });
      }

      const [[event]] = await pool.query(
        "SELECT id, name, slug, guild_id FROM events WHERE id = ? LIMIT 1",
        [match.event_id],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const gate = await assertPredictionsAllowed({
        guildId: event.guild_id,
        kind: "MATCHES",
      });

      const wzbogacony = await resolveMatchPredictionState({
        match,
        gate,
        guildId: event.guild_id,
        deadlineCache: new Map(),
      });

      return res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },
        match: wzbogacony,
      });
    } catch (err) {
      console.error("PUBLIC MATCH ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się pobrać meczu.",
      });
    }
  });

  app.get("/api/public/matches/:matchId/result", async (req, res) => {
    try {
      const { matchId } = req.params;

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

      const [[result]] = await pool.query(
        `
        SELECT
          res_a,
          res_b,
          exact_a,
          exact_b
        FROM match_results
        WHERE match_id = ?
          AND guild_id = ?
          AND event_id = ?
        LIMIT 1
        `,
        [match.id, match.guild_id, match.event_id],
      );

      if (!result) {
        return res.status(404).json({
          error: "Match result not found",
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);

      // Mapy czytamy dla KAZDEGO formatu, takze dla BO1. Wczesniej galaz BO1
      // siegala wylacznie po match_results.exact_*, wiec kazdy mecz BO1,
      // ktorego wynik trafil do bazy inna droga niz formularz admina, mial
      // na stronie sama nazwe druzyn bez liczb - tak wygladaly wszystkie
      // 40 meczow BO1 w IEM Cologne 2026 (Swiss stage 1 i 2, po 20),
      // zaimportowanych hurtem.
      const [rows] = await pool.query(
        `
        SELECT
          map_no,
          exact_a,
          exact_b
        FROM match_map_results
        WHERE match_id = ?
          AND guild_id = ?
          AND event_id = ?
        ORDER BY map_no ASC
        `,
        [match.id, match.guild_id, match.event_id],
      );

      const byMap = new Map(rows.map((row) => [Number(row.map_no), row]));

      const maps = [];

      for (let i = 1; i <= maxMaps; i += 1) {
        const row = byMap.get(i);

        maps.push({
          mapNo: i,
          exactA: row?.exact_a ?? null,
          exactB: row?.exact_b ?? null,
        });
      }

      // Przy BO1 match_results.exact_* ma pierwszenstwo: to tam pisze
      // formularz admina, a wiersze map moga byc pozostaloscia po meczu,
      // ktory byl wczesniej BO3 (zmiana formatu nie kasuje starych map).
      if (maxMaps === 1 && result.exact_a != null && result.exact_b != null) {
        maps[0] = {
          mapNo: 1,
          exactA: result.exact_a,
          exactB: result.exact_b,
        };
      }

      return res.json({
        bestOf: Number(match.best_of),
        maxMaps,
        // Wynik serii wprost z match_results. Liczenie go z wygranych map nie
        // wystarcza: zatwierdzenie propozycji zewnetrznego dostawcy zapisuje
        // sam res_a/res_b, bez ani jednej mapy (services/applyMatchResult.js),
        // a wtedy suma wygranych map to 0:0 - liczba nieprawdziwa, pokazana
        // z takim samym przekonaniem jak prawdziwa.
        series: {
          a: result.res_a ?? null,
          b: result.res_b ?? null,
        },
        maps,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  });

  // Przeniesione do server/routes/matchExact.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerMatchExactRoutes(app, {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
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
    registerMatchRoutes,
    registerPhaseResultRoutes,
    requireGuildAdmin,
    restoreBackup,
    runInTransaction,
    safeFileBase,
    sprawdzWynik,
    validateCs2Score,
  });
}
