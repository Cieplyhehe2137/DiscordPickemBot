// Zapis dokladnych wynikow map dla meczu (panel administratora).
//
// Jedna trasa, ale gruba: waliduje kazdy wynik mapy wzgledem regul CS2,
// sprawdza kolejnosc map w serii, a potem przelicza punkty wszystkim, ktorzy
// ten mecz wytypowali.

export function registerMatchExactRoutes(
  app,
  {
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
  },
) {
  app.post(
    "/api/matches/:matchId/exact",
    requireGuildAdmin(guildIdFromMatchId),
    async (req, res) => {
      try {
        const { matchId } = req.params;
        const { guildId } = req;

        const match = await matchesStore.getMatchById(
          pool,
          guildId,
          matchId,
        );

        if (!match) {
          return res.status(404).json({
            error: "Nie znaleziono meczu.",
          });
        }

        if (!match.event_id) {
          return res.status(400).json({
            error: "Match has no event_id",
          });
        }

        const maxMaps = maxMapsFromBo(match.best_of);

        if (![1, 3, 5].includes(Number(match.best_of))) {
          return res.status(400).json({
            error: `Nieobsługiwany format BO${match.best_of}.`,
          });
        }

        const inputMaps = Array.isArray(req.body.maps)
          ? req.body.maps
          : [];

        const clean = [];

        // ============================================
        // NORMALIZACJA + PODSTAWOWA WALIDACJA
        // ============================================

        for (const map of inputMaps) {
          const mapNo = Number(map.mapNo);
          const exactA = Number(map.exactA);
          const exactB = Number(map.exactB);

          if (
            !Number.isInteger(mapNo) ||
            mapNo < 1 ||
            mapNo > maxMaps
          ) {
            return res.status(400).json({
              error: `Invalid mapNo: ${map.mapNo}`,
            });
          }

          if (!validateCs2Score(exactA, exactB)) {
            return res.status(400).json({
              error: `Mapa ${mapNo}: nieprawidłowy wynik CS2.`,
            });
          }

          clean.push({
            mapNo,
            exactA,
            exactB,
          });
        }

        if (!clean.length) {
          return res.status(400).json({
            error: "No map scores provided",
          });
        }

        const uniqueMapNos = new Set(
          clean.map((map) => map.mapNo),
        );

        if (uniqueMapNos.size !== clean.length) {
          return res.status(400).json({
            error: "Numery map nie mogą się powtarzać.",
          });
        }

        const sortedMaps = [...clean].sort(
          (a, b) => a.mapNo - b.mapNo,
        );

        // ============================================
        // KOLEJNOŚĆ MAP
        // ============================================

        for (
          let index = 0;
          index < sortedMaps.length;
          index += 1
        ) {
          if (sortedMaps[index].mapNo !== index + 1) {
            return res.status(400).json({
              error:
                "Numery map muszą być kolejne: 1, 2, 3...",
            });
          }
        }

        let finalResA = 0;
        let finalResB = 0;

        // ============================================
        // BO1
        // ============================================

        if (maxMaps === 1) {
          if (sortedMaps.length !== 1) {
            return res.status(400).json({
              error: "BO1 musi zawierać dokładnie jedną mapę.",
            });
          }

          const { exactA, exactB } = sortedMaps[0];

          finalResA = exactA > exactB ? 1 : 0;
          finalResB = exactB > exactA ? 1 : 0;
        }

        // ============================================
        // BO3 / BO5
        // ============================================

        else {
          const winsNeeded = Math.ceil(
            Number(match.best_of) / 2,
          );

          let resA = 0;
          let resB = 0;

          for (
            let index = 0;
            index < sortedMaps.length;
            index += 1
          ) {
            const { mapNo, exactA, exactB } =
              sortedMaps[index];

            if (exactA > exactB) {
              resA += 1;
            } else {
              resB += 1;
            }

            const seriesFinished =
              resA === winsNeeded ||
              resB === winsNeeded;

            if (
              seriesFinished &&
              index !== sortedMaps.length - 1
            ) {
              return res.status(400).json({
                error:
                  `Seria zakończyła się już po mapie ${mapNo}.`,
              });
            }
          }

          if (
            resA !== winsNeeded &&
            resB !== winsNeeded
          ) {
            return res.status(400).json({
              error:
                `Seria BO${match.best_of} nie jest jeszcze zakończona.`,
            });
          }

          finalResA = resA;
          finalResB = resB;
        }

        // ============================================
        // TRANSACTION
        // ============================================

        await runInTransaction(
          pool,
          async (conn) => {
            // BO1
            if (maxMaps === 1) {
              const { exactA, exactB } =
                sortedMaps[0];

              await conn.query(
                `
                INSERT INTO match_results (
                  guild_id,
                  event_id,
                  match_id,
                  res_a,
                  res_b,
                  exact_a,
                  exact_b,
                  finished_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

                ON DUPLICATE KEY UPDATE
                  event_id = VALUES(event_id),
                  res_a = VALUES(res_a),
                  res_b = VALUES(res_b),
                  exact_a = VALUES(exact_a),
                  exact_b = VALUES(exact_b),
                  finished_at = CURRENT_TIMESTAMP
                `,
                [
                  guildId,
                  match.event_id,
                  matchId,
                  finalResA,
                  finalResB,
                  exactA,
                  exactB,
                ],
              );
            }

            // BO3 / BO5
            else {
              await conn.query(
                `
                DELETE FROM match_map_results
                WHERE guild_id = ?
                  AND event_id = ?
                  AND match_id = ?
                `,
                [
                  guildId,
                  match.event_id,
                  matchId,
                ],
              );

              for (const {
                mapNo,
                exactA,
                exactB,
              } of sortedMaps) {
                await conn.query(
                  `
                  INSERT INTO match_map_results (
                    guild_id,
                    event_id,
                    match_id,
                    map_no,
                    exact_a,
                    exact_b
                  )
                  VALUES (?, ?, ?, ?, ?, ?)
                  `,
                  [
                    guildId,
                    match.event_id,
                    matchId,
                    mapNo,
                    exactA,
                    exactB,
                  ],
                );
              }

              await conn.query(
                `
                INSERT INTO match_results (
                  guild_id,
                  event_id,
                  match_id,
                  res_a,
                  res_b,
                  finished_at
                )
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

                ON DUPLICATE KEY UPDATE
                  event_id = VALUES(event_id),
                  res_a = VALUES(res_a),
                  res_b = VALUES(res_b),
                  exact_a = NULL,
                  exact_b = NULL,
                  finished_at = CURRENT_TIMESTAMP
                `,
                [
                  guildId,
                  match.event_id,
                  matchId,
                  finalResA,
                  finalResB,
                ],
              );
            }

            // ============================================
            // LOCK
            // ============================================

            await conn.query(
              `
              UPDATE matches
              SET is_locked = 1
              WHERE guild_id = ?
                AND event_id = ?
                AND id = ?
              `,
              [
                guildId,
                match.event_id,
                matchId,
              ],
            );

            // ============================================
            // POINTS
            // ============================================

            await recalculateMatchPoints(
              conn,
              guildId,
              match.event_id,
              matchId,
              match.best_of,
            );
          },
        );

        // ============================================
        // REALTIME — PO COMMIT
        // ============================================

        const [[eventRow]] = await pool.query(
          `
          SELECT slug
          FROM events
          WHERE guild_id = ?
            AND id = ?
          LIMIT 1
          `,
          [
            guildId,
            match.event_id,
          ],
        );

        emitDashboardRefresh({
          slug: eventRow?.slug ?? null,
          guildId,
          eventId: match.event_id,
          matchId: Number(matchId),
          phase: match.phase,
          reason: "match_finished",
        });

        return res.json({
          ok: true,

          result: {
            res_a: finalResA,
            res_b: finalResB,
          },

          maps: sortedMaps,
        });
      } catch (err) {
        console.error(
          "ADMIN MATCH EXACT SAVE ERROR:",
          err,
        );

        return res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  // Wyniki faz siedza w server/routes/phaseResults.js. Wywolanie stoi tam,
  // gdzie byly trasy - kolejnosc rejestracji jest zachowaniem.
  registerPhaseResultRoutes(app, {
    calculateScores,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    getCurrentSwissResults,
    getPhaseLimits,
    guildIdFromEventSlug,
    io,
    loadActiveTeams,
    pool,
    requireGuildAdmin,
    runInTransaction,
    sprawdzWynik,
  });

  // Lista zakończonych turniejów danej gildii (archiwum).
  // Przeniesione do server/routes/backups.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerBackupRoutes(app, {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    assertSafeBackupFileName,
    createGuildBackup,
    emitDashboardRefresh,
    fs,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    listGuildBackups,
    logError,
    logInfo,
    logWarn,
    path,
    pool,
    registerEventAdminRoutes,
    requireGuildAdmin,
    restoreBackup,
    runInTransaction,
    safeFileBase,
  });

  // Przeniesione do server/routes/eventCleanup.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerEventCleanupRoutes(app, {
    exportClassification,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    logError,
    logWarn,
    path,
    pool,
    requireGuildAdmin,
    runInTransaction,
    safeFileBase,
  });

  // ============================================================
  // Edycja i usuwanie POJEDYNCZEGO meczu
  //
  // Dotąd jedyną drogą do poprawienia literówki w nazwie drużyny było
  // "Wyczyść fazę", które kasuje WSZYSTKIE mecze tej fazy razem z typami
  // graczy i punktami. Nieproporcjonalne do pomyłki.
  // ============================================================

  // Co zniknie razem z meczem. Ten sam wzorzec co podgląd czyszczenia fazy:
  // admin widzi liczby, zanim cokolwiek potwierdzi.
  async function policzDaneMeczu(matchId) {
    const licz = async (tabela) => {
      const [[r]] = await pool.query(
        `SELECT COUNT(*) n FROM \`${tabela}\` WHERE match_id = ?`,
        [matchId],
      );
      return r.n;
    };

    return {
      typy: await licz("match_predictions"),
      typyMap: await licz("match_map_predictions"),
      wyniki: await licz("match_results"),
      wynikiMap: await licz("match_map_results"),
      punkty: await licz("match_points"),
    };
  }

  // Przeniesione do server/routes/matches.js. Wywolanie stoi tam, gdzie byly trasy -
  // kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
  registerMatchRoutes(app, {
    getLockBeforeSec,
    guildIdFromMatchId,
    io,
    isMatchStarted,
    logInfo,
    logWarn,
    matchesStore,
    policzDaneMeczu,
    pool,
    recalculateMatchPoints,
    requireGuildAdmin,
    runInTransaction,
  });
}
