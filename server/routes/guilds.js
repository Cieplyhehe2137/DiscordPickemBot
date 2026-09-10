// Administracja serwerem Discorda: druzyny i terminy typowania.
//
// Dwanascie tras /api/guilds - lista serwerow i ich eventow, CRUD druzyn wraz
// z importem i zmiana kolejnosci, oraz terminy (dla typow i dla wynikow).
// Wszystkie poza pierwsza chronione przez requireGuildAdmin.
//
// Jak w routes/auth.js: rejestracja idzie na `app`, nie przez express.Router,
// zeby ksztalt tablicy tras sie nie zmienil - jej porownanie (npm run routes)
// jest dowodem, ze przenosiny niczego nie zgubily.
//
// Zaleznosci przychodza argumentem, wiec modul nie siega sam po pule ani po
// konfiguracje. Nazwy w destrukturyzacji sa celowo takie same jak w app.js -
// dzieki temu przeniesiony kod nie wymagal ANI JEDNEJ podmiany w tresci, tylko
// wciecia. Im mniej zmian przy przenoszeniu, tym mniej miejsc na blad.

export function registerGuildRoutes(
  app,
  {
    pool,
    guildRegistry,
    teamsStore,
    requireGuildAdmin,
    hasAdminPermission,
    VALID_PHASES,
    parseDeadlineInput,
    findPanelForDeadline,
    findPanelForMatchDeadline,
  },
) {
  app.get("/api/guilds", (req, res) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Musisz być zalogowany." });
    }

    const knownGuildIds = new Set(guildRegistry.getAllGuildIds());

    const guilds = (user.guilds || [])
      .filter((g) => knownGuildIds.has(g.id) && hasAdminPermission(user, g.id))
      .map((g) => ({ id: g.id, name: g.name, role: "admin" }));

    res.json({ guilds });
  });

  app.get(
    "/api/guilds/:guildId/events",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;

        const [events] = await pool.query(
          `
        SELECT
    e.id,
    e.guild_id,
    e.name,
    e.slug,
    e.phase,
    e.status,
    e.is_archived,
    e.created_at,

    (
      SELECT COUNT(*)
      FROM matches m
      WHERE m.event_id = e.id
    ) AS matches_count,

    (
      SELECT COUNT(*)
      FROM match_predictions mp
      WHERE mp.event_id = e.id
    ) AS predictions_count,

    (
      SELECT COUNT(DISTINCT mp.user_id)
      FROM match_predictions mp
      WHERE mp.event_id = e.id
    ) AS participants_count

  FROM events e
  WHERE e.guild_id = ?
  ORDER BY e.id DESC
        `,
          [guildId],
        );

        res.json({
          guildId,
          events,
          stats: {
            // events.status enum is UPPERCASE ('UPCOMING','OPEN','CLOSED',
            // 'FINISHED'); comparing against lowercase made all three
            // counters permanently 0. Archived is a flag, not a status.
            totalEvents: events.length,
            activeEvents: events.filter((e) => e.status === "OPEN").length,
            closedEvents: events.filter((e) => e.status === "CLOSED").length,
            archivedEvents: events.filter((e) => Number(e.is_archived) === 1)
              .length,
          },
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
    "/api/guilds/:guildId/teams",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const includeInactive = req.query.includeInactive === "1";

        const teams = await teamsStore.listTeams(guildId, { includeInactive });

        res.json({ guildId, teams });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/teams",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { name, shortName } = req.body;

        if (!name || !String(name).trim()) {
          return res.status(400).json({
            error: "Nazwa drużyny jest wymagana.",
          });
        }

        await teamsStore.addTeam(guildId, name, { shortName: shortName || null });

        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
        });
        const team = teams.find(
          (t) => t.name === String(name).trim().replace(/\s+/g, " "),
        );

        res.json({ ok: true, team });
      } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            error: "Drużyna o tej nazwie już istnieje na tym serwerze.",
          });
        }

        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.patch(
    "/api/guilds/:guildId/teams/:teamId",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId, teamId } = req.params;
        const { name, shortName, active, externalName } = req.body;

        if (name !== undefined) {
          await teamsStore.renameTeam(guildId, teamId, name, {
            shortName: shortName ?? null,
          });
        }

        // Alias nazwy u dostawcy danych. Osobno od renameTeam, bo teamsStore
        // jest współdzielony z botem, a ta kolumna dotyczy wyłącznie integracji
        // z wynikami - pusty ciąg zapisujemy jako NULL, żeby nie mieszać
        // "brak aliasu" z "alias to pusty tekst".
        if (externalName !== undefined) {
          await pool.query(
            "UPDATE teams SET external_name = ? WHERE id = ? AND guild_id = ?",
            [String(externalName).trim() || null, teamId, guildId],
          );
        }

        if (active !== undefined) {
          const teams = await teamsStore.listTeams(guildId, {
            includeInactive: true,
          });
          const current = teams.find((t) => String(t.id) === String(teamId));

          if (current && Boolean(current.active) !== Boolean(active)) {
            await teamsStore.toggleTeamActive(guildId, teamId);
          }
        }

        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
        });
        const team = teams.find((t) => String(t.id) === String(teamId));

        if (!team) {
          return res.status(404).json({ error: "Nie znaleziono drużyny." });
        }

        res.json({ ok: true, team });
      } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            error: "Drużyna o tej nazwie już istnieje na tym serwerze.",
          });
        }

        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.delete(
    "/api/guilds/:guildId/teams/:teamId",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId, teamId } = req.params;

        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
        });
        const team = teams.find((t) => String(t.id) === String(teamId));

        if (!team) {
          return res.status(404).json({ error: "Nie znaleziono drużyny." });
        }

        const [[usage]] = await pool.query(
          `
              SELECT COUNT(*) AS count
              FROM matches
              WHERE guild_id = ?
                AND (team_a = ? OR team_b = ?)
              `,
          [guildId, team.name, team.name],
        );

        if (usage.count > 0) {
          return res.status(409).json({
            error: `Cannot delete "${team.name}" - it is referenced by ${usage.count} match(es). Deactivate it instead.`,
          });
        }

        await teamsStore.deleteTeams(guildId, [teamId]);

        res.json({ ok: true, deletedId: Number(teamId) });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/teams/import",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const jsonText = String(req.body.jsonText ?? "");

        let count;

        try {
          count = await teamsStore.importTeamsFromJsonText(guildId, jsonText);
        } catch (err) {
          if (err.message === "INVALID_JSON") {
            return res.status(400).json({
              error:
                'Invalid JSON - expected an array of team name strings, e.g. ["FaZe","NAVI","G2"]',
            });
          }

          throw err;
        }

        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
        });

        res.json({ ok: true, count, teams });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.get(
    "/api/guilds/:guildId/deadline",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { phase, stage } = req.query;

        if (!VALID_PHASES.includes(phase)) {
          return res.status(400).json({
            error: `phase must be one of: ${VALID_PHASES.join(", ")}`,
          });
        }

        if (phase === "swiss" && !stage) {
          return res.status(400).json({
            error: "Dla fazy Swiss wymagany jest etap (1, 2 albo 3).",
          });
        }

        const lookup = await findPanelForDeadline(
          pool,
          guildId,
          phase,
          stage,
        );

        if (lookup.error) {
          return res.status(400).json({
            error: lookup.error,
          });
        }

        return res.json({
          ok: true,
          deadline: lookup.row?.deadline ?? null,
        });
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/deadline",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { phase, data, stage } = req.body;

        if (!VALID_PHASES.includes(phase)) {
          return res
            .status(400)
            .json({ error: `phase must be one of: ${VALID_PHASES.join(", ")}` });
        }

        if (phase === "swiss" && !stage) {
          return res.status(400).json({
            error: "Dla fazy Swiss wymagany jest etap (1, 2 albo 3).",
          });
        }

        const parsed = parseDeadlineInput(data);

        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }

        const lookup = await findPanelForDeadline(pool, guildId, phase, stage);

        if (lookup.error) {
          return res.status(400).json({ error: lookup.error });
        }

        if (!lookup.row) {
          return res.status(404).json({
            error: `No active panel found for phase "${lookup.lookupPhase}"${lookup.lookupStageKey ? ` / stage "${lookup.lookupStageKey}"` : ""}`,
          });
        }

        await pool.query(
          "UPDATE active_panels SET deadline = ?, reminded = 0 WHERE id = ?",
          [parsed.utcDate, lookup.row.id],
        );

        res.json({ ok: true, deadline: parsed.utcDate });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.delete(
    "/api/guilds/:guildId/deadline",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { phase, stage } = req.body ?? {};

        if (!VALID_PHASES.includes(phase)) {
          return res.status(400).json({
            error: `phase must be one of: ${VALID_PHASES.join(", ")}`,
          });
        }

        let result;

        if (phase === "swiss") {
          const stageNumber = String(stage || "").match(/\d+/)?.[0];

          if (!stageNumber) {
            return res.status(400).json({
              error: "Dla fazy Swiss wymagany jest etap.",
            });
          }

          const dbPhase = `swiss_stage${stageNumber}`;
          const stageKey = `stage${stageNumber}`;

          [result] = await pool.query(
            `
            UPDATE active_panels
            SET deadline = NULL,
                reminded = 0
            WHERE guild_id = ?
              AND phase = ?
              AND stage_key = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, dbPhase, stageKey],
          );
        } else {
          [result] = await pool.query(
            `
            UPDATE active_panels
            SET deadline = NULL,
                reminded = 0
            WHERE guild_id = ?
              AND phase = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, phase],
          );
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: "No panel found for this phase.",
          });
        }

        return res.json({
          ok: true,
          deadline: null,
        });
      } catch (err) {
        console.error(err);

        return res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/match-deadline",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { phase, data } = req.body;

        if (!VALID_PHASES.includes(phase)) {
          return res
            .status(400)
            .json({ error: `phase must be one of: ${VALID_PHASES.join(", ")}` });
        }

        const parsed = parseDeadlineInput(data);

        if (!parsed.ok) {
          return res.status(400).json({ error: parsed.error });
        }

        const lookup = await findPanelForMatchDeadline(pool, guildId, phase);

        if (!lookup.row) {
          return res
            .status(404)
            .json({ error: `No active panel found for phase "${phase}"` });
        }

        await pool.query(
          "UPDATE active_panels SET match_deadline = ? WHERE id = ?",
          [parsed.utcDate, lookup.row.id],
        );

        res.json({ ok: true, matchDeadline: parsed.utcDate });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/teams/reorder",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds) || !orderedIds.length) {
          return res.status(400).json({
            error: "orderedIds musi być niepustą tablicą.",
          });
        }

        await teamsStore.reorderTeams(guildId, orderedIds);

        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
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
