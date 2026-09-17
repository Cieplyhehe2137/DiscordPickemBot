// Statystyki eventu: zbiorcze liczby turnieju i rozklad typow dla
// pojedynczego meczu.
//
// Dwie trasy, ale prawie 900 linii - to sa najciezsze zapytania w calym
// API, liczace srednie, serie i porownania na calej populacji typujacych.

export function registerEventStatsRoutes(
  app,
  {
    assertPredictionsAllowed,
    resolveDisplayName,
    isMatchDeadlinePassed,
    isMatchLocked,
    matchPanelPhaseFor,
    pool,
  },
) {
  app.get("/api/events/:slug/stats", async (req, res) => {
    try {
      const { slug } = req.params;


      /*
       * JEDNA FALA ZAMIAST JEDENASTU PODROZY.
       *
       * Kazde zapytanie to osobna podroz do bazy stojacej na innej maszynie
       * niz API - zmierzone na produkcji okolo 165 ms, NIEZALEZNIE od tego,
       * ile wierszy wraca. Stad ta trasa potrzebowala 2,4 s, a przy turnieju
       * BEZ ANI JEDNEGO MECZU (StarLadder Budapest) nadal 2,1 s. To jest
       * podpis kosztu liczonego podrozami, a nie danymi.
       *
       * Zadne z tych zapytan nie potrzebuje wyniku zadnego innego - jedyna
       * prawdziwa zaleznosc to event.id, odczytany wyzej. Dlatego ida razem.
       *
       * Kolejnosc w tablicy odpowiada kolejnosci w destrukturyzacji i nic
       * poza tym jej nie pilnuje - przestawienie jednej strony bez drugiej
       * podmienia wyniki miejscami, a kazdy z nich to wiarygodnie wygladajaca
       * liczba. Dopisujac nowe zapytanie, dopisz je na KONCU obu list.
       */
      /*
       * ODCZYT TURNIEJU IDZIE RAZEM Z RESZTA.
       *
       * Stal wyzej wylacznie po to, zeby zamienic slug na event.id, i placil
       * za to pelna podroz do bazy - zmierzone na serwerze 177 ms, dziesiec
       * prob, zerowy rozrzut. Pozostale zapytania biora turniej
       * podzapytaniem po slugu, ktore kosztuje tyle co nic.
       *
       * Wiersz turnieju jest dalej potrzebny (event.guild_id przy bramce
       * i terminach, nazwy przy dociaganiu graczy) - tylko przyjezdza teraz
       * razem z reszta, a nie przed nia.
       */
      const [
        [[event]],
        [[predictionStats]],
        [[mapPredictionStats]],
        [[pointsStats]],
        [[bestPlayer]],
        [[exactStats]],
        [[bestExactPlayer]],
        [[bestAccuracyPlayer]],
        [[favoriteTeam]],
        [balancedMatchRows],
        [upsetRows],
      ] = await Promise.all([
        pool.query(
          `
          SELECT id, guild_id
          FROM events
          WHERE slug = ?
          LIMIT 1
          `,
          [slug],
        ),

        pool.query(
          `
          SELECT
            COUNT(DISTINCT user_id) AS participants,
            COUNT(*) AS total_predictions
          FROM match_predictions
          WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          `,
          [slug],
        ),
        pool.query(
          `
          SELECT
            COUNT(*) AS total_map_predictions
          FROM match_map_predictions
          WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          `,
          [slug],
        ),
        pool.query(
          `
          SELECT
            COALESCE(AVG(player_points), 0) AS average_points,
            COALESCE(MAX(player_points), 0) AS best_score
          FROM (
            SELECT
              user_id,
              SUM(points) AS player_points
            FROM match_points
            WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
            GROUP BY user_id
          ) scores
          `,
          [slug],
        ),
        pool.query(
          `
          SELECT
            mp.user_id,

            -- Bez podstawiania user_id: gdy profilu nie ma, ma wyjsc NULL,
            -- zeby nazwe dalo sie dobrac z tabel typow (patrz resolveDisplayName).
            COALESCE(
              up.displayname,
              up.username
            ) AS displayname,

            SUM(mp.points) AS total_points

          FROM match_points mp

          LEFT JOIN user_profiles up
            ON up.user_id COLLATE utf8mb4_unicode_ci
             = mp.user_id COLLATE utf8mb4_unicode_ci

          WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

          GROUP BY
            mp.user_id,
            up.displayname,
            up.username

          ORDER BY
            total_points DESC,
            mp.user_id ASC

          LIMIT 1
          `,
          [slug],
        ),
        pool.query(
          `
          SELECT
            COUNT(*) AS exact_maps
          FROM match_map_predictions mmp

          INNER JOIN match_map_results mmr
            ON mmr.event_id = mmp.event_id
           AND mmr.match_id = mmp.match_id
           AND mmr.map_no = mmp.map_no

          WHERE mmp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
            AND mmp.pred_exact_a = mmr.exact_a
            AND mmp.pred_exact_b = mmr.exact_b
          `,
          [slug],
        ),
        pool.query(
          `
          SELECT
            mmp.user_id,

            -- Bez podstawiania user_id: gdy profilu nie ma, ma wyjsc NULL,
            -- zeby nazwe dalo sie dobrac z tabel typow (patrz resolveDisplayName).
            COALESCE(
              up.displayname,
              up.username
            ) AS displayname,

            COUNT(*) AS exact_maps

          FROM match_map_predictions mmp

          INNER JOIN match_map_results mmr
            ON mmr.event_id = mmp.event_id
           AND mmr.match_id = mmp.match_id
           AND mmr.map_no = mmp.map_no

          LEFT JOIN user_profiles up
            ON up.user_id COLLATE utf8mb4_unicode_ci
             = mmp.user_id COLLATE utf8mb4_unicode_ci

          WHERE mmp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
            AND mmp.pred_exact_a = mmr.exact_a
            AND mmp.pred_exact_b = mmr.exact_b

          GROUP BY
            mmp.user_id,
            up.displayname,
            up.username

          ORDER BY
            exact_maps DESC,
            mmp.user_id ASC

          LIMIT 1
          `,
          [slug],
        ),
        pool.query(
          `
      SELECT
        mp.user_id,

        -- Jak wyzej: NULL zamiast identyfikatora, zeby zadzialal zapas.
        COALESCE(
          up.displayname,
          up.username
        ) AS displayname,

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
        ) AS correct_winners,

        ROUND(
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
          )
          / COUNT(DISTINCT mp.match_id) * 100,
          1
        ) AS accuracy

      FROM match_predictions mp

      INNER JOIN match_results mr
        ON mr.event_id = mp.event_id
       AND mr.match_id = mp.match_id

      LEFT JOIN user_profiles up
        ON up.user_id COLLATE utf8mb4_unicode_ci
         = mp.user_id COLLATE utf8mb4_unicode_ci

      WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

      GROUP BY
        mp.user_id,
        up.displayname,
        up.username

      HAVING finished_predictions >= GREATEST(
        1,
        CEIL(
          (
            SELECT COUNT(DISTINCT mr2.match_id)
            FROM match_results mr2
            WHERE mr2.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          ) * 0.5
        )
      )

      ORDER BY
        accuracy DESC,
        correct_winners DESC,
        finished_predictions DESC,
        mp.user_id ASC

      LIMIT 1
      `,
          [slug, slug],
        ),
        pool.query(
          `
      SELECT
        picked_team AS team,
        COUNT(*) AS picks
      FROM (
        SELECT
          CASE
            WHEN pred_a > pred_b THEN m.team_a
            WHEN pred_b > pred_a THEN m.team_b
            ELSE NULL
          END AS picked_team

        FROM match_predictions mp

        INNER JOIN matches m
          ON m.id = mp.match_id
         AND m.event_id = mp.event_id

        WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      ) picks

      WHERE picked_team IS NOT NULL

      GROUP BY picked_team

      ORDER BY
        picks DESC,
        picked_team ASC

      LIMIT 1
      `,
          [slug],
        ),
        pool.query(
          `
      SELECT
        m.id AS match_id,
        m.team_a,
        m.team_b,
        m.phase,
        m.best_of,
        m.is_locked,
        m.lock_override,

        COUNT(mp.user_id) AS total_picks,

        SUM(
          CASE
            WHEN mp.pred_a > mp.pred_b THEN 1
            ELSE 0
          END
        ) AS team_a_picks,

        SUM(
          CASE
            WHEN mp.pred_b > mp.pred_a THEN 1
            ELSE 0
          END
        ) AS team_b_picks,

        CASE
          WHEN mr.match_id IS NOT NULL THEN 1
          ELSE 0
        END AS finished

      FROM matches m

      INNER JOIN match_predictions mp
        ON mp.event_id = m.event_id
       AND mp.match_id = m.id

      LEFT JOIN match_results mr
        ON mr.event_id = m.event_id
       AND mr.match_id = m.id

      WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

      GROUP BY
        m.id,
        m.team_a,
        m.team_b,
        m.phase,
        m.best_of,
        m.is_locked,
        m.lock_override,
        mr.match_id
      `,
          [slug],
        ),
        pool.query(
          `
      SELECT
        m.id AS match_id,
        m.team_a,
        m.team_b,
        m.best_of,

        mr.res_a,
        mr.res_b,

        COUNT(mp.user_id) AS total_picks,

        SUM(
          CASE
            WHEN mp.pred_a > mp.pred_b THEN 1
            ELSE 0
          END
        ) AS team_a_picks,

        SUM(
          CASE
            WHEN mp.pred_b > mp.pred_a THEN 1
            ELSE 0
          END
        ) AS team_b_picks

      FROM matches m

      INNER JOIN match_results mr
        ON mr.event_id = m.event_id
       AND mr.match_id = m.id

      INNER JOIN match_predictions mp
        ON mp.event_id = m.event_id
       AND mp.match_id = m.id

      WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

      GROUP BY
        m.id,
        m.team_a,
        m.team_b,
        m.best_of,
        mr.res_a,
        mr.res_b
      `,
          [slug],
        ),
      ]);

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      /*
       * Uczestnicy + liczba typów meczów
       */

      /*
       * Typy map
       */

      /*
       * Średnia punktów i najlepszy wynik.
       */

      /*
       * Najlepszy gracz punktowo.
       */

      /*
       * Łączna liczba exactów map.
       */

      /*
       * Gracz z największą liczbą exactów map.
       */




      /*
       * Bramka i terminy liczone RAZ, a nie w kazdym obrocie petli.
       *
       * Obie funkcje pytaja baze. Stoja w petli po wszystkich meczach
       * turnieju, a zadna z nich nie zalezy od meczu: bramka zalezy od
       * serwera i jest identyczna za kazdym razem, termin zalezy od fazy.
       *
       * Przy turnieju zakonczonym kazdy mecz jest rozstrzygniety, wiec
       * warunek je omija i nie widac tego w pomiarach. Przy turnieju
       * TRWAJACYM - czyli wtedy, gdy na stronie jest ruch - kazdy otwarty
       * mecz kosztowal dwie osobne podroze do bazy po 177 ms. Dwadziescia
       * otwartych meczow to siedem sekund samego czekania.
       *
       * Liczone LENIWIE: turniej bez otwartych meczow nie wykonuje ani
       * jednego dodatkowego zapytania, czyli zachowuje sie jak dotad.
       */
      let bramkaMeczy = null;

      const bramka = async () => {
        if (!bramkaMeczy) {
          bramkaMeczy = await assertPredictionsAllowed({
            guildId: event.guild_id,
            kind: "MATCHES",
          });
        }

        return bramkaMeczy;
      };

      const terminy = new Map();

      const termin = async (faza) => {
        if (!terminy.has(faza)) {
          terminy.set(
            faza,
            await isMatchDeadlinePassed(pool, event.guild_id, faza),
          );
        }

        return terminy.get(faza);
      };

      const balancedCandidates = [];

      for (const row of balancedMatchRows) {
        let locked = Number(row.finished) === 1;
        let forceOpen = false;

        if (!locked) {
          const gate = await bramka();

          if (!gate.allowed) {
            locked = true;
          }
        }

        if (!locked && Number(row.lock_override) === 1) {
          locked = true;
        }

        if (
          !locked &&
          row.lock_override !== null &&
          Number(row.lock_override) === 0
        ) {
          forceOpen = true;
        }

        if (!locked && !forceOpen && Number(row.is_locked) === 1) {
          locked = true;
        }

        if (!locked && !forceOpen) {
          const matchPanelPhase = matchPanelPhaseFor(row.phase);

          if (matchPanelPhase) {
            const { passed } = await termin(matchPanelPhase);

            if (passed) {
              locked = true;
            }
          }
        }

        if (!locked) {
          continue;
        }

        const total = Number(row.total_picks || 0);

        if (total === 0) {
          continue;
        }

        const teamA = Number(row.team_a_picks || 0);
        const teamB = Number(row.team_b_picks || 0);

        const teamAPercentage = Math.round((teamA / total) * 100);

        const teamBPercentage = 100 - teamAPercentage;

        balancedCandidates.push({
          match_id: Number(row.match_id),
          team_a: row.team_a,
          team_b: row.team_b,
          best_of: Number(row.best_of || 0),

          total_picks: total,

          team_a_picks: teamA,
          team_b_picks: teamB,

          team_a_percentage: teamAPercentage,
          team_b_percentage: teamBPercentage,

          difference: Math.abs(teamAPercentage - teamBPercentage),
        });
      }

      balancedCandidates.sort((a, b) => {
        if (a.difference !== b.difference) {
          return a.difference - b.difference;
        }

        if (b.total_picks !== a.total_picks) {
          return b.total_picks - a.total_picks;
        }

        return a.match_id - b.match_id;
      });

      const closestMatch = balancedCandidates[0] || null;


      const upsetCandidates = upsetRows
        .map((row) => {
          const total = Number(row.total_picks || 0);

          if (total === 0) {
            return null;
          }

          const teamAPicks = Number(row.team_a_picks || 0);
          const teamBPicks = Number(row.team_b_picks || 0);

          const teamAWon = Number(row.res_a) > Number(row.res_b);

          const winnerPicks = teamAWon ? teamAPicks : teamBPicks;

          const winnerPercentage = Math.round((winnerPicks / total) * 100);

          return {
            match_id: Number(row.match_id),

            team_a: row.team_a,
            team_b: row.team_b,

            best_of: Number(row.best_of || 0),

            res_a: Number(row.res_a),
            res_b: Number(row.res_b),

            winner: teamAWon ? row.team_a : row.team_b,

            total_picks: total,

            team_a_picks: teamAPicks,
            team_b_picks: teamBPicks,

            team_a_percentage: Math.round((teamAPicks / total) * 100),

            team_b_percentage: Math.round((teamBPicks / total) * 100),

            winner_percentage: winnerPercentage,
          };
        })
        .filter(Boolean);

      upsetCandidates.sort((a, b) => {
        if (a.winner_percentage !== b.winner_percentage) {
          return a.winner_percentage - b.winner_percentage;
        }

        return b.total_picks - a.total_picks;
      });

      const biggestUpset = upsetCandidates[0] || null;

      /*
       * Nazwy trzech wyroznionych graczy - takze jedna fala.
       *
       * Stały w środku res.json({...}) jako trzy osobne `await`, więc szły
       * jedno po drugim. Zwykle nic nie kosztują, bo resolveDisplayName
       * zwraca od razu nazwę z profilu dociągniętą JOIN-em wyżej. Sięga do
       * bazy dopiero wtedy, gdy profilu nie ma - i wtedy, w najgorszym
       * przypadku, były to trzy kolejne podróże doklejone do odpowiedzi.
       *
       * To jest też powód, dla którego te trzy nie mogły wejść do fali
       * wyżej: potrzebują wierszy, które tamta fala dopiero przynosi.
       */
      const [
        bestPlayerName,
        bestExactPlayerName,
        bestAccuracyPlayerName,
      ] = await Promise.all([
        resolveDisplayName(event.id, bestPlayer),
        resolveDisplayName(event.id, bestExactPlayer),
        resolveDisplayName(event.id, bestAccuracyPlayer),
      ]);

      res.json({
        stats: {
          participants: Number(predictionStats?.participants || 0),

          closest_match: closestMatch,
          biggest_upset: biggestUpset,

          total_predictions: Number(predictionStats?.total_predictions || 0),

          total_map_predictions: Number(
            mapPredictionStats?.total_map_predictions || 0,
          ),

          average_points: Number(
            Number(pointsStats?.average_points || 0).toFixed(1),
          ),

          exact_maps: Number(exactStats?.exact_maps || 0),

          best_score: Number(pointsStats?.best_score || 0),
          favorite_team: favoriteTeam
            ? {
              team: favoriteTeam.team,
              picks: Number(favoriteTeam.picks || 0),
            }
            : null,

          best_player: bestPlayer
            ? {
              user_id: bestPlayer.user_id,
              displayname: bestPlayerName,
              points: Number(bestPlayer.total_points || 0),
            }
            : null,

          best_exact_player: bestExactPlayer
            ? {
              user_id: bestExactPlayer.user_id,
              displayname: bestExactPlayerName,
              exact_maps: Number(bestExactPlayer.exact_maps || 0),
            }
            : null,

          best_accuracy_player: bestAccuracyPlayer
            ? {
              user_id: bestAccuracyPlayer.user_id,
              displayname: bestAccuracyPlayerName,
              accuracy: Number(bestAccuracyPlayer.accuracy || 0),
              correct_winners: Number(bestAccuracyPlayer.correct_winners || 0),
              finished_predictions: Number(
                bestAccuracyPlayer.finished_predictions || 0,
              ),
            }
            : null,
        },
      });
    } catch (err) {
      console.error("EVENT STATS ERROR:", err);

      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });

  app.get("/api/events/:slug/matches/:matchId/pick-stats", async (req, res) => {
    try {
      const { slug, matchId } = req.params;

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
          code: "server.eventNotFound",
        });
      }

      const [[match]] = await pool.query(
        `
    SELECT
      id,
      phase,
      team_a,
      team_b,
      best_of,
      is_locked,
      lock_override
    FROM matches
    WHERE id = ?
      AND event_id = ?
    LIMIT 1
    `,
        [matchId, event.id],
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
          code: "server.matchNotFound",
        });
      }

      let locked = false;

      const [[resultRow]] = await pool.query(
        `
    SELECT match_id
    FROM match_results
    WHERE event_id = ?
      AND match_id = ?
    LIMIT 1
    `,
        [event.id, match.id],
      );

      // Wynik oficjalny = mecz zamknięty
      if (resultRow) {
        locked = true;
      }

      // Globalny gate
      if (!locked) {
        const gate = await assertPredictionsAllowed({
          guildId: event.guild_id,
          kind: "MATCHES",
        });

        if (!gate.allowed) {
          locked = true;
        }
      }

      // Wspólna logika locka z Discordem
      if (!locked && isMatchLocked(match)) {
        locked = true;
      }

      // Deadline fazy
      if (!locked) {
        const matchPanelPhase = matchPanelPhaseFor(match.phase);

        if (matchPanelPhase) {
          const { passed } = await isMatchDeadlinePassed(
            pool,
            event.guild_id,
            matchPanelPhase,
          );

          if (passed) {
            locked = true;
          }
        }
      }

      // Przed lockiem nie pokazujemy community stats
      if (!locked) {
        return res.json({
          locked: false,
        });
      }

      /*
       * Rozkład zwycięzców.
       */
      const [[winnerStats]] = await pool.query(
        `
        SELECT
          COUNT(*) AS total_picks,

          SUM(
            CASE
              WHEN pred_a > pred_b THEN 1
              ELSE 0
            END
          ) AS team_a_picks,

          SUM(
            CASE
              WHEN pred_b > pred_a THEN 1
              ELSE 0
            END
          ) AS team_b_picks

        FROM match_predictions

        WHERE event_id = ?
          AND match_id = ?
        `,
        [event.id, match.id],
      );

      const totalPicks = Number(winnerStats?.total_picks || 0);

      const teamAPicks = Number(winnerStats?.team_a_picks || 0);

      const teamBPicks = Number(winnerStats?.team_b_picks || 0);

      /*
       * Najczęściej typowany dokładny wynik serii.
       */
      const [[popularScore]] = await pool.query(
        `
        SELECT
          pred_a,
          pred_b,
          COUNT(*) AS picks

        FROM match_predictions

        WHERE event_id = ?
          AND match_id = ?

        GROUP BY
          pred_a,
          pred_b

        ORDER BY
          picks DESC,
          pred_a DESC,
          pred_b DESC

        LIMIT 1
        `,
        [event.id, match.id],
      );

      const [mapPickRows] = await pool.query(
        `
    SELECT
      mmp.map_no,

      COUNT(*) AS total_picks,

      SUM(
        CASE
          WHEN mmp.pred_exact_a > mmp.pred_exact_b
          THEN 1
          ELSE 0
        END
      ) AS team_a_picks,

      SUM(
        CASE
          WHEN mmp.pred_exact_b > mmp.pred_exact_a
          THEN 1
          ELSE 0
        END
      ) AS team_b_picks

    FROM match_map_predictions mmp

    WHERE mmp.event_id = ?
      AND mmp.match_id = ?

    GROUP BY mmp.map_no

    ORDER BY mmp.map_no ASC
    `,
        [event.id, match.id],
      );

      const mapStats = mapPickRows.map((row) => {
        const total = Number(row.total_picks || 0);
        const teamA = Number(row.team_a_picks || 0);
        const teamB = Number(row.team_b_picks || 0);

        return {
          map_no: Number(row.map_no),

          total_picks: total,

          team_a: {
            picks: teamA,
            percentage: total > 0 ? Math.round((teamA / total) * 100) : 0,
          },

          team_b: {
            picks: teamB,
            percentage: total > 0 ? Math.round((teamB / total) * 100) : 0,
          },
        };
      });

      res.json({
        locked: true,

        maps: mapStats,

        match: {
          id: match.id,
          team_a: match.team_a,
          team_b: match.team_b,
          best_of: Number(match.best_of || 0),
        },

        picks: {
          total: totalPicks,

          team_a: {
            picks: teamAPicks,
            percentage:
              totalPicks > 0 ? Math.round((teamAPicks / totalPicks) * 100) : 0,
          },

          team_b: {
            picks: teamBPicks,
            percentage:
              totalPicks > 0 ? Math.round((teamBPicks / totalPicks) * 100) : 0,
          },
        },

        popular_score: popularScore
          ? {
            score_a: Number(popularScore.pred_a),
            score_b: Number(popularScore.pred_b),
            picks: Number(popularScore.picks),
          }
          : null,
      });
    } catch (err) {
      console.error("MATCH PICK STATS ERROR:", err);

      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });
}
