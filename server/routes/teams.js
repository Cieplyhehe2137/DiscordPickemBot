import { teamKey } from "../lib/teamLogos.js";
import { buildTeamStats, sortTeams } from "../lib/teamStats.js";

// Drużyny: lista i pojedyncza drużyna.
//
// Obie trasy stoją na tych samych trzech zapytaniach, bo cała potrzebna
// wiedza to mecze, podział głosów i logotypy - razem sto kilkadziesiąt
// wierszy. Liczenie tego osobno dla listy i osobno dla strony drużyny
// znaczyłoby dwa zestawy zapytań, które z czasem by się rozjechały.
//
// Zapytania idą jedną falą. Każde z nich to osobna podróż do bazy stojącej
// na innej maszynie niż API - zmierzone na produkcji około 165 ms, i to
// niezależnie od tego, ile wierszy wraca.

async function wczytaj(pool) {
  const [[matches], [splits], [logos]] = await Promise.all([
    pool.query(
      `
      SELECT
        m.id,
        m.event_id,
        m.phase,
        m.team_a,
        m.team_b,

        mr.res_a,
        mr.res_b,

        e.name AS event_name,
        e.slug AS event_slug

      FROM matches m

      INNER JOIN events e
        ON e.id = m.event_id

      LEFT JOIN match_results mr
        ON mr.event_id = m.event_id
       AND mr.match_id = m.id

      ORDER BY
        m.event_id DESC,
        COALESCE(m.match_no, m.id) ASC
      `,
    ),

    // Podział głosów na mecz. Typ z równym wynikiem (2:2) nie wskazuje
    // żadnej strony, ale liczy się do sumy - inaczej procenty obu drużyn
    // sumowałyby się do czegoś innego niż sto.
    pool.query(
      `
      SELECT
        match_id,
        SUM(CASE WHEN pred_a > pred_b THEN 1 ELSE 0 END) AS for_a,
        SUM(CASE WHEN pred_b > pred_a THEN 1 ELSE 0 END) AS for_b,
        COUNT(*) AS total
      FROM match_predictions
      GROUP BY match_id
      `,
    ),

    pool.query(
      `SELECT name_key, logo_url FROM team_logos WHERE logo_url IS NOT NULL`,
    ),
  ]);

  return buildTeamStats(matches, splits, logos);
}

export function registerTeamRoutes(app, { pool }) {
  app.get("/api/public/teams", async (req, res) => {
    try {
      const { teams } = await wczytaj(pool);

      return res.json({ teams: sortTeams(teams) });
    } catch (err) {
      console.error("TEAMS LIST ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać drużyn.",
      });
    }
  });

  app.get("/api/public/teams/:name", async (req, res) => {
    try {
      // Adres niesie nazwę czytelną dla człowieka ("/teams/FaZe"), a nie
      // klucz - dopiero tutaj sprowadzamy ją do klucza. Dzięki temu
      // "/teams/FUT" i "/teams/FUT%20Esports" trafiają w to samo miejsce.
      const klucz = teamKey(req.params.name);

      if (!klucz) {
        return res.status(404).json({ error: "Nie znaleziono drużyny." });
      }

      const { teams, history } = await wczytaj(pool);

      const team = teams.find((t) => t.key === klucz);

      if (!team) {
        return res.status(404).json({ error: "Nie znaleziono drużyny." });
      }

      return res.json({
        team,
        matches: history.get(klucz) || [],
      });
    } catch (err) {
      console.error("TEAM DETAIL ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać drużyny.",
      });
    }
  });
}
