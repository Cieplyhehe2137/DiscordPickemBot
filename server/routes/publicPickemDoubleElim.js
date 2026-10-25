// Formularz fazy Double Elimination: odczyt i zapis typu.
//
// Cztery sloty po dwie druzyny (upper/lower final A i B). Nazwy meczow
// drabinki zostaja po angielsku we wszystkich jezykach - tak stoja
// w formularzu i tak mowi o nich spolecznosc.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import { loadPhaseTeams, withPickedTeams } from "../lib/phaseFormTeams.js";
import { preparePhaseSave, sendRejection } from "../lib/phaseSaveGuard.js";

export function registerPublicPickemDoubleElimRoutes(
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
  // Zaleznosci wspolnej sciezki do zapisu, zebrane raz. Sama sciezka stoi
  // w server/lib/phaseSaveGuard.js - razem dla wszystkich czterech faz.
  const guardDeps = {
    pool,
    isGuildMember,
    checkPickemGate,
    getOpenEventId,
    toWebMessage,
  };

  app.get("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id || null;
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug, status
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

      const gate = await checkPickemGate(event.guild_id, "DOUBLEELIM");

      const teams = await loadPhaseTeams({
        pool,
        eventId: event.id,
        guildId: event.guild_id,
        allowed: gate.allowed,
      });

      let prediction = null;

      if (userId) {
        // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
        // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
        // endpointy jako jedyne pozwalały odpytać event obcego serwera.
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
            code: "server.notMember",
          });
        }

        const [[row]] = await pool.query(
          `
                  SELECT
                      upper_final_a,
                      lower_final_a,
                      upper_final_b,
                      lower_final_b
                  FROM doubleelim_predictions
                  WHERE guild_id = ?
    AND event_id = ?
    AND user_id = ?
    AND active = 1
                  LIMIT 1
                  `,
          [event.guild_id, event.id, userId],
        );

        if (row) {
          prediction = {
            upper_final_a: parseCsvPick(row.upper_final_a),
            lower_final_a: parseCsvPick(row.lower_final_a),
            upper_final_b: parseCsvPick(row.upper_final_b),
            lower_final_b: parseCsvPick(row.lower_final_b),
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(
          teams,
          prediction?.upper_final_a,
          prediction?.lower_final_a,
          prediction?.upper_final_b,
          prediction?.lower_final_b,
        ),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "doubleelim"),

        prediction,
        lock: {
          allowed: gate.allowed,
          message: toWebMessage(gate.message, null),

          // Termin zamkniecia typowania - patrz uwaga przy trasie Swiss.
          deadline: gate.deadline ?? null,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać typów Double Elimination.",
        code: "server.dePicksLoadFailed",
      });
    }
  });

  app.post("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
    try {
      const { upper_final_a, lower_final_a, upper_final_b, lower_final_b } =
        req.body;

      const prepared = await preparePhaseSave(req, guardDeps, {
        phase: "doubleelim",
      });

      if (prepared.rejected) return sendRejection(res, prepared.rejected);

      const { userId, event, currentEventId } = prepared;

      // ============================================
      // NORMALIZACJA
      // ============================================

      const normalizeTeams = (value) =>
        Array.isArray(value)
          ? value.map((team) => String(team).trim()).filter(Boolean)
          : [];

      const ufa = normalizeTeams(upper_final_a);
      const lfa = normalizeTeams(lower_final_a);
      const ufb = normalizeTeams(upper_final_b);
      const lfb = normalizeTeams(lower_final_b);

      // ============================================
      // KAŻDY SLOT = DOKŁADNIE 2 DRUŻYNY
      // ============================================

      // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
      // czyli zachowanie sprzed tej zmiany).
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "doubleelim",
      );

      const walidacja = sprawdzTyp(limity && "doubleelim", limity, {
        upperFinalA: ufa,
        lowerFinalA: lfa,
        upperFinalB: ufb,
        lowerFinalB: lfb,
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      const allTeams = [...ufa, ...lfa, ...ufb, ...lfb];

      // ============================================
      // TYLKO AKTYWNE DRUŻYNY
      // ============================================

      const teamNames = await loadActiveTeams(pool, event.guild_id);

      const validTeams = new Set(teamNames);

      const invalidTeams = [
        ...new Set(allTeams.filter((team) => !validTeams.has(team))),
      ];

      if (invalidTeams.length > 0) {
        return res.status(400).json({
          error: `Invalid teams: ${invalidTeams.join(", ")}`,
        });
      }

      // ============================================
      // SAVE
      // ============================================

      await pool.query(
        `
        INSERT INTO doubleelim_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          upper_final_a,
          lower_final_a,
          upper_final_b,
          lower_final_b,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          upper_final_a = VALUES(upper_final_a),
          lower_final_a = VALUES(lower_final_a),
          upper_final_b = VALUES(upper_final_b),
          lower_final_b = VALUES(lower_final_b),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          ufa.join(", "),
          lfa.join(", "),
          ufb.join(", "),
          lfb.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          upper_final_a: ufa,
          lower_final_a: lfa,
          upper_final_b: ufb,
          lower_final_b: lfb,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Double Elimination.",
        code: "server.dePicksSaveFailed",
      });
    }
  });
}
