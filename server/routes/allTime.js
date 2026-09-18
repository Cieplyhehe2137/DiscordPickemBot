// Klasyfikacja wszech czasów jako publiczne API.
//
// Reguła - dlaczego percentyl, a nie punkty, i dlaczego od dwóch startów -
// siedzi w server/lib/allTime.js. Tutaj jest wyłącznie pobranie danych.
//
// JEDNO ZAPYTANIE NA CAŁOŚĆ. Miejsca we wszystkich turniejach liczy jedno
// przejście po tabeli klasyfikacji: ROW_NUMBER z PARTITION BY event_id daje
// miejsce w każdym turnieju osobno, a COUNT(*) OVER tę samą stawkę, względem
// której to miejsce się liczy. Ten sam wzór, którego używa profil gracza -
// i to nie jest przypadek: gracz widzi „TOP 3%" na profilu i ta sama liczba
// ma stać za jego miejscem tutaj.
//
// Tabela ma dziś około 1300 wierszy, więc całość schodzi w jednej podróży do
// bazy. Podróż kosztuje 177 ms zmierzone na serwerze, niezależnie od tego,
// ile wierszy wraca - dlatego liczy się ich LICZBA, a nie rozmiar odpowiedzi.
//
// Grupowanie po graczu robi się w JavaScripcie, a nie w SQL-u. Powód: żeby
// podać najlepszy start trzeba znać nazwę turnieju, w którym padł, a to w SQL
// wymaga drugiego przejścia albo funkcji okna na funkcji okna. W JS to pętla
// po wierszach, która dodatkowo daje się sprawdzić testem bez bazy.

import { buildAllTime } from "../lib/allTime.js";
import { createLeaderboardCache } from "../lib/leaderboardCache.js";

// Ile startów uprawnia do miejsca w tabeli. Stała, a nie parametr zapytania:
// próg jest częścią tego, co ta tabela znaczy, a nie ustawieniem widoku.
// Gdyby dało się go podać z adresu, każdy link niósłby inny ranking.
const MIN_STARTOW = 2;

const SQL = `
    SELECT
        r.user_id,
        r.event_id,
        r.total_points,
        r.rank_position,
        r.uczestnicy,

        e.name,
        e.slug,

        p.displayname,
        p.avatar

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

    LEFT JOIN user_profiles p
        ON CAST(p.user_id AS CHAR CHARACTER SET utf8mb4)
           COLLATE utf8mb4_unicode_ci = r.user_id

    ORDER BY r.event_id DESC
`;

export function registerAllTimeRoutes(app, { pool }) {
  // Ta sama pamięć podręczna, co ranking turnieju. Klucz jest jeden, bo
  // klasyfikacja jest jedna - ale scalanie żądań działa tak samo i o nie
  // tu chodzi: gdy po zakończeniu turnieju wszyscy wchodzą zobaczyć, jak
  // zmieniła się tabela, liczy się ona raz, a nie raz na osobę.
  const cache = createLeaderboardCache({
    load: async () => {
      const [rows] = await pool.query(SQL);

      return buildAllTime(rows, { minStarts: MIN_STARTOW });
    },
  });

  app.get("/api/public/all-time", async (req, res) => {
    try {
      const classification = await cache.get("all-time");

      res.json({
        classification,

        // Próg i liczba turniejów jadą razem z danymi, bo strona ma
        // powiedzieć wprost, czego brakuje komuś, kogo w tabeli nie ma.
        min_starts: MIN_STARTOW,
      });
    } catch (err) {
      console.error("ALL TIME ERROR:", err);

      res.status(500).json({
        error: "Nie udało się wczytać klasyfikacji wszech czasów.",
        code: "server.allTimeFailed",
      });
    }
  });
}
