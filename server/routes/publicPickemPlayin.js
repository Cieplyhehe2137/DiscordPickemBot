// Formularz fazy Play-In: odczyt i zapis typu.
//
// Typ to jedna lista druzyn, ktore awansuja - najprostsza ze czterech
// faz. Playoffs i Double Elim maja po kilka osobnych slotow.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import {
  preparePhaseSave,
  readPhaseForm,
  sendRejection,
} from "../lib/phaseForms.js";

export function registerPublicPickemPlayinRoutes(
  app,
  {
    checkPickemGate,
    getOpenEventId,
    getPhaseLimits,
    isGuildMember,
    loadActiveTeams,
    parseCsvPick,
    pool,
    sprawdzTyp,
    toWebMessage,
  },
) {
  // Zaleznosci wspolnych sciezek formularza fazy, zebrane raz. Same sciezki
  // stoja w server/lib/phaseForms.js i kazda bierze z tego worka tylko to,
  // czego potrzebuje.
  const phaseDeps = {
    pool,
    getPhaseLimits,
    isGuildMember,
    checkPickemGate,
    getOpenEventId,
    toWebMessage,
  };

  app.get("/api/public/events/:slug/playin-pickem", async (req, res) => {
    try {
      const form = await readPhaseForm(req, phaseDeps, {
        phase: "playin",

        readPrediction: async ({ pool, event, userId }) => {
          const [[row]] = await pool.query(
            `
            SELECT teams
            FROM playin_predictions
            WHERE guild_id = ?
              AND event_id = ?
              AND user_id = ?
              AND active = 1
            LIMIT 1
            `,
            [event.guild_id, event.id, userId],
          );

          if (!row) return null;

          const prediction = { teams: parseCsvPick(row.teams) };

          return { prediction, picked: [prediction.teams] };
        },
      });

      if (form.rejected) return sendRejection(res, form.rejected);

      res.json(form.body);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać typów Play-In.",
        code: "server.playinPicksLoadFailed",
      });
    }
  });

  app.post("/api/public/events/:slug/playin-pickem", async (req, res) => {
    try {
      const { teams } = req.body;

      const prepared = await preparePhaseSave(req, phaseDeps, {
        phase: "playin",
      });

      if (prepared.rejected) return sendRejection(res, prepared.rejected);

      const { userId, event, currentEventId } = prepared;

      // ============================================
      // WYBÓR DRUŻYN
      // ============================================

      const selectedTeams = Array.isArray(teams)
        ? teams
          .map((team) => String(team).trim())
          .filter(Boolean)
        : [];

      // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
      // czyli zachowanie sprzed tej zmiany).
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "playin",
      );

      const walidacja = sprawdzTyp(limity && "playin", limity, { teams: selectedTeams });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      // ============================================
      // AKTYWNE DRUŻYNY
      // ============================================

      const validTeamNames = await loadActiveTeams(pool, event.guild_id);

      const validTeams = new Set(validTeamNames);

      const invalidTeams = selectedTeams.filter((team) => !validTeams.has(team));

      if (invalidTeams.length > 0) {
        return res.status(400).json({
          error: `Invalid teams: ${invalidTeams.join(", ")}`,
        });
      }

      // ============================================
      // ZAPIS
      // ============================================

      await pool.query(
        `
        INSERT INTO playin_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          teams,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          teams = VALUES(teams),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          selectedTeams.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          teams: selectedTeams,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Play-In.",
        code: "server.playinPicksSaveFailed",
      });
    }
  });
}
