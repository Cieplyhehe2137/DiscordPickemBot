// Wyniki faz turnieju: odczyt i zapis dla Swiss, Playoffs, Double Elim i
// Play-In, plus reczne przeliczenie klasyfikacji.
//
// Dziewiec tras, wszystkie chronione przez requireGuildAdmin. To tutaj siedzial
// brak importu sprawdzWynik - cztery trasy zapisu wywalaly sie na
// ReferenceError, a poniewaz kazda ma try/catch, wygladalo to jak zwykle 500.
//
// Jak w pozostalych modulach tras: rejestracja na `app` (a nie przez Router),
// zeby ksztalt tablicy tras sie nie zmienil, i zaleznosci argumentem pod tymi
// samymi nazwami, ktorych uzywal app.js - przeniesiony kod jest niezmieniony
// poza wcieciem.

export function registerPhaseResultRoutes(
  app,
  {
    calculateScores,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    getCurrentSwissResults,
    getPhaseLimits,
    guildIdFromEventSlug,
    io,
    loadActiveTeams,
    pool,
    requireGuildAdmin,
    runInTransaction,
    sprawdzWynik,
  },
) {
  app.post(
    "/api/events/:slug/recalculate",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;

        const [[event]] = await pool.query(
          `
        SELECT *
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
          [slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
          });
        }

        const wynik = await calculateScores(event.guild_id, event.id);

        // Zarchiwizowany turniej nie jest przeliczany - zasady punktacji map
        // zmieniły się po IEM Cologne 2026, więc przeliczenie zamkniętego
        // eventu przepisałoby jego ranking nowymi regułami.
        if (wynik?.skipped) {
          return res.status(409).json({
            error:
              `Turniej "${wynik.eventName}" jest zarchiwizowany, więc punkty nie zostały przeliczone. ` +
              "Zasady punktacji map zmieniły się po jego zakończeniu - przeliczenie zmieniłoby " +
              "zamknięty ranking. Jeśli naprawdę tego chcesz, najpierw cofnij archiwizację.",
            skipped: true,
            reason: wynik.reason,
          });
        }

        io.emit("dashboard:refresh", {
          slug,
        });

        res.json({
          success: true,
          guild_id: event.guild_id,
          event_id: event.id,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Failed to recalculate scores",
        });
      }
    },
  );

  const SWISS_STAGES = ["stage1", "stage2", "stage3"];

  app.get(
    "/api/events/:slug/swiss-results/:stage",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug, stage } = req.params;
        const { guildId } = req;

        if (!SWISS_STAGES.includes(stage)) {
          return res.status(400).json({ error: "Nieprawidłowy etap." });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const current = await getCurrentSwissResults(
          pool,
          guildId,
          event.id,
          stage,
        );

        res.json({
          x3_0: current.x3_0,
          x0_3: current.x0_3,
          advancing: current.adv,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/swiss-results/:stage",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug, stage } = req.params;
        const { guildId } = req;

        if (!SWISS_STAGES.includes(stage)) {
          return res.status(400).json({ error: "Nieprawidłowy etap." });
        }

        const x3_0 = Array.isArray(req.body.x3_0)
          ? req.body.x3_0.map(String)
          : [];
        const x0_3 = Array.isArray(req.body.x0_3)
          ? req.body.x0_3.map(String)
          : [];
        const advancing = Array.isArray(req.body.advancing)
          ? req.body.advancing.map(String)
          : [];

        const all = [...x3_0, ...x0_3, ...advancing];

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        // Limity wyniku biorą się z konfiguracji tego eventu (maksimum,
        // nie liczba wymagana - wynik wpisuje się etapami).
        const limityWyniku = await getPhaseLimits(pool, guildId, event.id, stage);

        const walidacjaWyniku = sprawdzWynik(stage, limityWyniku, { x3_0, x0_3, advancing });

        if (!walidacjaWyniku.ok) {
          return res.status(400).json({ error: walidacjaWyniku.blad });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const validTeams = new Set(teams.map((t) => t.toLowerCase()));
        const invalid = all.filter((t) => !validTeams.has(t.toLowerCase()));

        if (invalid.length) {
          return res
            .status(400)
            .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
        }

        await pool.query(
          `
              INSERT INTO swiss_results
                (guild_id, event_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
              VALUES (?, ?, ?, ?, ?, ?, 1)
              ON DUPLICATE KEY UPDATE
                event_id = VALUES(event_id),
                correct_3_0 = VALUES(correct_3_0),
                correct_0_3 = VALUES(correct_0_3),
                correct_advancing = VALUES(correct_advancing),
                active = 1
              `,
          [
            guildId,
            event.id,
            stage,
            x3_0.join(", "),
            x0_3.join(", "),
            advancing.join(", "),
          ],
        );

        res.json({ ok: true, stage, x3_0, x0_3, advancing });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.get(
    "/api/events/:slug/playoffs-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const current = await getCurrentPlayoffs(pool, guildId, event.id);

        res.json({
          semifinalists: current.semifinalists,
          finalists: current.finalists,
          winner: current.winner[0] || null,
          third: current.third[0] || null,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/playoffs-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const semifinalists = Array.isArray(req.body.semifinalists)
          ? req.body.semifinalists.map(String)
          : [];
        const finalists = Array.isArray(req.body.finalists)
          ? req.body.finalists.map(String)
          : [];
        const winner = req.body.winner ? String(req.body.winner) : null;
        const third = req.body.third ? String(req.body.third) : null;

        if (finalists.some((t) => !semifinalists.includes(t))) {
          return res
            .status(400)
            .json({ error: "Finalists must be semifinalists" });
        }

        if (winner && !finalists.includes(winner)) {
          return res.status(400).json({ error: "Zwycięzca musi być finalistą." });
        }

        if (third && (third === winner || !semifinalists.includes(third))) {
          return res.status(400).json({ error: "Invalid third place" });
        }

        const all = [
          ...semifinalists,
          ...finalists,
          ...(winner ? [winner] : []),
          ...(third ? [third] : []),
        ];

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
        // wpisuje sie etapami - czesciowy tez musi sie zapisac).
        const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "playoffs");

        const walidacjaWyniku = sprawdzWynik("playoffs", limityWyniku, { semifinalists, finalists, winner: winner ? [winner] : [], third: third ? [third] : [] });

        if (!walidacjaWyniku.ok) {
          return res.status(400).json({ error: walidacjaWyniku.blad });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const invalid = all.filter((t) => !teams.includes(t));

        if (invalid.length) {
          return res
            .status(400)
            .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
        }

        await runInTransaction(pool, async (conn) => {
          await conn.query(
            "UPDATE playoffs_results SET active = 0 WHERE guild_id = ? AND event_id = ?",
            [guildId, event.id],
          );

          await conn.query(
            `INSERT INTO playoffs_results
                      (guild_id, event_id, correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active)
                   VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
              guildId,
              event.id,
              semifinalists.join(", "),
              finalists.join(", "),
              winner || null,
              third || null,
            ],
          );
        });

        res.json({ ok: true, semifinalists, finalists, winner, third });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.get(
    "/api/events/:slug/doubleelim-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const current = await getCurrentDoubleElimResults(
          pool,
          guildId,
          event.id,
        );

        res.json(current);
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/doubleelim-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const upperFinalA = Array.isArray(req.body.upperFinalA)
          ? req.body.upperFinalA.map(String)
          : [];
        const lowerFinalA = Array.isArray(req.body.lowerFinalA)
          ? req.body.lowerFinalA.map(String)
          : [];
        const upperFinalB = Array.isArray(req.body.upperFinalB)
          ? req.body.upperFinalB.map(String)
          : [];
        const lowerFinalB = Array.isArray(req.body.lowerFinalB)
          ? req.body.lowerFinalB.map(String)
          : [];

        for (const [label, arr] of [
          ["Upper Final A", upperFinalA],
          ["Lower Final A", lowerFinalA],
          ["Upper Final B", upperFinalB],
          ["Lower Final B", lowerFinalB],
        ]) {
          if (new Set(arr).size !== arr.length) {
            return res
              .status(400)
              .json({ error: `${label}: drużyny nie mogą się powtarzać.` });
          }
        }

        const all = [
          ...upperFinalA,
          ...lowerFinalA,
          ...upperFinalB,
          ...lowerFinalB,
        ];

        if (!all.length) {
          return res.status(400).json({ error: "No teams selected" });
        }

        if (new Set(all).size !== all.length) {
          return res
            .status(400)
            .json({ error: "A team cannot appear in more than one slot" });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
        // wpisuje sie etapami - czesciowy tez musi sie zapisac).
        const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "doubleelim");

        const walidacjaWyniku = sprawdzWynik("doubleelim", limityWyniku, { upperFinalA, lowerFinalA, upperFinalB, lowerFinalB });

        if (!walidacjaWyniku.ok) {
          return res.status(400).json({ error: walidacjaWyniku.blad });
        }

        const teams = await loadActiveTeams(pool, guildId);
        const invalid = all.filter((t) => !teams.includes(t));

        if (invalid.length) {
          return res
            .status(400)
            .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
        }

        await runInTransaction(pool, async (conn) => {
          await conn.query(
            "UPDATE doubleelim_results SET active = 0 WHERE guild_id = ? AND event_id = ? AND active = 1",
            [guildId, event.id],
          );

          await conn.query(
            `INSERT INTO doubleelim_results
                      (guild_id, event_id, upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
            [
              guildId,
              event.id,
              upperFinalA.join(", ") || null,
              lowerFinalA.join(", ") || null,
              upperFinalB.join(", ") || null,
              lowerFinalB.join(", ") || null,
            ],
          );
        });

        res.json({
          ok: true,
          upperFinalA,
          lowerFinalA,
          upperFinalB,
          lowerFinalB,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.get(
    "/api/events/:slug/playin-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const current = await getCurrentPlayinResults(pool, guildId, event.id);

        res.json(current);
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/events/:slug/playin-results",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const teams = Array.isArray(req.body.teams)
          ? Array.from(new Set(req.body.teams.map(String)))
          : [];

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
        // wpisuje sie etapami - czesciowy tez musi sie zapisac).
        const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "playin");

        const walidacjaWyniku = sprawdzWynik("playin", limityWyniku, { teams });

        if (!walidacjaWyniku.ok) {
          return res.status(400).json({ error: walidacjaWyniku.blad });
        }

        const activeTeams = await loadActiveTeams(pool, guildId);
        const invalid = teams.filter((t) => !activeTeams.includes(t));

        if (invalid.length) {
          return res
            .status(400)
            .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
        }

        await runInTransaction(pool, async (conn) => {
          await conn.query(
            "UPDATE playin_results SET active = 0 WHERE guild_id = ? AND event_id = ?",
            [guildId, event.id],
          );

          await conn.query(
            `INSERT INTO playin_results (guild_id, event_id, correct_teams, active)
                   VALUES (?, ?, ?, 1)`,
            [guildId, event.id, teams.join(", ")],
          );
        });

        res.json({ ok: true, teams });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );
}
