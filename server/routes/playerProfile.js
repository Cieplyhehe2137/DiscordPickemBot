import { loadTeamLogos } from "../lib/teamPicks.js";
import { buildProgress } from "../lib/pointsProgress.js";
import { buildPlayerHistory } from "../lib/playerHistory.js";
import { buildPlayerVsCrowd } from "../lib/crowdBaseline.js";
import { buildKeyDecisions } from "../lib/keyDecisions.js";
import { buildConfidence } from "../lib/confidence.js";
import { buildAbsence } from "../lib/absence.js";
import { buildMatchDifficulty } from "../lib/matchDifficulty.js";
import { loadPlayerProfileRows } from "../lib/playerProfileQueries.js";
import { buildPhasePoints } from "../lib/phasePoints.js";

// Profil gracza w evencie: punkty, skutecznosc, serie, rekordy, porownanie
// z reszta stawki i historia typow.
//
// Jedna trasa - i to po wyprowadzeniu z niej 926 linii samych zapytan, ktore
// stoja teraz w lib/playerProfileQueries.js. Tutaj zostaje to, co z tych
// wierszy robi odpowiedz: serie, rekordy i kilkanascie modulow build*,
// z ktorych kazdy liczy jedna sekcje profilu.
//
// Klasyfikacja bierze sie z tabeli `leaderboard`, a nie z sumowania
// match_points - to jest zrodlo prawdy o miejscu w rankingu i tylko ono
// przezywa zakonczenie turnieju z cleanupem.

export function registerPlayerProfileRoutes(
  app,
  { findNameFromPicks, pool, scoring },
) {
  app.get("/api/public/events/:slug/players/:userId", async (req, res) => {
    try {
      const { slug, userId } = req.params;

      // Wszystkie zapytania o tego gracza ida jedna fala. Sama fala, razem
      // z pomiarami, ktore o niej zdecydowaly, stoi w
      // lib/playerProfileQueries.js - stad bierze sie tu DZIEWIETNASCIE nazw
      // naraz.
      const {
        event,
        userProfile,
        pointsStats,
        predictionStats,
        mapStats,
        rankRow,
        recentPredictions,
        recentMapPredictions,
        bestMatch,
        streakRows,
        perfectMatchRows,
        bestMapMatch,
        correctMatchPointsStats,
        eventComparisonRows,
        teamPicks,
        historyRows,
        phaseScoreRows,
        glosowanieRows,
        trudnoscPolaRows,
      } = await loadPlayerProfileRows({ pool, slug, userId });

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      // Dopiero gdy profilu nie ma - nie ma po co odpytywac osmiu tabel faz
      // dla kogos, kto logowal sie na stronie i ma tam swoja nazwe.
      const nazwaZapasowa =
        userProfile?.displayname || userProfile?.username
          ? null
          : await findNameFromPicks(event.id, userId);

      // Miejsce i punkty musza pochodzic z tego samego zrodla, inaczej
      // sasiadujace kafelki potrafia sobie zaprzeczyc.
      const punktyKlasyfikacji = rankRow ? Number(rankRow.total_points || 0) : 0;

      const totalPredictions = Number(predictionStats?.finished_predictions || 0);

      const correctWinners = Number(predictionStats?.correct_winners || 0);

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

      // Logotypy osobno, bo wiąże je z drużyną sama nazwa - patrz
      // migrations/0009_add_team_logos.sql.
      const teamLogos = await loadTeamLogos(pool, teamPicks);

      // Punkty z faz - rozbicie i przebieg po etapach. Turniej bez ani
      // jednego meczu w bazie (StarLadder Budapest 2025, 509 graczy) nie
      // ma z czego narysowac przebiegu meczowego, a etapy Swiss daja go
      // wprost: 12 -> 28 -> 40 -> 47 u pierwszego miejsca.
      const phasePoints = buildPhasePoints(phaseScoreRows);

      // Wiersze meczow, ktore ten gracz FAKTYCZNIE wytypowal.
      const mojeMecze = glosowanieRows.filter((w) => Number(w?.mine) === 1);

      res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        team_picks: teamPicks,
        team_logos: teamLogos,

        // Rozbicie sumy na fazy i przebieg po etapach. Osobno od
        // `profile`, bo to struktura, a tamto plaski worek liczb.
        phase_points: phasePoints,

        // Ten gracz wobec najprostszego mozliwego sposobu typowania.
        // Zmierzone w Kolonii: 75% graczy ma te liczbe UJEMNA, czyli
        // wypadlo gorzej, niz gdyby szli za wiekszoscia. To jest ta
        // informacja, ktorej profil dotad nie mial.
        // MECZE TEGO GRACZA, nie wszystkie w turnieju.
        //
        // Zapytanie wyzej oddaje teraz KAZDY rozstrzygniety mecz, bo sekcja
        // "Co przeszlo obok" liczy wlasnie te bez typu. Obie starsze sekcje
        // musza dostac dokladnie to, co dostawaly przedtem - stad ten filtr,
        // a nie zmiana regul w ich bibliotekach.
        vs_crowd: buildPlayerVsCrowd(mojeMecze),

        // SKAD wziela sie ta liczba. Suma wyzej jest prawdziwa, ale nie da
        // sie jej zobaczyc - a bierze sie z kilku decyzji, nie ze stu
        // szesciu. Zmierzone w Kolonii: tylko 8% typow (504 z 6405) oddano
        // wbrew trzem czwartym stawki.
        decisions: buildKeyDecisions(mojeMecze),

        // CO PRZESZLO OBOK. Caly serwis liczy to, co ktos zrobil.
        // Zmierzone w Kolonii: mediana typujacego pominela 103 ze 106
        // meczow, a rekordzista zyskalby +142 pkt i 47 miejsc, gdyby
        // na pominietych szedl za wiekszoscia.
        //
        // Stawka z rules/scoring.js, a nie wpisana tutaj - to jest
        // jedyne zrodlo stalych punktowych w tym projekcie.
        absence: buildAbsence({
          rows: glosowanieRows,
          pointsPerWinner: scoring?.MATCH?.WINNER,
        }),

        // CZY TRZEBA BYLO MIEC RACJE. Trafiony zwyciezca to 2 punkty
        // niezaleznie od tego, czy wytypowalo go cale pole, czy cztery
        // procent. Zmierzone w Kolonii: 39 ze 106 meczow trafilo ponad
        // 85% pola i leży na nich 55% wszystkich trafien stawki.
        //
        // Podzial trafien TEGO gracza liczy sie z glosowanieRows, czyli
        // bez zapytania; osobne zapytanie daje wylacznie miejsce w polu.
        difficulty: buildMatchDifficulty({
          rows: glosowanieRows,
          fieldRows: trudnoscPolaRows,
          userId,
          pointsPerWinner: scoring?.MATCH?.WINNER,
        }),

        // PEWNOSC TYPU. Wynik serii nie daje ani jednego punktu,
        // a zmierzony na wszystkich turniejach niesie 15 punktow
        // procentowych roznicy w trafieniu zwyciezcy: 2:0 -> 67%,
        // 2:1 -> 52%. Liczone z tego samego zapytania, co reszta
        // statystyk serii - bez dodatkowej podrozy do bazy.
        confidence: buildConfidence({
          sure: predictionStats?.sure_picks,
          sureHits: predictionStats?.sure_hits,
          close: predictionStats?.close_picks,
          closeHits: predictionStats?.close_hits,
        }),

        // Starty w pozostalych turniejach. Pusta lista dla 85% graczy,
        // ktorzy zagrali w dokladnie jednym - widok jej wtedy nie
        // pokazuje wcale.
        other_events: buildPlayerHistory(historyRows, event.id),

        profile: {
          best_match_points: Number(bestMatch?.points || 0),
          best_correct_streak: bestCorrectStreak,

          // Punkty narastająco, mecz po meczu - z tych samych wierszy, co
          // serie wyżej. Suma mówi ile, ten ciąg mówi kiedy.
          points_progress: buildProgress(streakRows),
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
