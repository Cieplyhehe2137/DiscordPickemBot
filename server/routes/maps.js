// Czytanie wyników map jako publiczne API.
//
// Co te dane pozwalają powiedzieć, a czego nie - w szczególności DLACZEGO
// nie ma tu ani słowa o nazwach map - stoi w server/lib/mapReading.js.
// Tutaj jest wyłącznie pobranie.
//
// TRZY ZAPYTANIA, JEDNA FALA. Każde to osobna podróż do bazy stojącej na
// innej maszynie niż API: zmierzone 177 ms, niezależnie od tego, ile
// wierszy wraca.
//
// NAJWIĘKSZE Z NICH to typy map połączone z wynikiem: dziś 18 090 wierszy
// po siedem pól. Potrzebne w całości, bo z tych samych wierszy powstają
// naraz trzy rzeczy - rozkład typowanych wyników, rozkład faktycznych
// i zestawienie graczy - a każda liczy się inaczej. Policzenie tego w SQL-u
// znaczyłoby trzy zapytania i trzy kopie reguły; tak reguła siedzi w jednym
// module, który da się sprawdzić testem bez bazy.
//
// Przy trzech turniejach to około 700 KB raz na trzydzieści sekund. Gdyby
// kiedyś urosło na tyle, że zaczyna przeszkadzać, to jest miejsce, w które
// trzeba zajrzeć.
//
// ADRES MA JEDEN SEGMENT po /api/public/, więc wpada w pułapkę
// /api/public/:guildSlug - piąta trasa w tym projekcie. Rejestracja stoi
// przed registerPickemConfigRoutes, a routeShadowing.test.js ma własny
// przypadek.

import { buildMapReading } from "../lib/mapReading.js";
import { createLeaderboardCache } from "../lib/leaderboardCache.js";

// Ile rozliczonych typów uprawnia do miejsca w zestawieniu graczy.
//
// Zmierzone na produkcji: 558 graczy, średnio 32 typy, ale rozrzut jest
// ogromny - rekord to 297. Przy progu trzydziestu zostaje 146 osób, czyli
// mniej więcej te, które przetypowały cały jeden turniej.
const MIN_TYPOW = 30;

// Ile najczęstszych wyników pokazać w każdym z dwóch rozkładów. Osiem, bo
// tyle wystarcza, żeby zobaczyć przesunięcie między typami a rzeczywistością,
// a dłuższa lista to już ogon pojedynczych przypadków.
const ILE_WYNIKOW = 8;

// Typy map POŁĄCZONE z wynikiem. Złączenie po parze (mecz, numer mapy),
// bo to ona identyfikuje mapę - nazwy nie ma.
const SQL_TYPY = `
    SELECT
        p.match_id,
        p.map_no,

        CAST(p.user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        p.pred_exact_a,
        p.pred_exact_b,

        r.exact_a,
        r.exact_b

    FROM match_map_predictions p

    INNER JOIN match_map_results r
        ON r.match_id = p.match_id
       AND r.map_no = p.map_no

    WHERE r.exact_a IS NOT NULL
      AND r.exact_b IS NOT NULL
      AND p.pred_exact_a IS NOT NULL
      AND p.pred_exact_b IS NOT NULL
`;

const SQL_PROFILE = `
    SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,

        COALESCE(displayname, username) AS displayname,
        avatar

    FROM user_profiles
`;

// Nazwy graczy, którzy nigdy nie zalogowali się na stronie. To samo źródło
// i ta sama lista ośmiu tabel, co w rankingu turnieju i w niespodziankach.
const TABELE_FAZ = [
  "swiss_predictions",
  "swiss_scores",
  "playoffs_predictions",
  "playoffs_scores",
  "playin_predictions",
  "playin_scores",
  "doubleelim_predictions",
  "doubleelim_scores",
];

const SQL_NAZWY = `
    SELECT user_id, MAX(nazwa) AS displayname
    FROM ( ${TABELE_FAZ.map(
      (tabela) => `
        SELECT
            CAST(user_id AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci AS user_id,
            CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
              COLLATE utf8mb4_unicode_ci AS nazwa
        FROM \`${tabela}\`
        WHERE COALESCE(displayname, username) IS NOT NULL`,
    ).join(" UNION ALL ")} ) zrodla
    GROUP BY user_id
`;

export function registerMapRoutes(app, { pool }) {
  const cache = createLeaderboardCache({
    load: async () => {
      const [[typy], [profile], [nazwy]] = await Promise.all([
        pool.query(SQL_TYPY),
        pool.query(SQL_PROFILE),
        pool.query(SQL_NAZWY),
      ]);

      // Profile PRZED nazwami z faz: pierwszy wpis o graczu wygrywa.
      return buildMapReading(typy, [...profile, ...nazwy], {
        minPicks: MIN_TYPOW,
        topScores: ILE_WYNIKOW,
      });
    },
  });

  app.get("/api/public/maps", async (req, res) => {
    try {
      const dane = await cache.get("maps");

      res.json({
        ...dane,

        // Próg jedzie razem z danymi, bo strona ma powiedzieć wprost, czego
        // brakuje komuś, kogo w zestawieniu nie ma.
        min_picks: MIN_TYPOW,
      });
    } catch (err) {
      console.error("MAP READING ERROR:", err);

      res.status(500).json({
        error: "Nie udało się wczytać statystyk map.",
        code: "server.mapsFailed",
      });
    }
  });
}
