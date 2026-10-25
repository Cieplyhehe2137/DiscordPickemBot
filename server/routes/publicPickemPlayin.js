// Formularz fazy Play-In: odczyt i zapis typu.
//
// Typ to jedna lista druzyn, ktore awansuja - najprostsza ze czterech
// faz. Playoffs i Double Elim maja po kilka osobnych slotow.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import { loadPhaseTeams, withPickedTeams } from "../lib/phaseFormTeams.js";
import { phaseLockResponse } from "../lib/phaseLock.js";

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
  app.get("/api/public/events/:slug/playin-pickem", async (req, res) => {
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

      const gate = await checkPickemGate(event.guild_id, "PLAYIN");

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

        if (row) {
          prediction = {
            teams: parseCsvPick(row.teams),
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(teams, prediction?.teams),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "playin"),

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
        error: "Nie udało się wczytać typów Play-In.",
        code: "server.playinPicksLoadFailed",
      });
    }
  });

  app.post("/api/public/events/:slug/playin-pickem", async (req, res) => {
    try {
      const userId = req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: "Musisz być zalogowany.",
          code: "server.mustLogin",
        });
      }

      const { slug } = req.params;
      const { teams } = req.body;

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          status
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

      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
          code: "server.notMember",
        });
      }

      const gate = await checkPickemGate(event.guild_id, "PLAYIN");

      if (!gate.allowed) {
        return res
          .status(403)
          .json(phaseLockResponse(gate, toWebMessage, "playin"));
      }

      // ============================================
      // AKTUALNY EVENT - zgodność z Discordem 1:1
      // ============================================

      const currentEventId = await getOpenEventId(pool, event.guild_id);

      if (!currentEventId) {
        return res.status(403).json({
          error: "Nie znaleziono aktywnego eventu.",
        });
      }

      if (Number(currentEventId) !== Number(event.id)) {
        return res.status(409).json({
          error:
            "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Play-In.",
          code: "server.stale.playin",
        });
      }

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
