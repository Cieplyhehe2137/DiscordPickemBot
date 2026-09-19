import { teamKey } from "../lib/teamLogos.js";
import { buildTeamStats, sortTeams } from "../lib/teamStats.js";
import { buildTeamPhasePicks } from "../lib/teamPhasePicks.js";

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
  const [[matches], [splits], [logos], [typyFaz], [wynikiFaz]] =
    await Promise.all([
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

    // Typy fazowe - druga połowa tego, co społeczność o drużynach sądzi.
    // Bez WHERE po turnieju: wierszy jest 1420 w całej bazie, a filtrowanie
    // znaczyłoby tyle zapytań, ile turniejów.
    pool.query(
      `SELECT event_id, stage, pick_3_0, pick_0_3, advancing
         FROM swiss_predictions
        WHERE active = 1`,
    ),

    pool.query(
      `SELECT event_id, stage, correct_3_0, correct_0_3, correct_advancing
         FROM swiss_results
        WHERE active = 1`,
    ),
  ]);

  const { teams, history } = buildTeamStats(matches, splits, logos);

  const fazy = buildTeamPhasePicks(typyFaz, wynikiFaz, { logos });

  // Drużyny z meczów dostają warstwę fazową doklejoną OSOBNO, a nie wmieszaną
  // w istniejące liczby. „Zaufanie 80% / wygrywa 29%" mówi o meczach, a „ilu
  // typowało awans" to inne pytanie i inna skala - zlane w jedną liczbę nie
  // dałyby się zinterpretować.
  const zFazami = teams.map((t) => ({ ...t, phase: fazy.get(t.key) ?? null }));

  // ...a drużyny, które NIGDY nie zagrały meczu, dochodzą na koniec listy.
  // To jest cały powód tej zmiany: siedem zespołów z Budapesztu nie miało
  // dotąd na stronie żadnej reprezentacji.
  const znane = new Set(teams.map((t) => t.key));

  for (const [klucz, f] of fazy) {
    if (znane.has(klucz)) continue;

    zFazami.push({
      key: klucz,
      name: f.name,
      logo: f.logo,

      // Zera, nie null: tych meczów naprawdę nie ma. Widok pomija wtedy
      // całą sekcję meczową, zamiast pokazywać "0 meczów, 0% skuteczności".
      matches: 0,
      settled: 0,
      wins: 0,
      losses: 0,
      events: 0,

      picks_for: 0,
      picks_total: 0,
      picks_right: 0,

      trust: null,
      trust_hit: null,
      win_rate: null,

      phase: f,
    });
  }

  return { teams: zFazami, history };
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
        code: "server.teamsLoadFailed",
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
        return res.status(404).json({
          error: "Nie znaleziono drużyny.",
          code: "server.teamNotFound",
        });
      }

      const { teams, history } = await wczytaj(pool);

      const team = teams.find((t) => t.key === klucz);

      if (!team) {
        return res.status(404).json({
          error: "Nie znaleziono drużyny.",
          code: "server.teamNotFound",
        });
      }

      return res.json({
        team,
        matches: history.get(klucz) || [],
      });
    } catch (err) {
      console.error("TEAM DETAIL ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać drużyny.",
        code: "server.teamLoadFailed",
      });
    }
  });
}
