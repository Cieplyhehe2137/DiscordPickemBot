// Operacje na pojedynczym meczu: odczyt, dokladne wyniki map, uruchomienie
// oraz dwa endpointy deweloperskie do wpisywania wyniku na zywo.
//
// Trasy /api/dev/* rejestruja sie tylko poza produkcja - to one odpowiadaja
// za roznice miedzy tablica tras w trybie dev i prod.

import { parseStartTimeInput } from "../lib/startTime.js";
import { buildMatchMaps } from "../lib/matchMaps.js";

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
  /*
   * MAPY ROZEGRANE W SERII - to, co zostalo po veto.
   *
   * Tabela `match_maps` stala pusta od poczatku: ma wlasciwy ksztalt, ale
   * nic do niej nie pisalo, wiec serwis nie mowil ani slowa o tym, ze mapa
   * druga to Nuke. Ta trasa jest pierwsza droga, ktora ja wypelnia.
   *
   * PELNA PODMIANA, nie dopisywanie. Panel pokazuje komplet map serii
   * i wysyla komplet, wiec to, czego administrator nie podal, ma zniknac -
   * inaczej skasowanie pomylki wymagaloby osobnego przycisku, a lista
   * w bazie rozjezdzalaby sie z ta na ekranie. Formularz jest wypelniony
   * tym, co juz stoi w bazie (takze wierszami od dostawcy), wiec zwykle
   * wyslanie go niczego nie gubi.
   *
   * Walidacja NIE stoi tutaj, tylko w lib/matchMaps.js - tedy ida obie
   * drogi, ta i skrypt dociagajacy dane. Osobna sciezka obok wspolnej
   * reguly wpuscila juz raz blad na pol roku (patrz lib/startTime.js).
   */
  app.put(
    "/api/matches/:matchId/maps",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { maps } = req.body || {};

        const [[match]] = await pool.query(
          `
          SELECT id, guild_id, event_id, best_of
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

        const wynik = buildMatchMaps({
          bestOf: match.best_of,
          names: maps,
          source: "manual",
        });

        if (!wynik.ok) {
          return res.status(400).json({ error: wynik.reason, code: wynik.code });
        }

        await runInTransaction(pool, async (polaczenie) => {
          await polaczenie.query(`DELETE FROM match_maps WHERE match_id = ?`, [
            match.id,
          ]);

          for (const wiersz of wynik.rows) {
            await polaczenie.query(
              `
              INSERT INTO match_maps
                (guild_id, event_id, match_id, map_no, map_name, picked_by, source)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                match.guild_id,
                match.event_id,
                match.id,
                wiersz.map_no,
                wiersz.map_name,
                wiersz.picked_by,
                wiersz.source,
              ],
            );
          }
        });

        logInfo(
          `MAPY MECZU ${match.id}: ${wynik.rows.length} map` +
            (wynik.unknown.length ? ` (nieznane: ${wynik.unknown.join(", ")})` : ""),
        );

        // NIE WYSYLAMY TU ZDARZENIA PO SOCKETACH i to jest swiadome.
        //
        // Pierwsza wersja wysylala "matchMapsUpdated" - zdarzenia, ktorego
        // NIKT NIE SLUCHA. Jedynym klientem socketow jest front
        // (web/src/lib/socket.js), a on nasluchuje wylacznie
        // "dashboard:refresh". Napisane tak, zeby wygladalo na odswiezanie
        // na zywo, a nie robilo nic.
        //
        // Mapy i tak pojawiaja sie przy nastepnym wejsciu na strone meczu,
        // bo trasa publiczna czyta je prosto z bazy, bez bufora. Veto
        // konczy sie przy starcie serii, wiec kto wtedy patrzy na strone,
        // odswieza ja i tak - po wynik.

        return res.json({
          ok: true,
          maps: wynik.rows,

          // Nazwy spoza znanej puli przechodza, ale panel ma o nich
          // powiedziec - zwykle to literowka, czasem nowa mapa Valve.
          unknown: wynik.unknown,
        });
      } catch (err) {
        logError("MATCH MAPS ERROR:", err);

        return res.status(500).json({
          error: "Nie udalo sie zapisac map.",
          code: "server.mapsSaveFailed",
        });
      }
    },
  );

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
            code: "server.matchNotFound",
          });
        }

        res.json({ match });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
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
          return res.status(404).json({
            error: "Nie znaleziono meczu.",
            code: "server.matchNotFound",
          });
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
          code: "server.dbError",
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
            code: "server.matchNotFound",
          });
        }

        // Ta sama regula, co przy tworzeniu i edycji meczu - patrz
        // lib/startTime.js. Wczesniej szlo tu samo new Date(), ktore sciane
        // zegara bez strefy czyta w strefie PROCESU - czyli po cichu
        // nadawalo jej znaczenie zalezne od hosta.
        const start = parseStartTimeInput(startTimeUtc);

        if (!start.ok) {
          return res.status(400).json({
            error: start.reason,
            code: start.code,
          });
        }

        const startDate = start.utc ? new Date(start.utc + "Z") : null;

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
          [start.utc, shouldLock ? 1 : 0, matchId],
        );

        res.json({
          ok: true,
          match: {
            id: match.id,
            start_time_utc: start.utc,
          },
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );
}
