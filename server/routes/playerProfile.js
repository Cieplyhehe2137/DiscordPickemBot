import { loadTeamPicks, loadTeamLogos } from "../lib/teamPicks.js";
import { buildProgress } from "../lib/pointsProgress.js";
import { buildPlayerHistory } from "../lib/playerHistory.js";
import { buildPlayerVsCrowd } from "../lib/crowdBaseline.js";
import { buildPhasePoints } from "../lib/phasePoints.js";

// Profil gracza w evencie: punkty, skutecznosc, serie, rekordy, porownanie
// z reszta stawki i historia typow.
//
// Jedna trasa i ponad 900 linii. Klasyfikacja bierze sie z tabeli
// `leaderboard`, a nie z sumowania match_points - to jest zrodlo prawdy o
// miejscu w rankingu i tylko ono przezywa zakonczenie turnieju z cleanupem.

export function registerPlayerProfileRoutes(
  app,
  { findNameFromPicks, pool },
) {
  app.get("/api/public/events/:slug/players/:userId", async (req, res) => {
    try {
      const { slug, userId } = req.params;


      // WSZYSTKIE zapytania o tego gracza startuja naraz.
      //
      // Kazde z nich to osobna podroz do bazy, a baza stoi na innej maszynie
      // niz API: zmierzone na produkcji wychodzi okolo 165 ms na zapytanie,
      // niezaleznie od tego, ile wierszy zwraca. Trzynascie zapytan jedno po
      // drugim to ponad dwie sekundy czekania na dane, ktore nic o sobie
      // nawzajem nie wiedza - wszystkie zaleza wylacznie od event.id
      // i userId, znanych juz w tym miejscu.
      //
      // Typy druzyn dolaczaja do tej samej fali (patrz loadTeamPicks, ktory
      // w srodku robi to samo dla szesciu faz). Logotypy zostaja osobno,
      // bo dopiero typy mowia, o ktore nazwy pytac.
      //
      // Promise.all zachowuje kolejnosc, wiec destrukturyzacja po lewej musi
      // isc dokladnie tak, jak wywolania po prawej.
      /*
       * ODCZYT TURNIEJU IDZIE RAZEM Z RESZTA.
       *
       * Stal wyzej wylacznie po to, zeby zamienic slug na event.id i
       * event.guild_id, a placil za to pelna podroz do bazy - zmierzone na
       * serwerze 177 ms, dziesiec prob, zerowy rozrzut.
       *
       * Ostatnia rzecza, ktora trzymala go osobno, bylo loadTeamPicks:
       * potrzebowalo OBU identyfikatorow. Odkad przyjmuje slug, nic juz
       * nie musi czekac na ten wiersz.
       *
       * Sam wiersz jest dalej potrzebny - nazwa i slug ida do odpowiedzi,
       * a event.id do historii startow - tylko przyjezdza razem z reszta.
       */
      const [
        [[event]],
        [[userProfile]],
        [[pointsStats]],
        [[predictionStats]],
        [[mapStats]],
        [[rankRow]],
        [recentPredictions],
        [recentMapPredictions],
        [[bestMatch]],
        [streakRows],
        [perfectMatchRows],
        [[bestMapMatch]],
        [[correctMatchPointsStats]],
        [eventComparisonRows],
        teamPicks,
        [historyRows],
        [phaseScoreRows],
        [glosowanieRows],
      ] = await Promise.all([
        pool.query(
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
        ),

        pool.query(
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
        ),

        /*
         * Punkty dla tego eventu.
         * match_points może mieć kilka rekordów dla jednego meczu,
         * np. source = series i source = map.
         */
        pool.query(
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
            WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
              AND user_id = ?
            `,
          [slug, userId],
        ),

        /*
         * Statystyki typów serii.
         */
        pool.query(
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

            WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
              AND mp.user_id = ?
            `,
          [slug, userId],
        ),

        /*
         * Statystyki map.
         */
        pool.query(
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

            WHERE mmp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
              AND mmp.user_id = ?
            `,
          [slug, userId],
        ),

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
        pool.query(
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
        WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
    ) ranked

    WHERE ranked.user_id = ?

    LIMIT 1
    `,
          [slug, userId],
        ),

        pool.query(
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

    WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
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
          [slug, userId],
        ),

        pool.query(
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

    WHERE mmp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        AND mmp.user_id = ?

    ORDER BY
        mmp.match_id DESC,
        mmp.map_no ASC
    `,
          [slug, userId],
        ),

        pool.query(
          `
    SELECT
        match_id,
        SUM(points) AS points

    FROM match_points

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        AND user_id = ?

    GROUP BY match_id

    ORDER BY
        points DESC,
        match_id ASC

    LIMIT 1
    `,
          [slug, userId],
        ),

        // Te same wiersze obsługują dwie rzeczy: serie trafień i wykres
        // punktów narastająco. Punkty i nazwy drużyn doszły dla wykresu -
        // osobne zapytanie o to samo kosztowałoby kolejną podróż do bazy.
        //
        // Punkty idą przez podzapytanie z GROUP BY, bo match_points ma na
        // jeden mecz kilka wierszy (seria i mapy osobno). Zwykły JOIN
        // zwielokrotniłby przez to wiersze i zepsuł liczenie serii.
        pool.query(
          `
    SELECT
        mp.match_id,
        mp.pred_a,
        mp.pred_b,
        mr.res_a,
        mr.res_b,
        m.team_a,
        m.team_b,
        COALESCE(pts.points, 0) AS points,
        COALESCE(m.match_no, m.id) AS sort_order

    FROM match_predictions mp

    INNER JOIN match_results mr
        ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    INNER JOIN matches m
        ON m.id = mp.match_id
     AND m.event_id = mp.event_id

    LEFT JOIN (
        SELECT match_id, SUM(points) AS points
        FROM match_points
        WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND user_id = ?
        GROUP BY match_id
    ) pts
        ON pts.match_id = mp.match_id

    WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        AND mp.user_id = ?

    ORDER BY
        sort_order ASC,
        mp.match_id ASC
    `,
          [slug, userId, slug, userId],
        ),

        pool.query(
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

    WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        AND mp.user_id = ?

    GROUP BY
        mp.match_id,
        mp.pred_a,
        mp.pred_b,
        mr.res_a,
        mr.res_b
    `,
          [slug, userId],
        ),

        pool.query(
          `
    SELECT
        match_id,
        SUM(points) AS points

    FROM match_points

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        AND user_id = ?
        AND source = 'map'

    GROUP BY match_id

    ORDER BY
        points DESC,
        match_id ASC

    LIMIT 1
    `,
          [slug, userId],
        ),

        pool.query(
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

        WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
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
          [slug, userId],
        ),

        pool.query(
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
        WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
    ) users

    LEFT JOIN (
        SELECT
          user_id,
          SUM(points) AS total_points
        FROM match_points
        WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
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

        WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

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

        WHERE mmp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

        GROUP BY mmp.user_id
    ) maps
        ON maps.user_id = users.user_id
    `,
          [slug, slug, slug, slug],
        ),

        // Po slugu, a nie po parze identyfikatorow - dzieki temu nie musi
        // czekac, az wroci wiersz turnieju, i miesci sie w tej samej fali.
        loadTeamPicks(pool, { slug, userId }),

        // Starty tego gracza w POZOSTALYCH turniejach.
        //
        // Miejsce liczone tak samo jak w zapytaniu o ranking wyzej -
        // ROW_NUMBER po punktach malejaco, a przy remisie po user_id.
        // Inna formula dawalaby tu inne miejsce niz to, ktore gracz
        // widzi, wchodzac na swoj profil w tamtym turnieju.
        //
        // PARTITION BY liczy miejsca osobno w kazdym turnieju, wiec
        // jedno przejscie po tabeli (dzis okolo 1300 wierszy) daje
        // komplet. Filtr po graczu jest na zewnatrz, bo w srodku
        // obcinalby stawke, wzgledem ktorej liczy sie miejsce.
        pool.query(
          `
    SELECT
        r.event_id,
        r.total_points,
        r.rank_position,
        r.uczestnicy,
        e.name,
        e.slug,
        e.is_archived

    FROM (
        SELECT
            event_id,
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci AS user_id,

            COALESCE(total_points, 0) AS total_points,

            ROW_NUMBER() OVER (
                PARTITION BY event_id
                ORDER BY
                    COALESCE(total_points, 0) DESC,
                    user_id ASC
            ) AS rank_position,

            COUNT(*) OVER (PARTITION BY event_id) AS uczestnicy

        FROM leaderboard
    ) r

    INNER JOIN events e
        ON e.id = r.event_id

    WHERE r.user_id = ?

    ORDER BY r.event_id DESC
    `,
          [userId],
        ),
        /*
         * PUNKTY Z FAZ, po jednym wierszu na etap.
         *
         * Klasyfikacja eventu to suma szesciu skladowych, a profil czytal
         * z tego wylacznie match_points - cala gorna polowa strony liczyla
         * mecze i tylko mecze. Zmierzone: 708 z 1294 wpisow gracz-turniej
         * nie ma ani jednego wiersza w match_points i ogladalo sciane zer.
         *
         * BEZ FILTRA active - dokladnie tak, jak liczy
         * services/rebuildEventLeaderboard.js i ranking eventu. Gdyby to
         * zapytanie filtrowalo, a tamte nie, rozbicie nie sumowaloby sie do
         * liczby w kafelku obok i nie dalo by sie powiedziec, ktora klamie.
         *
         * Stage ma wylacznie swiss_scores - pozostale fazy to jeden wiersz
         * na gracza, wiec NULL jest tu prawda, a nie brakiem danych.
         */
        pool.query(
          `
    SELECT 'swiss' AS phase, stage, COALESCE(points, 0) AS points
      FROM swiss_scores
     WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
       AND user_id = ?

    UNION ALL
    SELECT 'playin', NULL, COALESCE(points, 0)
      FROM playin_scores
     WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
       AND user_id = ?

    UNION ALL
    SELECT 'playoffs', NULL, COALESCE(points, 0)
      FROM playoffs_scores
     WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
       AND user_id = ?

    UNION ALL
    SELECT 'doubleelim', NULL, COALESCE(points, 0)
      FROM doubleelim_scores
     WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
       AND user_id = ?

    UNION ALL
    SELECT 'mvp', NULL, COALESCE(points, 0)
      FROM mvp_scores
     WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
       AND user_id = ?
    `,
          [slug, userId, slug, userId, slug, userId, slug, userId, slug, userId],
        ),

        /*
         * TEN GRACZ WOBEC TŁUMU.
         *
         * Jeden wiersz na mecz, który wytypował i który się rozstrzygnął:
         * jego strona, zwycięzca i rozkład głosów całej społeczności.
         * Odjęcie własnego głosu od większości robi już czysta biblioteka,
         * bo to jest reguła, a nie zapytanie.
         *
         * Złączenie match_predictions z samą sobą: dla 106 meczów i stu
         * typujących to dziesięć tysięcy wierszy zwijanych do 106.
         * Zmierzone na produkcji - mieści się w tej samej fali, co reszta.
         */
        pool.query(
          `
    SELECT
      p.match_id,
      (p.pred_a > p.pred_b) AS mine_a,
      (r.res_a > r.res_b) AS winner_a,
      SUM(CASE WHEN q.pred_a > q.pred_b THEN 1 ELSE 0 END) AS on_a,
      SUM(CASE WHEN q.pred_b > q.pred_a THEN 1 ELSE 0 END) AS on_b

    FROM match_predictions p

    JOIN matches m
      ON m.id = p.match_id
     AND m.event_id = p.event_id

    JOIN match_results r
      ON r.match_id = m.id
     AND r.event_id = m.event_id

    JOIN match_predictions q
      ON q.match_id = m.id
     AND q.event_id = m.event_id

    WHERE p.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      AND p.user_id = ?

    GROUP BY p.match_id, mine_a, winner_a
    `,
          [slug, userId],
        ),
      ]);

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
        vs_crowd: buildPlayerVsCrowd(glosowanieRows),

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
