// Niespodzianki jako publiczne API.
//
// Reguła - które mecze się liczą, dlaczego skuteczność zamiast liczby
// trafień i skąd progi - siedzi w server/lib/upsets.js. Tutaj jest wyłącznie
// pobranie danych.
//
// PIĘĆ ZAPYTAŃ, JEDNA FALA. Każde to osobna podróż do bazy stojącej na
// innej maszynie niż API: zmierzone 177 ms, niezależnie od tego, ile wierszy
// wraca. Dlatego liczy się ich LICZBA, a nie rozmiar odpowiedzi - i dlatego
// wszystkie pięć idzie przez jedno Promise.all zamiast po kolei.
//
// NAJWIĘKSZE Z NICH to typy z rozstrzygniętych meczów: dziś 10 328 wierszy,
// po cztery pola każdy. Są potrzebne w całości, bo o tym, kto chodzi pod
// prąd, decyduje zestawienie typu KAŻDEGO gracza z tym, jak zagłosowała
// reszta - a tego nie da się zawęzić przed policzeniem podziału głosów.
//
// Świadomie NIE przenosimy tego do SQL-a, choć dałoby się: próg
// niespodzianki musiałby wtedy stać w zapytaniu, a razem z nim cała reguła.
// Tak zostaje w module, który da się sprawdzić testem bez bazy - dokładnie
// jak w klasyfikacji wszech czasów. Przy trzech turniejach to około 400 KB
// raz na trzydzieści sekund; gdyby kiedyś urosło na tyle, że zaczyna
// przeszkadzać, to jest miejsce, w którym trzeba zajrzeć.

import { buildTeamStats } from "../lib/teamStats.js";
import {
  buildContrarians,
  buildMisjudged,
  buildUpsets,
  crowdRate,
} from "../lib/upsets.js";
import { createLeaderboardCache } from "../lib/leaderboardCache.js";

// Progi. Stałe, a nie parametry zapytania: każdy z nich jest częścią tego,
// co ta strona znaczy, a nie ustawieniem widoku. Gdyby dało się je podać
// z adresu, każdy link niósłby inne zestawienie.
const MIN_TYPOW = 20;
const PROG_PROCENT = 25;
const MIN_OKAZJI = 12;
const MIN_MECZOW_DRUZYNY = 5;

// Mecze razem z wynikiem i podziałem głosów. Podział jako podzapytanie,
// a nie osobna podróż: to ta sama grupa po match_id, którą liczy lista
// drużyn, tyle że dopięta od razu do meczu.
// Eksportowane, bo tego samego zestawu wierszy potrzebuje profil gracza:
// zeby powiedziec, czy ktos chodzil pod prad, trzeba najpierw wiedziec,
// ktore mecze byly niespodziankami - a to wynika z typow WSZYSTKICH, nie
// jego wlasnych. Skopiowane do drugiego pliku rozjechaloby sie przy
// pierwszej zmianie i obie strony mowilyby co innego o tym samym meczu.
export const SQL_MECZE = `
    SELECT
        m.id,
        m.event_id,
        m.phase,
        m.team_a,
        m.team_b,

        mr.res_a,
        mr.res_b,

        e.name AS event_name,
        e.slug AS event_slug,

        COALESCE(s.for_a, 0) AS for_a,
        COALESCE(s.for_b, 0) AS for_b,
        COALESCE(s.total, 0) AS total

    FROM matches m

    INNER JOIN events e
        ON e.id = m.event_id

    LEFT JOIN match_results mr
        ON mr.event_id = m.event_id
       AND mr.match_id = m.id

    LEFT JOIN (
        SELECT
            match_id,
            SUM(CASE WHEN pred_a > pred_b THEN 1 ELSE 0 END) AS for_a,
            SUM(CASE WHEN pred_b > pred_a THEN 1 ELSE 0 END) AS for_b,
            COUNT(*) AS total
        FROM match_predictions
        GROUP BY match_id
    ) s
        ON s.match_id = m.id

    ORDER BY
        m.event_id DESC,
        COALESCE(m.match_no, m.id) ASC
`;

// Typy tylko z meczów, które mają wynik. Typ na mecz nierozegrany nie może
// być ani trafieniem, ani pudłem, więc nie ma po co go wozić.
const SQL_TYPY = `
    SELECT
        CAST(p.user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        p.match_id,
        p.pred_a,
        p.pred_b

    FROM match_predictions p

    INNER JOIN match_results r
        ON r.match_id = p.match_id

    WHERE r.res_a IS NOT NULL
      AND r.res_b IS NOT NULL
`;

// Nazwy osobnym zapytaniem, a nie złączeniem do typów: przy złączeniu ta
// sama nazwa wróciłaby tyle razy, ile ktoś oddał typów.
const SQL_PROFILE = `
    SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        displayname,
        avatar

    FROM user_profiles
`;

// Nazwy graczy, którzy NIGDY nie zalogowali się na stronie.
//
// Wiersz w user_profiles powstaje dopiero przy logowaniu, a większość typuje
// wyłącznie na Discordzie: z 638 typujących 212 nie ma tam nic i widziało
// w zestawieniu surowy identyfikator zamiast nicku. Trzej pierwsi „wbrew
// wszystkim" to byli akurat tacy gracze, więc czoło tabeli stanowiły trzy
// dziewiętnastocyfrowe liczby.
//
// Ich nazwy leżą w tabelach faz, zapisane przez bota przy oddawaniu typu.
// To samo źródło i ta sama lista ośmiu tabel, co w rankingu turnieju
// (server/routes/events.js) - ten sam problem został tam rozwiązany
// wcześniej i nie ma powodu rozwiązywać go drugi raz inaczej.
//
// Po połączeniu obu źródeł bez nazwy zostają 32 osoby z 638.
const SQL_NAZWY = `
    SELECT user_id, MAX(nazwa) AS displayname
    FROM (
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci AS user_id,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci AS nazwa
        FROM swiss_predictions
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM swiss_scores
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM playoffs_predictions
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM playoffs_scores
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM playin_predictions
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM playin_scores
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM doubleelim_predictions
        WHERE COALESCE(displayname, username) IS NOT NULL

        UNION ALL
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci
        FROM doubleelim_scores
        WHERE COALESCE(displayname, username) IS NOT NULL
    ) zrodla
    GROUP BY user_id
`;

const SQL_LOGOTYPY = `
    SELECT name_key, logo_url FROM team_logos WHERE logo_url IS NOT NULL
`;

export function registerUpsetsRoutes(app, { pool }) {
  const cache = createLeaderboardCache({
    load: async () => {
      const [[mecze], [typy], [profile], [nazwy], [logotypy]] =
        await Promise.all([
          pool.query(SQL_MECZE),
          pool.query(SQL_TYPY),
          pool.query(SQL_PROFILE),
          pool.query(SQL_NAZWY),
          pool.query(SQL_LOGOTYPY),
        ]);

      const upsets = buildUpsets(mecze, {
        minPicks: MIN_TYPOW,
        thresholdPercent: PROG_PROCENT,
      });

      // Statystyki drużyn liczy TEN SAM moduł, co strona drużyny. Podział
      // głosów jest już w wierszach meczów, więc wystarczy podać go
      // w kształcie, którego buildTeamStats oczekuje.
      const { teams } = buildTeamStats(
        mecze,
        mecze.map((m) => ({
          match_id: m.id,
          for_a: m.for_a,
          for_b: m.for_b,
          total: m.total,
        })),
        logotypy,
      );

      return {
        upsets,

        // Profile PRZED nazwami z faz: pierwszy wpis o graczu wygrywa,
        // a profil niesie dodatkowo awatar i jest odświeżany przy każdym
        // logowaniu, podczas gdy zapis z fazy pamięta nick z dnia typowania.
        contrarians: buildContrarians(typy, upsets, [...profile, ...nazwy], {
          minChances: MIN_OKAZJI,
        }),

        teams: buildMisjudged(teams, { minSettled: MIN_MECZOW_DRUZYNY }),

        // Tło, względem którego cokolwiek znaczy skuteczność gracza.
        crowd_rate: crowdRate(upsets),
      };
    },
  });

  app.get("/api/public/upsets", async (req, res) => {
    try {
      const dane = await cache.get("upsets");

      res.json({
        ...dane,

        // Progi jadą razem z danymi, bo strona ma powiedzieć wprost, czego
        // brakuje komuś, kogo w zestawieniu nie ma. Zaszyte w widoku
        // rozjechałyby się z tym, co robi serwer.
        min_picks: MIN_TYPOW,
        threshold_percent: PROG_PROCENT,
        min_chances: MIN_OKAZJI,
        min_team_matches: MIN_MECZOW_DRUZYNY,
      });
    } catch (err) {
      console.error("UPSETS ERROR:", err);

      res.status(500).json({
        error: "Nie udało się wczytać niespodzianek.",
        code: "server.upsetsFailed",
      });
    }
  });
}
