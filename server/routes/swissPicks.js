// Typy na fazy Swiss jako publiczne API.
//
// Po co to istnieje, stoi w server/lib/swissPicks.js. Tutaj jest wyłącznie
// pobranie - cała reguła siedzi w funkcji czystej obok.
//
// CZTERY ZAPYTANIA, JEDNA FALA. Żadne nie potrzebuje wyniku pozostałych:
// wszystkie zależą tylko od slugu. Każde to osobna podróż do bazy stojącej
// na innej maszynie niż API - zmierzone 177 ms, niezależnie od liczby
// wierszy.
//
// CZYM TO SIĘ RÓŻNI OD ISTNIEJĄCEJ /swiss-stats/:stage: tamta oddaje sam
// podział głosów dla JEDNEGO etapu i nie wie nic o tym, co naprawdę się
// stało. Ta bierze wszystkie etapy naraz i zestawia je z swiss_results,
// czyli z poprawną odpowiedzią - a to dopiero robi z liczb historię.
// Obie liczą podział przez ten sam moduł, żeby nie rozjechały się z czasem.
//
// ADRES MA TRZY SEGMENTY po /api/public/, więc nie wpada w pułapkę
// /api/public/:guildSlug; ten wzorzec łapie tylko jeden segment.

import { buildSwissPicks } from "../lib/swissPicks.js";

const SQL_EVENT = `
    SELECT id, name, slug FROM events WHERE slug = ? LIMIT 1
`;

// active = 1 w obu tabelach, bo trzymają historię. Do niedawna ten warunek
// ukrywał CAŁY IEM Cologne Major 2026 - import wstawił tam wiersze
// z DEFAULT-em 0, co naprawiły migracje 0010 i 0011.
const SQL_TYPY = `
    SELECT stage, pick_3_0, pick_0_3, advancing

    FROM swiss_predictions

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      AND active = 1
`;

const SQL_WYNIKI = `
    SELECT stage, correct_3_0, correct_0_3, correct_advancing

    FROM swiss_results

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      AND active = 1
`;

const SQL_LOGOTYPY = `
    SELECT name_key, logo_url FROM team_logos WHERE logo_url IS NOT NULL
`;

export function registerSwissPicksRoutes(app, { pool }) {
  app.get("/api/public/events/:slug/swiss-picks", async (req, res) => {
    try {
      const { slug } = req.params;

      const [[[event]], [typy], [wyniki], [logotypy]] = await Promise.all([
        pool.query(SQL_EVENT, [slug]),
        pool.query(SQL_TYPY, [slug]),
        pool.query(SQL_WYNIKI, [slug]),
        pool.query(SQL_LOGOTYPY),
      ]);

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      return res.json({
        event: { id: event.id, name: event.name, slug: event.slug },

        // Turniej bez fazy Swiss odda pustą listę etapów - strona pokaże
        // wtedy stan pusty, a nie błąd. Nie każdy format ma Swiss:
        // IEM Kraków 2026 miał play-in i double elim.
        ...buildSwissPicks(typy, wyniki, { logos: logotypy }),
      });
    } catch (err) {
      console.error("SWISS PICKS ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać typów na fazy.",
        code: "server.swissPicksFailed",
      });
    }
  });
}
