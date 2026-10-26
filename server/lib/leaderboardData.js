// Policzony ranking turnieju: jedna fala zapytan i zlozenie wyniku.
//
// Najdluzsza funkcja na serwerze - i do etapu 5 stala w pliku TRAS, wewnatrz
// wywolania createLeaderboardCache, jako funkcja strzalkowa na 864 linie.
// Z trasami nie ma nic wspolnego: dostaje slug, oddaje gotowa liste. To, ze
// odpowiedz HTTP sklada sie z tego gdzie indziej, widac teraz z sygnatury.
//
// CO TU SIEDZI, poza samymi zapytaniami: pelna historia pomiarow, ktore
// zdecydowaly o kazdym z nich - dlaczego zapytania ida jedna fala, dlaczego
// turniej wybiera sie podzapytaniem po slugu zamiast osobnego odczytu
// i dlaczego nazwy graczy przychodza osobno, a nie zlaczeniem z CAST-em.
// Te akapity sa tu wazniejsze od kodu: bez nich kazda z tych decyzji wyglada
// na przypadek i ktos ja "uprosci".
//
// Zaleznosci argumentem - cala funkcje da sie sprawdzic bez bazy, co robi
// test/leaderboardRoute.test.js na atrapie puli, liczac PODROZE, a nie
// milisekundy.
//
// Pamiec podreczna, ktora te funkcje wola, stoi w lib/leaderboardCache.js;
// trase, ktora stronicuje i przeszukuje jej wynik - w routes/events.js.

import { buildAccuracyRanking, progTypow } from "./accuracyRanking.js";
import { buildCrowdBaseline } from "./crowdBaseline.js";
import { buildEarnedRanking } from "./earnedRanking.js";
import {
  MIN_GLOSUJACYCH,
  oczywisty,
  PROG_OCZYWISTEGO,
} from "./matchDifficulty.js";

export async function loadLeaderboardData({
  slug,
  pool,
  countParticipants,
  scoring,
}) {


      /*
       * JEDNA FALA ZAMIAST TRZECH PODROZY.
       *
       * Zmierzone na produkcyjnej bazie, kazde zapytanie osobno, po
       * rozgrzewce polaczenia i cache:
       *
       *   SELECT id FROM events (trywialne)   172 ms  <- sama podroz
       *   glowny ranking, 523 wiersze         260 ms
       *   rozbicie punktow na fazy            200 ms
       *   statystyki map                      220 ms
       *   przetwarzanie w JS                    0 ms
       *
       * Trywialne zapytanie kosztuje 172 ms, wiec PRACA trzech ciezkich to
       * 30-90 ms kazde, a cala reszta to podroz. Nawet to duze zlaczenie
       * osmiu tabel przez UNION kosztuje ledwie 90 ms ponad podroz - wiec
       * nie ono jest problemem, wbrew temu, na co wyglada.
       *
       * Zadne z tych zapytan nie potrzebuje wyniku pozostalych: wszystkie
       * biora turniej z tego samego sluga. Dlatego ida razem.
       *
       * Kolejnosc w tablicy odpowiada kolejnosci w destrukturyzacji i nic
       * poza tym jej nie pilnuje.
       */
      /*
       * ODCZYT TURNIEJU IDZIE RAZEM Z RESZTA, a nie przed nia.
       *
       * Stal wyzej wylacznie po to, zeby zamienic slug na event.id - i
       * kosztowal za to pelna podroz do bazy. Zmierzone na serwerze przez
       * healthcheck: 177 ms, dziesiec prob, zerowy rozrzut. Przy dwoch
       * falach to 354 ms podlogi, zanim ktorekolwiek zapytanie cokolwiek
       * policzy.
       *
       * Pozostale zapytania biora identyfikator podzapytaniem po slugu.
       * Kosztuje ono tyle co nic - zmierzone na tych wlasnie zapytaniach,
       * mediana z pieciu przebiegow, roznice od -16 do +12 ms.
       *
       * Przy nieznanym turnieju podzapytanie daje NULL, wiec pozostale
       * zapytania nie znajduja nic i konczy sie to czterystaczwórką jak
       * wczesniej - tylko zmarnowana praca jest wykonana rownolegle,
       * a nie po kolei.
       */
      const [
        [[event]],
        uczestnicy,
        [rows],
        [nameRows],
        [pointBreakdownRows],
        [mapStatsRows],
        [[rozstrzygniete]],
        [glosowanieRows],
        [bezWierszaRows],
        [typyFazRows],
        [zarobioneRows],
      ] = await Promise.all([
        pool.query(
          `
          SELECT id
          FROM events
          WHERE slug = ?
          LIMIT 1
          `,
          [slug],
        ),

        // Liczba typujacych. Robi wlasne zapytanie, wiec dopoki stala za fala,
        // byla trzecim okrazeniem - mimo ze nie potrzebuje niczyjego wyniku.
        countParticipants({ slug }),

        pool.query(
          `
      SELECT
        lb.user_id,
        -- user_profiles ma wiersz tylko dla osób, które logowały się na stronie.
        -- Gracze typujący wyłącznie na Discordzie go nie mają, więc w rankingu
        -- zakończonego turnieju wychodziło im surowe user_id zamiast nicku.
        -- Ich nazwy leżą w tabelach faz, zapisane przy oddawaniu typu.
        -- Sama nazwa z profilu. Zapas z tabel faz i ostatni zapas
        -- (identyfikator) doklada się w JS, bo nazwy przychodzą teraz
        -- osobnym zapytaniem.
        COALESCE(up.displayname, up.username) AS profile_name,
        up.avatar,

        COALESCE(lb.total_points, 0) AS total_points,

        COALESCE(stats.total_predictions, 0) AS total_predictions,
        COALESCE(stats.correct_winners, 0) AS correct_winners,

        -- Rozbicie sumy na fazy. Wcześniej dawał je osobny endpoint
        -- /api/public/events/:slug/leaderboard, którego front nigdy nie wołał -
        -- utrzymywaliśmy dwa rankingi, z czego jeden martwy.
        COALESCE(fazy.swiss_points, 0) AS swiss_points,
        COALESCE(fazy.playoffs_points, 0) AS playoffs_points,
        COALESCE(fazy.playin_points, 0) AS playin_points,
        COALESCE(fazy.doubleelim_points, 0) AS doubleelim_points,
        COALESCE(fazy.match_points, 0) AS match_points,
        COALESCE(fazy.mvp_points, 0) AS mvp_points

      FROM leaderboard lb

      LEFT JOIN user_profiles up
        ON up.user_id COLLATE utf8mb4_unicode_ci
         = lb.user_id COLLATE utf8mb4_unicode_ci


      LEFT JOIN (
        SELECT
          user_id,
          SUM(swiss_points) AS swiss_points,
          SUM(playoffs_points) AS playoffs_points,
          SUM(playin_points) AS playin_points,
          SUM(doubleelim_points) AS doubleelim_points,
          SUM(match_points) AS match_points,
          SUM(mvp_points) AS mvp_points
        FROM (
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, COALESCE(points,0) swiss_points, 0 playoffs_points, 0 playin_points, 0 doubleelim_points, 0 match_points, 0 mvp_points
            FROM swiss_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          UNION ALL
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, COALESCE(points,0), 0, 0, 0, 0 FROM playoffs_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          UNION ALL
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, COALESCE(points,0), 0, 0, 0 FROM playin_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          UNION ALL
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, COALESCE(points,0), 0, 0 FROM doubleelim_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          UNION ALL
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, COALESCE(points,0), 0 FROM match_points WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
          UNION ALL
          SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, 0, COALESCE(points,0) FROM mvp_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        ) skladowe
        GROUP BY user_id
      ) fazy
        ON fazy.user_id = lb.user_id COLLATE utf8mb4_unicode_ci

      LEFT JOIN (
        SELECT
          mp.user_id,

          COUNT(DISTINCT mp.match_id) AS total_predictions,

          COUNT(
            DISTINCT CASE
              WHEN mr.match_id IS NOT NULL
               AND (
                 (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
                 OR
                 (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
               )
              THEN mp.match_id
              ELSE NULL
            END
          ) AS correct_winners

        FROM match_predictions mp

        LEFT JOIN match_results mr
          ON mr.event_id = mp.event_id
         AND mr.match_id = mp.match_id

        WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

        GROUP BY mp.user_id
      ) stats
        ON stats.user_id COLLATE utf8mb4_unicode_ci
         = lb.user_id COLLATE utf8mb4_unicode_ci

      WHERE lb.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

      ORDER BY
        total_points DESC,
        correct_winners DESC,
        lb.user_id ASC
      `,
          [
            // rozbicie punktow na fazy (6 tabel)
            slug, slug, slug, slug, slug, slug,
            // statystyki meczowe
            slug,
            // WHERE lb.event_id
            slug,
          ],
        ),

        /*
         * Nazwy zapamiętane przy typowaniu - OSOBNYM zapytaniem, nie
         * złączeniem.
         *
         * Stało to w głównym zapytaniu jako LEFT JOIN na tabeli pochodnej,
         * dołączanej warunkiem
         *
         *   nazwy.user_id = CAST(lb.user_id AS CHAR ...) COLLATE ...
         *
         * CAST na lb.user_id odcina bazę od indeksu na tej kolumnie i to
         * właśnie kosztowało. Zmierzone na produkcji, przy podróży 175 ms:
         *
         *                        całość   bez nazw   same nazwy   złączenie
         *   StarLadder (509)     314 ms    193 ms      184 ms      120 ms
         *   Cologne    (523)     383 ms    259 ms      181 ms      124 ms
         *   Kraków     (262)     309 ms    247 ms      179 ms       62 ms
         *
         * Samo zebranie nazw to 4-9 ms PRACY. Reszta była kosztem sklejenia
         * ich z tabelą leaderboard.
         *
         * CAST wewnątrz UNION zostaje i musi zostać: kolacje kolumn user_id
         * różnią się między tabelami faz a leaderboard (utf8mb4_unicode_ci
         * kontra utf8mb4_0900_ai_ci) i bez sprowadzenia ich do wspólnej
         * postaci leci ER_CANT_AGGREGATE_NCOLLATIONS. Różnica polega na
         * tym, że teraz CAST nie dotyka już kolumny, po której baza mogłaby
         * szukać - sklejenie robi JS, po zwykłym łańcuchu znaków.
         */
        pool.query(
          `
      SELECT user_id, MAX(nazwa) AS nazwa
      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS nazwa
          FROM swiss_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM swiss_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci,
               CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_scores WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1) AND COALESCE(displayname, username) IS NOT NULL
      ) zrodla
      GROUP BY user_id
          `,
          [
            slug, slug, slug, slug,
            slug, slug, slug, slug,
          ],
        ),
        pool.query(
          `
      SELECT
        user_id,
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

      GROUP BY user_id
      `,
          [slug],
        ),
        pool.query(
          `
      SELECT
        mmp.user_id,

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

      GROUP BY mmp.user_id
      `,
          [slug],
        ),

        // Ile meczów w ogóle dawało się wytypować. Idzie tą samą falą
        // i siedzi w tym samym buforze, więc nie kosztuje podróży na
        // zapytanie - a bez niego liczba typów w wierszu nie ma do
        // czego się odnieść.
        //
        // Tylko ROZSTRZYGNIĘTE: mecz bez wyniku nie jest okazją,
        // którą ktoś zmarnował, tylko taką, która jeszcze trwa.
        pool.query(
          `
      SELECT COUNT(*) AS ile
      FROM matches m
      JOIN match_results r ON r.match_id = m.id
      WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      `,
          [slug],
        ),

        // Jak głosowała społeczność w każdym rozstrzygniętym meczu.
        //
        // Z tego liczy się TŁUM: gracz-widmo, który zawsze typuje to,
        // co większość. Zmierzone w Kolonii - trafiłby 71 ze 106
        // i zająłby szóste miejsce na 410 typujących, czyli tylko pięć
        // osób z czterystu dziewięciu miało lepsze oko niż sam środek
        // ciężkości ich wszystkich.
        //
        // Jeden wiersz na mecz, więc 106 wierszy w największym turnieju.
        // Idzie tą samą falą i siedzi w tym samym buforze, co ranking.
        pool.query(
          `
      SELECT
        m.id AS match_id,
        (r.res_a > r.res_b) AS winner_a,
        SUM(CASE WHEN p.pred_a > p.pred_b THEN 1 ELSE 0 END) AS on_a,
        SUM(CASE WHEN p.pred_b > p.pred_a THEN 1 ELSE 0 END) AS on_b

      FROM matches m

      JOIN match_results r
        ON r.match_id = m.id
       AND r.event_id = m.event_id

      JOIN match_predictions p
        ON p.match_id = m.id
       AND p.event_id = m.event_id

      WHERE m.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

      GROUP BY m.id
      `,
          [slug],
        ),

        /*
         * KTO TYPOWAŁ, A NIE MA JESZCZE WIERSZA W KLASYFIKACJI.
         *
         * `leaderboard` powstaje WYŁĄCZNIE z sześciu tabel punktowych
         * (services/rebuildEventLeaderboard.js), więc kto jeszcze nic nie
         * ugrał, nie ma tam wiersza - a skoro lista rankingu szła FROM
         * leaderboard, nie było go też na stronie. W trwającym turnieju
         * przed pierwszym wynikiem znaczy to PUSTĄ tabelę: zmierzone na
         * produkcji, epl-season24 miał 33 typujących i zero wierszy
         * klasyfikacji.
         *
         * Dlaczego osobnym zapytaniem, a nie poszerzeniem głównego:
         * zmierzone na produkcji, mediana z pięciu przebiegów po
         * rozgrzewce, przy podłodze 174 ms
         *
         *   turniej       główne   główne poszerzone   to zapytanie
         *   Cologne       271 ms        489 ms            184 ms
         *   StarLadder    190 ms        568 ms            179 ms
         *   Kraków        241 ms        285 ms            180 ms
         *
         * Poszerzenie kazałoby wielkiemu złączeniu jechać od tabeli
         * pochodnej i kosztowało dwieście milisekund na każdym wejściu,
         * bo bufor rankingu żyje trzydzieści sekund i przy siedmiu
         * wejściach na dobę prawie nigdy nie trafia. To zapytanie kosztuje
         * 5-10 ms PRACY, idzie tą samą falą i jest szybsze od głównego,
         * więc nie wydłuża jej ani o milisekundę.
         *
         * Zakończonych turniejów to nie dotyka - tam każdy typujący ma już
         * wiersz, bo rozstrzygnięty mecz zapisuje punkty KAŻDEMU, kto go
         * typował, także zero. Zmierzone: zero dodanych wierszy w Cologne,
         * Krakowie i StarLadderze.
         */
        pool.query(
          `
      SELECT
        u.user_id,

        -- Nazwa i awatar z profilu, tak samo jak w głównym zapytaniu.
        -- Dalsze zapasy (nazwa z tabel faz, potem samo id) dokleja JS.
        COALESCE(up.displayname, up.username) AS profile_name,
        up.avatar,

        COALESCE(s.total_predictions, 0) AS total_predictions,
        COALESCE(s.correct_winners, 0) AS correct_winners

      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM match_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM swiss_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      ) u

      LEFT JOIN user_profiles up
        ON CAST(up.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
         = u.user_id

      -- Te same statystyki meczowe, co w glownym zapytaniu: wiersz bez
      -- nich mowilby "0 typow" komus, kto wlasnie wytypowal osiem meczow.
      LEFT JOIN (
        SELECT
          CAST(mp.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id,

          COUNT(DISTINCT mp.match_id) AS total_predictions,

          COUNT(
            DISTINCT CASE
              WHEN mr.match_id IS NOT NULL
               AND (
                 (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
                 OR
                 (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
               )
              THEN mp.match_id
              ELSE NULL
            END
          ) AS correct_winners

        FROM match_predictions mp

        LEFT JOIN match_results mr
          ON mr.event_id = mp.event_id
         AND mr.match_id = mp.match_id

        WHERE mp.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

        GROUP BY mp.user_id
      ) s
        ON s.user_id = u.user_id

      -- Alias MUSI byc inny niz w zapytaniu glownym. Testy trasy
      -- rozpoznaja zapytania po fragmencie tekstu SQL - ten sam alias
      -- tutaj kazalby atrapie puli oddac temu zapytaniu wiersze
      -- klasyfikacji, a wtedy kazdy gracz wszedlby do rankingu dwa razy.
      WHERE NOT EXISTS (
        SELECT 1
          FROM leaderboard klasyfikacja
         WHERE klasyfikacja.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
           AND CAST(klasyfikacja.user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
             = u.user_id
      )
      `,
          [slug, slug, slug, slug, slug, slug, slug],
        ),

        /*
         * ILE FAZ WYTYPOWAŁ KAŻDY GRACZ.
         *
         * Wiersz rankingu pokazywał dotąd WYŁĄCZNIE typy meczowe, więc
         * ktoś, kto wytypował całą drabinkę playoffs, czytał o sobie
         * „0 z 37 typów". Zmierzone na produkcji: w epl-season24 ośmioro
         * z dziewięciu dopisanych do klasyfikacji ma dokładnie taki
         * wiersz - zero typów meczowych i jedną wytypowaną fazę.
         *
         * Najmocniej widać to w turnieju bez meczów: StarLadder Budapest
         * to same fazy, 509 graczy i 1055 oddanych typów, a podpis znikał
         * tam w całości, bo front chowa go przy zerze meczów.
         *
         * NAZWA. Strona mówi o nich "fazy" (phase.swiss, phase.playoffs,
         * phase.playin, phase.doubleElim), nie "drabinki" - Swiss
         * drabinką nie jest, a wpada w ten sam licznik.
         *
         * UNION ALL, nie UNION: liczymy ODDANE typy, a nie osoby.
         * swiss_predictions ma wiersz na każdy etap (unikat po
         * guild_id, event_id, user_id, stage), więc ktoś z trzema
         * etapami oddał trzy typy. Najwięcej u jednej osoby: 4.
         *
         * Koszt zmierzony na produkcji, mediana z pięciu przebiegów po
         * rozgrzewce, przy podłodze 171 ms:
         *
         *   Cologne 174 ms | StarLadder 176 ms | Kraków 173 ms | EPL 172 ms
         *
         * Czyli 1-5 ms PRACY. Jedzie tą samą falą i jest szybsze od
         * zapytania głównego (271 ms w Kolonii), więc nie wydłuża jej.
         *
         * `active` nie filtrujemy - tak samo jak nie filtruje go żadne
         * inne zapytanie o te tabele (server/lib/participants.js,
         * server/lib/frozenPhases.js, liczba uczestnikow wyżej).
         * Liczba typów musi zgadzać się z liczbą typujących z tego
         * samego wiersza, a tamta też ich nie filtruje.
         */
        pool.query(
          `
      SELECT
        typy.user_id,
        COUNT(*) AS phase_predictions

      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM swiss_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
        UNION ALL
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      ) typy

      WHERE typy.user_id IS NOT NULL
      GROUP BY typy.user_id
      `,
          [slug, slug, slug, slug],
        ),

        /*
         * TRAFIENIA ZAROBIONE CAŁEGO POLA - trzecia oś tabeli.
         *
         * To samo zapytanie, które liczy miejsce w polu na profilu
         * gracza (server/routes/playerProfile.js). Zgoda pola zwija się
         * najpierw do jednego wiersza na mecz, a dopiero potem łączy
         * z typami - inaczej byłoby to dziesięć tysięcy wierszy razy
         * liczba graczy.
         *
         * OBA PROGI IDĄ PARAMETREM z lib/matchDifficulty.js. Wpisanie
         * ich tutaj dałoby drugie miejsce, w którym trzeba pamiętać
         * o zmianie reguły, a wtedy ranking klasyfikowałby mecze jako
         * oczywiste inaczej niż kafelek na profilu tego samego gracza.
         */
        pool.query(
          `
      SELECT
        CAST(q.user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        SUM(CASE
              WHEN (q.pred_a > q.pred_b) = mecz.winner_a
               AND mecz.obvious = 0 THEN 1 ELSE 0
            END) AS earned

      FROM match_predictions q

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

      // Brak turnieju to też wynik i też wart zapamiętania: inaczej błędny
      // adres w pętli odpytywałby bazę bez końca. O kodzie odpowiedzi
      // decyduje trasa.
      if (!event) return null;

      // Klasyfikacja idzie z tabeli `leaderboard`, a nie z sumy match_points.
      //
      // Dwa powody. Po pierwsze `total_points` ma być tym samym, co pokazuje bot
      // i co ląduje w eksporcie klasyfikacji - wcześniej ten endpoint sumował
      // WYŁĄCZNIE punkty meczowe, więc strona "Ranking graczy" pomijała Swiss,
      // Playoffs, Play-In, Double Elim i MVP. Po drugie wiersze brały się z
      // `match_predictions`, przez co gracz, który typował tylko fazy Pick'Em,
      // a nie typował meczów, w ogóle nie pojawiał się w rankingu.
      //
      // Statystyki meczowe (skuteczność, trafieni zwycięzcy) zostają jako
      // uzupełnienie i są teraz doklejane LEFT JOIN-em, więc brak typów
      // meczowych daje zera zamiast wypadnięcia z listy.

      const pointBreakdownByUser = new Map(
        pointBreakdownRows.map((row) => [
          String(row.user_id),
          {
            series_points: Number(row.series_points || 0),
            map_points: Number(row.map_points || 0),
          },
        ]),
      );


      const mapStatsByUser = new Map(
        mapStatsRows.map((row) => [
          String(row.user_id),
          {
            predicted_maps: Number(row.predicted_maps || 0),
            correct_maps: Number(row.correct_maps || 0),
            exact_maps: Number(row.exact_maps || 0),
          },
        ]),
      );

      // Drabinki wchodzą tą samą drogą, co statystyki map: mapą po
      // identyfikatorze, a nie złączeniem w zapytaniu. Dzięki temu
      // obejmują zarówno wiersze z klasyfikacji, jak i typujących
      // dopisanych niżej - jedno i drugie czyta tę samą mapę.
      const typyFazByUser = new Map(
        typyFazRows.map((row) => [
          String(row.user_id),
          Number(row.phase_predictions || 0),
        ]),
      );

      // Klucz to zwykły łańcuch znaków, a nie kolacja bazy. Identyfikatory
      // Discorda są numeryczne, więc porównanie dokładne daje ten sam wynik
      // co obie kolacje z bazy - i jest od nich ostrzejsze, nie luźniejsze.
      const nameByUser = new Map(
        nameRows.map((row) => [String(row.user_id), row.nazwa]),
      );

      /*
       * Typujący bez wiersza w klasyfikacji dołączają do TEJ SAMEJ listy.
       *
       * Wiersze z zapytania obok mają te same nazwy kolumn, których czyta
       * mapowanie niżej - brakujące (punkty, rozbicie na fazy) czytają się
       * jako undefined i lądują zerami przez Number(x || 0). Nie ma więc
       * drugiej ścieżki budowania wiersza, która mogłaby się rozjechać
       * z pierwszą.
       *
       * Kolejność i miejsce ustala sortowanie w JS tuż niżej, nie ORDER BY
       * z zapytania - komentarz przy nim mówi o tym wprost. Doklejenie
       * przed sortowaniem znaczy więc, że te wiersze są układane tą samą
       * regułą, co wszystkie pozostałe.
       */
      const leaderboardData = [...rows, ...bezWierszaRows].map((row) => {
        const totalPredictions = Number(row.total_predictions || 0);
        const correctWinners = Number(row.correct_winners || 0);
        const pointBreakdown = pointBreakdownByUser.get(String(row.user_id)) || {
          series_points: 0,
          map_points: 0,
        };

        const mapStats = mapStatsByUser.get(String(row.user_id)) || {
          predicted_maps: 0,
          correct_maps: 0,
          exact_maps: 0,
        };

        return {
          user_id: row.user_id,
          // Ta sama kolejność zapasów co wcześniej w COALESCE: profil ze
          // strony, potem nazwa zapamiętana przy typowaniu, na końcu samo id.
          displayname:
            row.profile_name || nameByUser.get(String(row.user_id)) || row.user_id,
          avatar: row.avatar,

          total_points: Number(row.total_points || 0),

          // Rozbicie na serie/mapy bierze się z match_points (pointBreakdown),
          // bo główne zapytanie zwraca już tylko sumę końcową z `leaderboard`.
          series_points: pointBreakdown.series_points,
          map_points: pointBreakdown.map_points,

          // Rozbicie na fazy turnieju.
          swiss_points: Number(row.swiss_points || 0),
          playoffs_points: Number(row.playoffs_points || 0),
          playin_points: Number(row.playin_points || 0),
          doubleelim_points: Number(row.doubleelim_points || 0),
          phase_match_points: Number(row.match_points || 0),
          mvp_points: Number(row.mvp_points || 0),

          total_predictions: totalPredictions,
          correct_winners: correctWinners,

          /*
           * Drabinki stoją OSOBNO, a nie w total_predictions.
           *
           * total_predictions jest mianownikiem `accuracy` tuż niżej,
           * bramką progu w server/lib/accuracyRanking.js (połowa
           * ROZSTRZYGNIĘTYCH MECZÓW) i bramką stawki w
           * server/lib/crowdBaseline.js. Dolanie tam drabinek
           * zepsułoby wszystkie trzy naraz:
           *
           *   - skuteczność spadłaby każdemu, kto typował fazy, bo
           *     typ fazy wszedłby do mianownika, a trafiony zwycięzca
           *     meczu nigdy nie wejdzie do licznika za niego;
           *   - do stawki „połowa meczów" dałoby się wejść
           *     samymi fazami, czyli bez typowania meczów.
           *
           * Front składa z tych dwóch liczb jeden podpis, więc dla
           * czytającego one się dodają - ale w danych zostają
           * rozdzielone, bo mierzą dwie różne rzeczy.
           */
          phase_predictions: typyFazByUser.get(String(row.user_id)) || 0,

          predicted_maps: mapStats.predicted_maps,
          correct_maps: mapStats.correct_maps,
          exact_maps: mapStats.exact_maps,

          accuracy:
            totalPredictions > 0
              ? Math.round((correctWinners / totalPredictions) * 100)
              : 0,
        };
      });

      leaderboardData.sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }

        if (b.correct_winners !== a.correct_winners) {
          return b.correct_winners - a.correct_winners;
        }

        if (b.correct_maps !== a.correct_maps) {
          return b.correct_maps - a.correct_maps;
        }

        if (b.exact_maps !== a.exact_maps) {
          return b.exact_maps - a.exact_maps;
        }

        return String(a.user_id).localeCompare(String(b.user_id));
      });

      // Miejsce liczymy PRZED podziałem na strony, bo o kolejności decyduje
      // sortowanie w JS (punkty, potem trafieni zwycięzcy, mapy, exacty),
      // a nie ORDER BY z zapytania - te dwa porządki rozstrzygają remisy
      // inaczej. Gdyby strony wycinał SQL, gracz na granicy potrafiłby
      // pojawić się dwa razy albo zniknąć.
      const wszystkie = leaderboardData.map((player, index) => ({
        ...player,
        rank: index + 1,
      }));

      const meczowRozstrzygnietych = Number(rozstrzygniete?.ile || 0);

      // DRUGA OŚ TEJ SAMEJ TABELI: kto trafia, a nie kto był obecny.
      //
      // Liczone tutaj, w pamięci podręcznej, a nie na froncie - front
      // dostaje stronę pięćdziesięciu wierszy, więc przesortowanie
      // u niego ułożyłoby tylko tę stronę. Zero nowych zapytań: pola,
      // na których to stoi, są już w `wszystkie`.
      const skutecznosc = buildAccuracyRanking({
        players: wszystkie,
        matches: meczowRozstrzygnietych,
      });

      // TRZECIA OŚ: ile z tych trafień trzeba było zarobić.
      //
      // Liczba meczów oczywistych idzie z `glosowanieRows`, czyli z tych
      // samych wierszy, na których stoi tłum - zero nowych zapytań. Regułę
      // bierzemy z lib/matchDifficulty.js, żeby ranking i kafelek na
      // profilu klasyfikowały mecz jako oczywisty tak samo.
      const zarobione = buildEarnedRanking({
        players: wszystkie,
        earnedByUser: new Map(
          (zarobioneRows || []).map((row) => [
            String(row.user_id),
            Number(row.earned || 0),
          ]),
        ),
        pointsPerHit: scoring?.MATCH?.WINNER,
        matches: meczowRozstrzygnietych,
        obvious: (glosowanieRows || []).filter(oczywisty).length,
      });

  return {
    wszystkie,
    skutecznosc,
    zarobione,
    uczestnicy,

    // MIANOWNIK DO LICZBY TYPOW.
    //
    // Bez niego wiersz mówi „60 typów" i nie wiadomo, czy to dużo.
    // Zmierzone na produkcji: w IEM Cologne Major 2026 mediana
    // pokrycia to DWA PROCENT okazji, a 81% z 523 sklasyfikowanych
    // oddało mniej niż co dziesiąty typ. Bez mianownika „miejsce 200
    // z 523" czyta się jak „za mną 323 rywali".
    meczow: meczowRozstrzygnietych,

    // TŁUM: poprzeczka dla wszystkich liczb wyżej.
    //
    // Ranking mówi, kto był lepszy od kogo. Nie mówi, czy ktokolwiek
    // był lepszy od najprostszego możliwego sposobu typowania - a to
    // jest jedyne porównanie, które daje tym procentom skalę.
    //
    // Liczone z `wszystkie`, a nie ze strony: miejsce tłumu ma być
    // liczone wobec CAŁEJ stawki, nie wobec pięćdziesięciu widocznych
    // wierszy. Próg ten sam, co w tabeli skuteczności - jedno pojęcie
    // stawki w całym serwisie, a nie dwa podobne o różnych rozmiarach.
    tlum: buildCrowdBaseline({
      matches: glosowanieRows,
      players: wszystkie,
      threshold: progTypow(meczowRozstrzygnietych),
    }),
  };
}
