// Mecze turnieju razem z typem gracza: GET /api/events/:slug/matches.
//
// Zapytanie sklada buildMatchesWithPickSql, a stan typowania kazdego
// meczu - resolveMatchPredictionState. Obie rzeczy sa wspolne z panelem
// meczow, bo lista meczow i panel pokazuja te same blokady: gate
// turnieju, blokade meczu i termin fazy.
//
// Wydzielone z events.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

export function registerEventMatchListRoutes(
  app,
  {
    assertPredictionsAllowed,
    buildMatchesWithPickSql,
    pool,
    resolveMatchPredictionState,
  },
) {
  app.get("/api/events/:slug/matches", async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = req.session?.user?.id || null;

      const [[event]] = await pool.query(
        `
        SELECT id, name, slug, guild_id
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
          code: "server.eventNotFound",
        });
      }

      // ============================================
      // MECZE
      // ============================================

      const [matches] = await pool.query(
        buildMatchesWithPickSql("m.event_id = ?"),
        [userId, userId, userId, event.id],
      );

      // ============================================
      // GLOBALNY GATE
      // ============================================

      const gate = await assertPredictionsAllowed({
        guildId: event.guild_id,
        kind: "MATCHES",
      });

      const deadlineCache = new Map();

      // ============================================
      // LOCK STATE
      // ============================================

      const matchesWithPredictionState = await Promise.all(
        matches.map((match) =>
          resolveMatchPredictionState({
            match,
            gate,
            guildId: event.guild_id,
            deadlineCache,
          }),
        ),
      );

      // ============================================
      // PROGRESS PER FAZA
      // ============================================

      const progress = {};

      for (const match of matchesWithPredictionState) {
        const phase = match.phase || "other";

        if (!progress[phase]) {
          progress[phase] = {
            total: 0,
            complete: 0,
            partial: 0,
            empty: 0,
          };
        }

        progress[phase].total += 1;

        if (match.prediction_status === "complete") {
          progress[phase].complete += 1;
        } else if (match.prediction_status === "partial") {
          progress[phase].partial += 1;
        } else {
          progress[phase].empty += 1;
        }
      }

      // ============================================
      // RESPONSE
      // ============================================

      res.json({
        event,
        matches: matchesWithPredictionState,
        progress,
      });
    } catch (err) {
      console.error("EVENT MATCHES ERROR:", err);

      res.status(500).json({
        error: "Błąd bazy danych.",
        code: "server.dbError",
      });
    }
  });
}
