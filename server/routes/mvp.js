// Głosowanie na MVP jako publiczne API.
//
// Dlaczego ta trasa w ogóle powstała - i co w tych danych leży - stoi
// w server/lib/mvpVote.js. Tutaj jest wyłącznie pobranie.
//
// JEDNO ZAPYTANIE. Kandydaci, liczba głosów na każdego i wskazanie
// zwycięzcy mieszczą się w jednym przejściu: głosy jako podzapytanie
// grupujące po kandydacie, wynik jako złączenie po turnieju. Osobne
// zapytania byłyby trzema podróżami do bazy po dane, z których żadne
// nie zależy od pozostałych - zmierzone 177 ms za sztukę.
//
// ADRES MA TRZY SEGMENTY po /api/public/, więc nie wpada w pułapkę
// /api/public/:guildSlug; ten wzorzec łapie tylko jeden segment.

import { buildMvpVote } from "../lib/mvpVote.js";

// Kandydaci danego turnieju razem z liczbą głosów i znacznikiem zwycięzcy.
//
// LEFT JOIN do wyniku, a nie INNER: przed rozstrzygnięciem wiersza w
// mvp_results nie ma, a sekcja ma wtedy pokazać sam podział głosów.
//
// r.active = 1, bo tabela trzyma historię wskazań - administrator może
// poprawić zwycięzcę, a stare wiersze zostają z active = 0.
const SQL = `
    SELECT
        k.id AS candidate_id,
        k.nickname,
        k.team_name,

        COALESCE(g.votes, 0) AS votes,

        CASE WHEN r.candidate_id = k.id THEN 1 ELSE 0 END AS is_winner

    FROM mvp_candidates k

    LEFT JOIN (
        SELECT candidate_id, COUNT(*) AS votes
        FROM mvp_predictions
        GROUP BY candidate_id
    ) g
        ON g.candidate_id = k.id

    LEFT JOIN mvp_results r
        ON r.event_id = k.event_id
       AND r.active = 1

    WHERE k.event_id = (SELECT id FROM events WHERE slug = ? LIMIT 1)

    ORDER BY votes DESC, k.nickname ASC
`;

export function registerMvpRoutes(app, { pool }) {
  app.get("/api/public/events/:slug/mvp", async (req, res) => {
    try {
      const [rows] = await pool.query(SQL, [req.params.slug]);

      // Turniej bez ani jednego kandydata to turniej, w którym głosowania
      // nie było. To nie jest błąd - strona po prostu nie pokazuje sekcji.
      if (rows.length === 0) {
        return res.json({
          total_votes: 0,
          resolved: false,
          winner: null,
          hit_rate: null,
          candidates: [],
        });
      }

      return res.json(buildMvpVote(rows));
    } catch (err) {
      console.error("MVP VOTE ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać głosowania na MVP.",
        code: "server.mvpVoteFailed",
      });
    }
  });
}
