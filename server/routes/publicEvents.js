// Publiczna lista eventow i wyniki pojedynczej fazy.
//
// Lista NIE filtruje po stanie turnieju: zwraca wszystko, oznaczajac tylko,
// czy event jest otwarty na typowanie. Wczesniej strona miala jedyna liste
// filtrowana przez is_active = 1, wiec zamkniety turniej z niej wypadal -
// jego podstrony dzialaly dalej, ale nie bylo do nich z UI zadnego linku.
// Podzial na sekcje robi frontend.

export function registerPublicEventRoutes(
  app,
  {
    getKnownGuildInfo,
    calculateScores,
    isGuildMember,
    pool,
    requireGuildAdmin,
  },
) {
  app.get("/api/public/events", async (req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          e.id,
          e.guild_id,
          e.name,
          e.slug,
          e.phase,
          e.status,
          e.is_open,
          e.is_active,
          e.is_archived,
          e.created_at,

          (e.status = 'OPEN' AND e.is_open = 1 AND e.is_active = 1) AS is_live,

          (
            SELECT COUNT(*)
            FROM matches m
            WHERE m.event_id = e.id
          ) AS matches_count,

          (
            SELECT COUNT(DISTINCT lb.user_id)
            FROM leaderboard lb
            WHERE lb.event_id = e.id
          ) AS participants

        FROM events e
        ORDER BY e.id DESC
        `,
      );

      return res.json({
        events: rows.map((row) => ({
          id: Number(row.id),
          guild_id: row.guild_id,
          name: row.name,
          slug: row.slug,
          phase: row.phase,
          status: row.status,
          is_live: Boolean(Number(row.is_live)),
          is_archived: Boolean(Number(row.is_archived)),
          matches_count: Number(row.matches_count || 0),
          participants: Number(row.participants || 0),
          created_at: row.created_at,
          guild: getKnownGuildInfo(row.guild_id),
        })),
      });
    } catch (err) {
      console.error("PUBLIC EVENTS ERROR:", err);

      return res.status(500).json({
        error: "Nie udalo sie pobrac listy turniejow.",
      });
    }
  });

  // ======================================================
  // PUBLICZNE WYNIKI FAZY + TYP GRACZA
  // ======================================================
  //
  // Wszystkie GET-y z wynikami faz (/api/events/:slug/{swiss,playoffs,playin,
  // doubleelim}-results) sa za requireGuildAdmin, wiec po zamknieciu fazy gracz
  // nie mial gdzie zobaczyc oficjalnego wyniku ani tego, czy trafil. Widzial
  // wylacznie swoj zapisany typ.
  //
  // Jeden endpoint na wszystkie fazy zamiast czterech blizniaczych - ksztalt
  // odpowiedzi jest wspolny: oficjalny wynik, typ gracza, punkty.
  const PHASE_RESULT_KINDS = {
    stage1: "swiss",
    stage2: "swiss",
    stage3: "swiss",
    playoffs: "playoffs",
    playin: "playin",
    doubleelim: "doubleelim",
  };

  // Typy trzymane sa jako tekst "A, B, C" - ta sama normalizacja co w
  // calculateScores (cleanList), zeby trafienia liczyly sie identycznie.
  function splitTeamList(value) {
    if (!value) return [];

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // zwykly CSV
    }

    return String(value)
      .replace(/[[\]"]+/g, "")
      .split(/[;,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  app.get("/api/public/events/:slug/phase-results/:phase", async (req, res) => {
    try {
      const { slug, phase } = req.params;
      const userId = req.session?.user?.id || null;

      const kind = PHASE_RESULT_KINDS[phase];

      if (!kind) {
        return res.status(400).json({
          error: "Nieznana faza turnieju.",
        });
      }

      const [[event]] = await pool.query(
        "SELECT id, guild_id, name, slug FROM events WHERE slug = ? LIMIT 1",
        [slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // Typ i punkty sa prywatne - pokazujemy je wylacznie zalogowanemu
      // czlonkowi tej gildii. Sam oficjalny wynik jest publiczny.
      const czlonek = Boolean(
        userId && isGuildMember(req.session.user, event.guild_id),
      );

      let results = null;
      let prediction = null;
      let points = null;

      if (kind === "swiss") {
        const [[row]] = await pool.query(
          `SELECT correct_3_0, correct_0_3, correct_advancing
             FROM swiss_results
            WHERE guild_id = ? AND event_id = ? AND stage = ? AND active = 1
            ORDER BY id DESC LIMIT 1`,
          [event.guild_id, event.id, phase],
        );

        if (row) {
          results = {
            three_zero: splitTeamList(row.correct_3_0),
            zero_three: splitTeamList(row.correct_0_3),
            advancing: splitTeamList(row.correct_advancing),
          };
        }

        if (czlonek) {
          const [[pred]] = await pool.query(
            `SELECT pick_3_0, pick_0_3, advancing
               FROM swiss_predictions
              WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
              LIMIT 1`,
            [event.guild_id, event.id, userId, phase],
          );

          if (pred) {
            prediction = {
              three_zero: splitTeamList(pred.pick_3_0),
              zero_three: splitTeamList(pred.pick_0_3),
              advancing: splitTeamList(pred.advancing),
            };
          }

          const [[score]] = await pool.query(
            `SELECT points FROM swiss_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
              LIMIT 1`,
            [event.guild_id, event.id, userId, phase],
          );

          if (score) points = Number(score.points || 0);
        }
      }

      if (kind === "playoffs") {
        const [[row]] = await pool.query(
          `SELECT correct_semifinalists, correct_finalists, correct_winner,
                  correct_third_place_winner
             FROM playoffs_results
            WHERE guild_id = ? AND event_id = ? AND active = 1
            ORDER BY id DESC LIMIT 1`,
          [event.guild_id, event.id],
        );

        if (row) {
          results = {
            semifinalists: splitTeamList(row.correct_semifinalists),
            finalists: splitTeamList(row.correct_finalists),
            winner: row.correct_winner || null,
            third_place_winner: row.correct_third_place_winner || null,
          };
        }

        if (czlonek) {
          const [[pred]] = await pool.query(
            `SELECT semifinalists, finalists, winner, third_place_winner
               FROM playoffs_predictions
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (pred) {
            prediction = {
              semifinalists: splitTeamList(pred.semifinalists),
              finalists: splitTeamList(pred.finalists),
              winner: pred.winner || null,
              third_place_winner: pred.third_place_winner || null,
            };
          }

          const [[score]] = await pool.query(
            `SELECT points FROM playoffs_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (score) points = Number(score.points || 0);
        }
      }

      if (kind === "playin") {
        const [[row]] = await pool.query(
          `SELECT correct_teams FROM playin_results
            WHERE guild_id = ? AND event_id = ? AND active = 1
            ORDER BY id DESC LIMIT 1`,
          [event.guild_id, event.id],
        );

        if (row) results = { teams: splitTeamList(row.correct_teams) };

        if (czlonek) {
          const [[pred]] = await pool.query(
            `SELECT teams FROM playin_predictions
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (pred) prediction = { teams: splitTeamList(pred.teams) };

          const [[score]] = await pool.query(
            `SELECT points FROM playin_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (score) points = Number(score.points || 0);
        }
      }

      if (kind === "doubleelim") {
        const [[row]] = await pool.query(
          `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
             FROM doubleelim_results
            WHERE guild_id = ? AND event_id = ? AND active = 1
            ORDER BY id DESC LIMIT 1`,
          [event.guild_id, event.id],
        );

        if (row) {
          results = {
            upper_final_a: splitTeamList(row.upper_final_a),
            lower_final_a: splitTeamList(row.lower_final_a),
            upper_final_b: splitTeamList(row.upper_final_b),
            lower_final_b: splitTeamList(row.lower_final_b),
          };
        }

        if (czlonek) {
          const [[pred]] = await pool.query(
            `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
               FROM doubleelim_predictions
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (pred) {
            prediction = {
              upper_final_a: splitTeamList(pred.upper_final_a),
              lower_final_a: splitTeamList(pred.lower_final_a),
              upper_final_b: splitTeamList(pred.upper_final_b),
              lower_final_b: splitTeamList(pred.lower_final_b),
            };
          }

          const [[score]] = await pool.query(
            `SELECT points FROM doubleelim_scores
              WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
            [event.guild_id, event.id, userId],
          );

          if (score) points = Number(score.points || 0);
        }
      }

      return res.json({
        event: { id: event.id, name: event.name, slug: event.slug },
        phase,
        kind,
        published: Boolean(results),
        results,
        prediction,
        points,
      });
    } catch (err) {
      console.error("PHASE RESULTS ERROR:", err);

      return res.status(500).json({
        error: "Nie udalo sie pobrac wynikow fazy.",
      });
    }
  });
}
