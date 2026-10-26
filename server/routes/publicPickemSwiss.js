// Formularz fazy Swiss: zapis typu, odczyt typu i statystyki etapu.
//
// Swiss ma etapy (stage1..stage3) i dlatego jest tu trzecia trasa,
// ktorej pozostale fazy nie maja: swiss-stats liczy, jak typowal caly
// serwer w TYM etapie.
//
// Jedyna faza, ktora na zamkniete typowanie odpowiada zdaniem zapasowym
// i kodem tlumaczenia (phaseLockNotice). Play-In, Playoffs i Double Elim
// zwracaja w tym samym miejscu message: null, gdy administrator nie
// wpisal wlasnego powodu - to rozjazd sprzed podzialu, zostawiony
// swiadomie, bo jego usuniecie zmienia odpowiedz API.
//
// Wydzielone z publicPickem.js - tam stoi wywolanie i tam opisana jest
// umowa o kolejnosci rejestracji.

import { loadPhaseTeams, withPickedTeams } from "../lib/phaseFormTeams.js";
import { phaseLockNotice } from "../lib/phaseLock.js";
import { preparePhaseSave, sendRejection } from "../lib/phaseForms.js";
import { buildSwissPicks } from "../lib/swissPicks.js";

export function registerPublicPickemSwissRoutes(
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

  app.post("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
    try {
      const { stage } = req.params;

      const { three_zero, zero_three, advancing } = req.body;

      const prepared = await preparePhaseSave(req, phaseDeps, {
        phase: "swiss",
        stage,
      });

      if (prepared.rejected) return sendRejection(res, prepared.rejected);

      const { userId, event, currentEventId } = prepared;

      const threeZero = Array.isArray(three_zero) ? three_zero.map(String) : [];

      const zeroThree = Array.isArray(zero_three) ? zero_three.map(String) : [];

      const advancingTeams = Array.isArray(advancing)
        ? advancing.map(String)
        : [];

      /*
       * Liczby drużyn biorą się z konfiguracji TEGO eventu, a nie z liczb
       * wpisanych na sztywno. Event bez konfiguracji dostaje wartości
       * domyślne (2/2/6), czyli zachowanie sprzed tej zmiany.
       */
      const limity = await getPhaseLimits(
        pool,
        event.guild_id,
        currentEventId,
        stage,
      );

      const walidacja = sprawdzTyp(stage, limity, {
        x3_0: threeZero,
        x0_3: zeroThree,
        advancing: advancingTeams,
      });

      if (!walidacja.ok) {
        return res.status(400).json({ error: walidacja.blad });
      }

      const allPicked = [...threeZero, ...zeroThree, ...advancingTeams];

      /*
       * Tak samo jak Discord:
       * jeszcze raz sprawdzamy aktywne drużyny
       * tuż przed zapisem.
       */
      const validTeams = await loadActiveTeams(pool, event.guild_id);

      const invalidTeams = allPicked.filter((team) => !validTeams.includes(team));

      if (invalidTeams.length) {
        return res.status(400).json({
          error: `Unknown or inactive teams: ${invalidTeams.join(", ")}`,
        });
      }

      /*
       * Finalny zapis.
       * WAŻNE: stage musi być zapisany.
       */
      await pool.query(
        `
        INSERT INTO swiss_predictions (
          guild_id,
          event_id,
          user_id,
          username,
          displayname,
          stage,
          pick_3_0,
          pick_0_3,
          advancing,
          active,
          submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

        ON DUPLICATE KEY UPDATE
          event_id = VALUES(event_id),
          username = VALUES(username),
          displayname = VALUES(displayname),
          pick_3_0 = VALUES(pick_3_0),
          pick_0_3 = VALUES(pick_0_3),
          advancing = VALUES(advancing),
          active = 1,
          submitted_at = CURRENT_TIMESTAMP
        `,
        [
          event.guild_id,
          currentEventId,
          userId,
          req.session.user?.username || userId,
          req.session.user?.global_name || req.session.user?.username || userId,
          stage,
          threeZero.join(", "),
          zeroThree.join(", "),
          advancingTeams.join(", "),
        ],
      );

      res.json({
        ok: true,

        prediction: {
          three_zero: threeZero,
          zero_three: zeroThree,
          advancing: advancingTeams,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się zapisać typów Swiss.",
        code: "server.swissPicksSaveFailed",
      });
    }
  });

  app.get("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
    try {
      const { slug, stage } = req.params;
      const userId = req.session?.user?.id || null;

      if (!["stage1", "stage2", "stage3"].includes(stage)) {
        return res.status(400).json({
          error: "Nieprawidłowy etap Swiss.",
          code: "server.badSwissStage",
        });
      }

      const [[event]] = await pool.query(
        `
        SELECT
          id,
          guild_id,
          name,
          slug,
          phase,
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

      let prediction = null;

      if (userId) {
        if (!isGuildMember(req.session.user, event.guild_id)) {
          return res.status(403).json({
            error: "Nie należysz do tego serwera.",
            code: "server.notMember",
          });
        }

        const [[row]] = await pool.query(
          `
          SELECT
            pick_3_0,
            pick_0_3,
            advancing
          FROM swiss_predictions
          WHERE guild_id = ?
            AND event_id = ?
            AND user_id = ?
            AND stage = ?
            AND active = 1
          LIMIT 1
          `,
          [
            event.guild_id,
            event.id,
            userId,
            stage,
          ],
        );

        if (row) {
          prediction = {
            three_zero: parseCsvPick(row.pick_3_0),
            zero_three: parseCsvPick(row.pick_0_3),
            advancing: parseCsvPick(row.advancing),
          };
        }
      }

      // Gate liczony PRZED listą drużyn, bo to on decyduje, skąd ta lista
      // ma pochodzić. Wcześniej stał niżej - samo przestawienie niczego nie
      // zmienia, bo checkPickemGate tylko czyta.
      const gate = await checkPickemGate(
        event.guild_id,
        "SWISS",
        stage,
      );

      const teams = withPickedTeams(
        await loadPhaseTeams({
          pool,
          eventId: event.id,
          guildId: event.guild_id,
          allowed: gate.allowed,
        }),
        prediction?.three_zero,
        prediction?.zero_three,
        prediction?.advancing,
      );

      return res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },

        stage,

        teams,

        // Limity z konfiguracji TEGO eventu - front nie ma ich już zaszytych.
        limity: await getPhaseLimits(pool, event.guild_id, event.id, stage),

        prediction,

        // `deadline` poza rozgalezieniem, bo dotyczy obu przypadkow: przed
        // terminem strona ma napisac, ile zostalo, a po nim - kiedy minal.
        // null, gdy administrator terminu nie ustawil.
        lock: {
          deadline: gate.deadline ?? null,

          ...(gate.allowed
            ? { allowed: true, message: null, code: null }
            : {
              allowed: false,

              // Zdanie zapasowe i kod z jednego miejsca. Stalo tu dwa
              // razy to samo wywolanie, po jedno pole na raz.
              ...phaseLockNotice(gate, toWebMessage, "phase"),
            }),
        },
      });
    } catch (err) {
      console.error("SWISS PICKEM LOAD ERROR:", err);

      return res.status(500).json({
        error: "Nie udało się wczytać typów Swiss.",
        code: "server.swissPicksLoadFailed",
      });
    }
  });

  app.get("/api/public/events/:slug/swiss-stats/:stage", async (req, res) => {
    try {
      const { slug, stage } = req.params;

      if (!["stage1", "stage2", "stage3"].includes(stage)) {
        return res.status(400).json({
          error: "Nieprawidłowy etap Swiss.",
          code: "server.badSwissStage",
        });
      }

      const [[event]] = await pool.query(
        `
              SELECT id, guild_id, name, slug
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

      const [rows] = await pool.query(
        `
              SELECT pick_3_0, pick_0_3, advancing
              FROM swiss_predictions
              WHERE event_id = ?
                AND stage = ?
                AND active = 1
              `,
        [event.id, stage],
      );

      // Podział głosów liczy server/lib/swissPicks.js - ten sam moduł, co
      // /api/public/events/:slug/swiss-picks. Wcześniej stała tu własna
      // kopia zliczania i dwa miejsca musiałyby się zgadzać już na zawsze.
      //
      // Moduł grupuje nazwy przez teamKey, więc „FaZe Clan" i „Faze Clan"
      // są tu teraz jedną drużyną zamiast dwóch mniejszych - to jedyna
      // różnica w tym, co ta trasa oddaje.
      //
      // Bez wyników: ta trasa z założenia mówi tylko, na co stawiano.
      // Porównanie z tym, co się stało, oddaje trasa /swiss-picks.
      // topTeams bez ograniczenia: moduł domyślnie przycina listę do czołowej
      // piątki na potrzeby strony, a ta trasa zawsze oddawała komplet drużyn
      // i nie ma powodu tego zmieniać.
      const { stages } = buildSwissPicks(
        rows.map((r) => ({ ...r, stage })),
        [],
        { topTeams: Number.POSITIVE_INFINITY },
      );

      const grupy = new Map(
        (stages[0]?.groups ?? []).map((g) => [g.kind, g.teams]),
      );

      // Kształt odpowiedzi zostaje dokładnie ten, co był - trasa jest
      // publiczna, więc tłumaczymy tylko nazwy pól na tutejsze.
      const naStare = (kind) =>
        (grupy.get(kind) ?? []).map((d) => ({
          team: d.name,
          count: d.count,
          percentage: d.percent,
        }));

      res.json({
        event,
        stage,
        total_predictions: rows.length,
        stats: {
          three_zero: naStare("three_zero"),
          zero_three: naStare("zero_three"),
          advancing: naStare("advancing"),
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Nie udało się wczytać statystyk Swiss.",
        code: "server.swissStatsFailed",
      });
    }
  });
}
