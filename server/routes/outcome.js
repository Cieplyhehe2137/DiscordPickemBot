// Wynik turnieju jako publiczne API.
//
// Po co ta trasa istnieje, stoi w server/lib/outcome.js. Tutaj jest
// wyłącznie pobranie - cała reguła siedzi w funkcji czystej obok.
//
// TRZY ZAPYTANIA, JEDNA FALA. Żadne nie potrzebuje wyniku pozostałych:
// wszystkie zależą wyłącznie od slugu, znanego z adresu. Każde to osobna
// podróż do bazy stojącej na innej maszynie niż API - zmierzone 177 ms,
// niezależnie od tego, ile wierszy wraca.
//
// OSOBNA TRASA, tak samo jak głosowanie na MVP i z tego samego powodu:
// strona turnieju pobiera swoje sekcje niezależnie, więc brak wyniku
// w jednej nie opóźnia ani nie przewraca pozostałych.
//
// ADRES MA TRZY SEGMENTY po /api/public/, więc nie wpada w pułapkę
// /api/public/:guildSlug; ten wzorzec łapie tylko jeden segment.

import { buildOutcome } from "../lib/outcome.js";

// active = 1, bo tabela trzyma historię: administrator może poprawić wynik,
// a stare wiersze zostają wyłączone (patrz server/routes/phaseResults.js).
//
// Do niedawna ten sam warunek ukrywał wynik IEM Cologne Major 2026, bo
// import wstawił tam wiersze z DEFAULT-em 0 - naprawiły to migracje 0010
// i 0011.
const SQL_WYNIK = `
    SELECT
        correct_semifinalists,
        correct_finalists,
        correct_winner,
        correct_third_place_winner

    FROM playoffs_results

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
      AND active = 1

    ORDER BY id DESC
    LIMIT 1
`;

// Same typy, bez nazw graczy: ta sekcja mówi, ILU trafiło, a nie kto.
// Kto - jest w rankingu turnieju i na profilach.
const SQL_TYPY = `
    SELECT
        winner,
        finalists,
        semifinalists

    FROM playoffs_predictions

    WHERE event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)
`;

const SQL_LOGOTYPY = `
    SELECT name_key, logo_url FROM team_logos WHERE logo_url IS NOT NULL
`;

export function registerOutcomeRoutes(app, { pool }) {
  app.get("/api/public/events/:slug/outcome", async (req, res) => {
    try {
      const { slug } = req.params;

      const [[[wynik]], [typy], [logotypy]] = await Promise.all([
        pool.query(SQL_WYNIK, [slug]),
        pool.query(SQL_TYPY, [slug]),
        pool.query(SQL_LOGOTYPY),
      ]);

      // Brak wiersza wyników to turniej jeszcze nierozstrzygnięty - albo
      // taki, w którym administrator wyniku nie wpisał. buildOutcome odda
      // wtedy settled: false, a strona po prostu nie pokaże sekcji.
      return res.json(buildOutcome(wynik ?? null, typy, { logos: logotypy }));
    } catch (err) {
      console.error("OUTCOME ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać wyniku turnieju.",
        code: "server.outcomeFailed",
      });
    }
  });
}
