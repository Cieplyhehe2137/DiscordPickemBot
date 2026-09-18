// Profil gracza ponad turniejami jako publiczne API.
//
// Po co ta trasa istnieje - i dlaczego nic w niej nie liczy się od nowa -
// stoi w server/lib/playerCareer.js. Tutaj jest wyłącznie pobranie danych.
//
// SZEŚĆ ZAPYTAŃ, JEDNA FALA. Każde to osobna podróż do bazy stojącej na innej
// maszynie niż API: zmierzone 177 ms, niezależnie od tego, ile wierszy wraca.
// Żadne z nich nie potrzebuje wyniku poprzedniego - wszystkie zależą wyłącznie
// od identyfikatora gracza, znanego już z adresu.
//
// ADRES MA DWA SEGMENTY po /api/public/, więc pierwszy raz od czterech stron
// nie wpada w pułapkę /api/public/:guildSlug. Test i tak pilnuje kolejności,
// bo właśnie przy „przecież ta jest bezpieczna" takie rzeczy się przeocza.

import { buildCareer, buildTeamBias } from "../lib/playerCareer.js";
import { buildContrarians, buildUpsets } from "../lib/upsets.js";
import { createLeaderboardCache } from "../lib/leaderboardCache.js";
import { SQL_MECZE } from "./upsets.js";

// Progi. Te same liczby, co na stronie niespodzianek - i to nie przypadek:
// gracz ma tu zobaczyć swój wiersz z TAMTEJ tabeli, a nie inny pomiar tego
// samego. Rozjazd znaczyłby, że ktoś jest w zestawieniu, a na własnym
// profilu czyta, że mu brakuje okazji.
const MIN_TYPOW = 20;
const PROG_PROCENT = 25;
const MIN_OKAZJI = 12;

// Ile razy trzeba postawić na drużynę, żeby coś to o graczu mówiło.
const MIN_TYPOW_DRUZYNY = 3;

// Starty gracza we WSZYSTKICH turniejach.
//
// Miejsce liczone dokładnie tak, jak w rankingu turnieju i w klasyfikacji
// wszech czasów: ROW_NUMBER po punktach malejąco, przy remisie po user_id.
// Inna formuła dałaby tu inne miejsce niż to, które gracz widzi gdzie
// indziej. Filtr po graczu jest NA ZEWNĄTRZ okna - w środku obcinałby
// stawkę, względem której liczy się miejsce.
const SQL_STARTY = `
    SELECT
        r.user_id,
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
`;

const SQL_PROFIL = `
    SELECT
        COALESCE(displayname, username) AS displayname,
        avatar
    FROM user_profiles
    WHERE CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci = ?
    LIMIT 1
`;

// Typy tego gracza na mecze, razem z nazwami drużyn i wynikiem.
//
// Nazwy i wynik jadą RAZEM z typem, zamiast osobnym zapytaniem, bo dzięki
// temu o tym, którą drużynę gracz wskazał, decyduje ta sama reguła co
// wszędzie indziej - wyższa liczba przy drużynie - i decyduje o tym
// JavaScript, który da się sprawdzić testem bez bazy.
const SQL_TYPY = `
    SELECT
        p.match_id,
        p.pred_a,
        p.pred_b,

        m.team_a,
        m.team_b,

        r.res_a,
        r.res_b

    FROM match_predictions p

    INNER JOIN matches m
        ON m.id = p.match_id

    INNER JOIN match_results r
        ON r.match_id = p.match_id

    WHERE CAST(p.user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci = ?
      AND r.res_a IS NOT NULL
      AND r.res_b IS NOT NULL
`;

// Nazwa gracza, który nigdy nie zalogował się na stronie.
//
// Ta sama lista ośmiu tabel, co w rankingu turnieju i w niespodziankach,
// tyle że BEZ filtra po turnieju - ta strona nie jest w środku żadnego.
// Każda gałąź w nawiasach, bo inaczej MySQL nie przyjmuje LIMIT wewnątrz
// składnika UNION.
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

const SQL_NAZWA = `SELECT nazwa FROM ( ${TABELE_FAZ.map(
  (tabela) => `
        (SELECT CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
                  COLLATE utf8mb4_unicode_ci AS nazwa
           FROM \`${tabela}\`
          WHERE CAST(user_id AS CHAR CHARACTER SET utf8mb4)
                COLLATE utf8mb4_unicode_ci = ?
            AND COALESCE(displayname, username) IS NOT NULL
          LIMIT 1)`,
).join(" UNION ALL ")} ) zrodla WHERE nazwa IS NOT NULL LIMIT 1`;

// Logotypy drużyn. Osobne zapytanie, a nie złączenie do typów: to ta sama
// czterdziestowierszowa tabelka dla każdego gracza, a przy złączeniu ten
// sam adres obrazka wracałby tyle razy, ile ktoś oddał typów.
const SQL_LOGOTYPY = `
    SELECT name_key, logo_url FROM team_logos WHERE logo_url IS NOT NULL
`;

export function registerPlayerCareerRoutes(app, { pool }) {
  // Pamięć podręczna obejmuje WYŁĄCZNIE listę meczów, bo tylko ona jest
  // wspólna dla wszystkich graczy i tylko ona nie zależy od adresu. Reszta
  // dotyczy jednej osoby i trzymanie jej pod kluczem byłoby zapełnianiem
  // pamięci tysiącem wpisów, z których każdy przyda się raz.
  const cacheMeczow = createLeaderboardCache({
    load: async () => {
      const [rows] = await pool.query(SQL_MECZE);

      return buildUpsets(rows, {
        minPicks: MIN_TYPOW,
        thresholdPercent: PROG_PROCENT,
      });
    },
  });

  app.get("/api/public/players/:userId", async (req, res) => {
    try {
      const userId = String(req.params.userId || "");

      const [
        [starty],
        [[profil]],
        [nazwaZFaz],
        [typy],
        [logotypy],
        niespodzianki,
      ] = await Promise.all([
        pool.query(SQL_STARTY, [userId]),
        pool.query(SQL_PROFIL, [userId]),
        pool.query(
          SQL_NAZWA,
          TABELE_FAZ.map(() => userId),
        ),
        pool.query(SQL_TYPY, [userId]),
        pool.query(SQL_LOGOTYPY),
        cacheMeczow.get("upsets"),
      ]);

      // Gracz bez ani jednego startu i bez ani jednego typu w bazie nie
      // istnieje - i lepiej powiedzieć to wprost niż pokazać pustą stronę
      // z jego identyfikatorem w nagłówku.
      if (starty.length === 0 && typy.length === 0) {
        return res.status(404).json({
          error: "Nie znaleziono gracza.",
          code: "server.playerNotFound",
        });
      }

      const { summary, starts } = buildCareer(starty);

      // Kontra liczona TYM SAMYM modułem, co tabela na stronie niespodzianek,
      // tyle że dla jednego gracza. Próg jeden, bo tutaj chodzi o jego
      // dorobek, a nie o miejsce w zestawieniu; ile brakuje do zestawienia,
      // mówi min_chances niżej.
      const [kontra] = buildContrarians(
        typy.map((t) => ({ ...t, user_id: userId })),
        niespodzianki,
        [],
        { minChances: 1 },
      );

      return res.json({
        player: {
          user_id: userId,
          displayname: profil?.displayname || nazwaZFaz[0]?.nazwa || null,
          avatar: profil?.avatar || null,
        },

        summary,
        starts,

        contrarian: kontra
          ? { chances: kontra.chances, hits: kontra.hits, hit_rate: kontra.hit_rate }
          : null,

        teams: buildTeamBias(typy, logotypy, {
          minPicks: MIN_TYPOW_DRUZYNY,
        }),

        picks_total: typy.length,

        // Progi jadą razem z danymi, żeby strona mogła powiedzieć wprost,
        // czego brakuje - zamiast po cichu pokazywać pustą sekcję.
        min_chances: MIN_OKAZJI,
        min_team_picks: MIN_TYPOW_DRUZYNY,
      });
    } catch (err) {
      console.error("PLAYER CAREER ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać profilu gracza.",
        code: "server.playerCareerFailed",
      });
    }
  });
}
