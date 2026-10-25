// Formularz fazy Playoffs: odczyt i zapis typu.
//
// Cztery grupy naraz - polfinalisci, finalisci, zwyciezca i mecz
// o trzecie miejsce - wiec zapis dotyka czterech kolumn jednego
// wiersza, a nie jednej listy jak Play-In.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import { loadPhaseTeams, withPickedTeams } from "../lib/phaseFormTeams.js";
import { preparePhaseSave, sendRejection } from "../lib/phaseSaveGuard.js";

export function registerPublicPickemPlayoffsRoutes(
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

  app.get("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
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

      const gate = await checkPickemGate(event.guild_id, "PLAYOFFS");

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
                  SELECT semifinalists, finalists, winner, third_place_winner
                  FROM playoffs_predictions
                  WHERE event_id = ?
                    AND user_id = ?
                    AND active = 1
                  LIMIT 1
                  `,
          [event.id, userId],
        );

        if (row) {
          prediction = {
            semifinalists: parseCsvPick(row.semifinalists),
            finalists: parseCsvPick(row.finalists),
            winner: row.winner || null,
            third_place_winner: row.third_place_winner || null,
          };
        }
      }

      res.json({
        event,
        teams: withPickedTeams(
          teams,
          prediction?.semifinalists,
          prediction?.finalists,
          prediction?.winner ? [prediction.winner] : [],
          prediction?.third_place_winner ? [prediction.third_place_winner] : [],
        ),
        limity: await getPhaseLimits(pool, event.guild_id, event.id, "playoffs"),

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
        error: "Nie udało się wczytać typów Playoffs.",
        code: "server.playoffsPicksLoadFailed",
      });
    }
  });

  app.post("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
    try {
      const { semifinalists, finalists, winner, third_place_winner } = req.body;

      const prepared = await preparePhaseSave(req, guardDeps, {
        phase: "playoffs",
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

      const semifinalistsPick = normalizeTeams(semifinalists);
      const finalistsPick = normalizeTeams(finalists);

      const winnerPick = winner ? String(winner).trim() : null;

      // 3. miejsce jest OPCJONALNE
      const thirdPick = third_place_winner
        ? String(third_place_winner).trim()
        : null;
      // ============================================
      // LICZBA WYBORÓW I DUPLIKATY
      // ============================================
      //
      // Limity z konfiguracji TEGO eventu. sprawdzTyp celowo NIE wymusza tu
      // unikalności między grupami - Playoffs to hierarchia, więc finaliści
      // powtarzają się w półfinalistach, a zwycięzca w finalistach. Zależności
      // drabinki sprawdzamy niżej, bo to reguła formatu, nie liczba drużyn.

      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        "playoffs",
      );

      const walidacja = sprawdzTyp("playoffs", limity, {
        semifinalists: semifinalistsPick,
        finalists: finalistsPick,
        winner: winnerPick ? [winnerPick] : [],
        third: thirdPick ? [thirdPick] : [],
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      // ============================================
      // LOGIKA DRABINKI 1:1 Z DISCORDEM
      // ============================================

      if (!finalistsPick.includes(winnerPick)) {
        return res.status(400).json({
          error: "Zwycięzca musi być jednym z finalistów.",
          code: "server.winnerFromFinalists",
        });
      }

      for (const finalist of finalistsPick) {
        if (!semifinalistsPick.includes(finalist)) {
          return res.status(400).json({
            error: "Finaliści muszą pochodzić z półfinalistów.",
            code: "server.finalistsFromSemis",
          });
        }
      }

      if (thirdPick && [winnerPick, ...finalistsPick].includes(thirdPick)) {
        return res.status(400).json({
          error: "3. miejsce nie może być finalistą ani zwycięzcą.",
          code: "server.thirdNotFinalist",
        });
      }

      if (thirdPick && !semifinalistsPick.includes(thirdPick)) {
        return res.status(400).json({
          error: "3. miejsce musi być jednym z półfinalistów.",
          code: "server.thirdFromSemis",
        });
      }

      // ============================================
      // AKTYWNE DRUŻYNY
      // ============================================

      const teamNames = await loadActiveTeams(pool, event.guild_id);

      const allowed = new Set(teamNames);

      const allPicked = [
        ...semifinalistsPick,
        ...finalistsPick,
        winnerPick,
        ...(thirdPick ? [thirdPick] : []),
      ];

      const invalid = [
        ...new Set(allPicked.filter((team) => !allowed.has(team))),
      ];

      if (invalid.length) {
        return res.status(400).json({
          error: `Unknown or inactive teams: ${invalid.join(", ")}`,
        });
      }

      // ============================================
      // SAVE
      // ============================================

      await pool.query(
        `
        INSERT INTO playoffs_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          semifinalists,
          finalists,
          winner,
          third_place_winner,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          semifinalists = VALUES(semifinalists),
          finalists = VALUES(finalists),
          winner = VALUES(winner),
          third_place_winner = VALUES(third_place_winner),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          semifinalistsPick.join(", "),
          finalistsPick.join(", "),
          winnerPick,
          thirdPick,
        ],
      );

      res.json({
        ok: true,

        prediction: {
          semifinalists: semifinalistsPick,
          finalists: finalistsPick,
          winner: winnerPick,
          third_place_winner: thirdPick,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Playoffs.",
        code: "server.playoffsPicksSaveFailed",
      });
    }
  });
}
