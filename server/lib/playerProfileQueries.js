// Fala zapytan profilu gracza: dziewietnascie zapytan, jedna podroz.
//
// Wyciagniete z routes/playerProfile.js, ktory byl JEDNA trasa na 1263 linie -
// z czego 897 to bylo wlasnie to Promise.all. Z odpowiedzia HTTP fala nie ma
// nic wspolnego: dostaje slug i userId, oddaje surowe wiersze.
//
// POZYCJE KONTRA NAZWY. Promise.all zachowuje kolejnosc, wiec destrukturyzacja
// po lewej musi isc dokladnie tak, jak wywolania po prawej - i to jest jedyna
// rzecz, ktora tego pilnuje. Dopoki fala stala w trasie, ten warunek rozciagal
// sie na cale 900 linii: wstawienie zapytania w srodku przesuwalo wszystko
// ponizej i dane trafialy do SASIEDNICH pol, bez zadnego bledu. Teraz zakres
// tego warunku konczy sie na obiekcie zwracanym nizej, a trasa bierze dane
// PO NAZWIE. Pilnuje tego test "dane trafiaja do wlasnych pol, a nie do
// sasiednich" w test/playerProfileRoute.test.js.
//
// Co tu jeszcze siedzi: pomiary, ktore zdecydowaly o kazdym z tych zapytan -
// dlaczego wszystkie startuja naraz, dlaczego odczyt turnieju idzie razem
// z reszta zamiast przed nia i dlaczego progi "oczywistego meczu" przychodza
// argumentem, a nie sa wpisane w SQL. Bez tych akapitow kazda z tych decyzji
// wyglada na przypadek.

import { MIN_GLOSUJACYCH, PROG_OCZYWISTEGO } from "./matchDifficulty.js";
import { loadTeamPicks } from "./teamPicks.js";

export async function loadPlayerProfileRows({ pool, slug, userId }) {
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
    [trudnoscPolaRows],
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
          ) AS exact_series,

          /*
           * PEWNOŚĆ TYPU: 2:0 kontra 2:1.
           *
           * Wynik serii nie daje ani jednego punktu (patrz
           * utils/matchScoring.js), a niesie najmocniejszy sygnał
           * w tej tabeli: zmierzone na wszystkich turniejach, typy
           * 2:0 trafiają zwycięzcę w 67%, a 2:1 w 52%.
           *
           * Tylko BO3. W BO1 wynik serii to zawsze 1:0, więc nie ma
           * czego dzielić, a BO5 ma w bazie dwa mecze - własne progi
           * dla takiej próbki byłyby udawaniem dokładności.
           */
          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND m.best_of = 3
               AND ABS(mp.pred_a - mp.pred_b) = 2
              THEN 1
              ELSE 0
            END
          ) AS sure_picks,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND m.best_of = 3
               AND ABS(mp.pred_a - mp.pred_b) = 2
               AND (mp.pred_a > mp.pred_b) = (mr.res_a > mr.res_b)
              THEN 1
              ELSE 0
            END
          ) AS sure_hits,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND m.best_of = 3
               AND ABS(mp.pred_a - mp.pred_b) = 1
              THEN 1
              ELSE 0
            END
          ) AS close_picks,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND m.best_of = 3
               AND ABS(mp.pred_a - mp.pred_b) = 1
               AND (mp.pred_a > mp.pred_b) = (mr.res_a > mr.res_b)
              THEN 1
              ELSE 0
            END
          ) AS close_hits

        FROM match_predictions mp

        LEFT JOIN match_results mr
          ON mr.event_id = mp.event_id
         AND mr.match_id = mp.match_id

        /*
         * LEWE złączenie, mimo że mecz zawsze istnieje. Złączenie
         * wewnętrzne wycięłoby typ osierocony po skasowanym meczu
         * i po cichu zmieniło total_predictions - liczbę, na której
         * stoi pół tej strony.
         */
        LEFT JOIN matches m
          ON m.id = mp.match_id
         AND m.event_id = mp.event_id

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
  m.id AS match_id,

  -- Nazwy drużyn i faza są TYLKO dla sekcji „Twoje decyzje": suma
  -- „+2 wobec tłumu" ich nie potrzebuje, ale mecz, który tę sumę
  -- zrobił, trzeba umieć nazwać. Tabela matches jest tu złączona
  -- od początku, więc to trzy kolumny, a nie kolejna podróż do bazy.
  m.team_a,
  m.team_b,
  m.phase,

  /*
   * WSZYSTKIE rozstrzygnięte mecze turnieju, nie tylko wytypowane.
   *
   * Zapytanie szło wcześniej OD typów tego gracza, więc mecz, którego
   * nie obstawił, nie miał tu wiersza - a to jest dokładnie ten mecz,
   * o którym mówi sekcja „Co przeszło obok". Teraz idzie od meczów,
   * a typ gracza dokleja się LEWYM złączeniem; kolumna mine odróżnia jedno
   * od drugiego.
   *
   * To nadal JEDNA podróż do bazy: ta sama fala, to samo złączenie
   * match_predictions z samą sobą, tylko szersze o mecze bez typu.
   */
  MAX(p.match_id IS NOT NULL) AS mine,
  MAX(p.pred_a > p.pred_b) AS mine_a,

  (r.res_a > r.res_b) AS winner_a,
  SUM(CASE WHEN q.pred_a > q.pred_b THEN 1 ELSE 0 END) AS on_a,
  SUM(CASE WHEN q.pred_b > q.pred_a THEN 1 ELSE 0 END) AS on_b

FROM matches m

JOIN match_results r
  ON r.match_id = m.id
 AND r.event_id = m.event_id

JOIN match_predictions q
  ON q.match_id = m.id
 AND q.event_id = m.event_id

LEFT JOIN match_predictions p
  ON p.match_id = m.id
 AND p.event_id = m.event_id
 AND p.user_id = ?

WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

-- Nazwy i faza w GROUP BY wprost: kluczem głównym grupowania jest
-- m.id, więc ONLY_FULL_GROUP_BY nie uzna ich za zależne.
GROUP BY m.id, m.team_a, m.team_b, m.phase, winner_a
`,
      // userId idzie PIERWSZY: stoi teraz w LEWYM złączeniu, a slug
      // dopiero w WHERE. Odwrotna kolejność nie daje błędu, tylko
      // pustą sekcję.
      [userId, slug],
    ),

    /*
     * TRAFIENIA CAŁEGO POLA, z podziałem na mecze oczywiste.
     *
     * Potrzebne wyłącznie po to, żeby powiedzieć „#27 z 409 wg trafień
     * zarobionych" - sam podział trafień TEGO gracza liczy się z wierszy
     * wyżej, bez żadnej podróży do bazy.
     *
     * Zmierzone na produkcji, mediana z pięciu przebiegów po rozgrzewce:
     * 199 ms przy podłodze 175 ms, czyli 24 ms pracy i 409 wierszy.
     * Idzie tą samą falą, co reszta, więc nie kosztuje ani jednej
     * podróży więcej.
     *
     * OBA PROGI IDĄ PARAMETREM z lib/matchDifficulty.js. Wpisanie ich
     * tutaj dałoby drugie miejsce, w którym trzeba pamiętać o zmianie
     * reguły - a wtedy miejsce w polu liczyłoby się inaczej niż
     * kafelek obok.
     */
    pool.query(
      `
SELECT
  -- user_id w match_predictions ma inne porównywanie niż w pozostałych
  -- tabelach; porównanie idzie i tak w JS, po tekście.
  CAST(q.user_id AS CHAR CHARACTER SET utf8mb4)
    COLLATE utf8mb4_unicode_ci AS user_id,

  SUM(CASE
        WHEN (q.pred_a > q.pred_b) = mecz.winner_a
         AND mecz.obvious = 0 THEN 1 ELSE 0
      END) AS earned

FROM match_predictions q

-- Zgoda pola na każdym meczu: dziesięć tysięcy wierszy zwijanych do 106,
-- a dopiero potem złączonych z typami.
JOIN (
  SELECT
    m.id,
    (r.res_a > r.res_b) AS winner_a,
    (
      COUNT(*) >= ?
      AND (100 * SUM(CASE
                       WHEN (p.pred_a > p.pred_b) = (r.res_a > r.res_b)
                       THEN 1 ELSE 0
                     END)) / COUNT(*) >= ?
    ) AS obvious

  FROM matches m

  JOIN match_results r
    ON r.match_id = m.id
   AND r.event_id = m.event_id

  JOIN match_predictions p
    ON p.match_id = m.id
   AND p.event_id = m.event_id

  WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

  GROUP BY m.id, winner_a
) AS mecz
  ON mecz.id = q.match_id

WHERE q.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

GROUP BY user_id
`,
      [MIN_GLOSUJACYCH, PROG_OCZYWISTEGO, slug, slug],
    ),
  ]);

  // Dalej juz PO NAZWIE, nie po pozycji - patrz naglowek.
  return {
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
  };
}
