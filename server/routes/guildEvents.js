// Zakladanie eventow i meczow w gildii.
//
// Cztery trasy: metadane gildii, utworzenie eventu oraz dodawanie meczow -
// pojedynczo i hurtem.

export function registerGuildEventRoutes(
  app,
  {
    getOpenEventId,
    io,
    logInfo,
    parseMatchList,
    pool,
    requireGuildAdmin,
    runInTransaction,
  },
) {
  app.get("/api/guilds/:guildId/meta", async (req, res) => {
    try {
      const { guildId } = req.params;

      res.json({
        guild: {
          id: guildId,
          name: "Hyperland",
          icon: null,
          description: "Competitive CS Pick'Em Community",
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  });

  app.post(
    "/api/guilds/:guildId/events",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;
        const { name, slug } = req.body;

        if (!name || !slug) {
          return res.status(400).json({
            error: "Name and slug are required",
          });
        }

        // Nowy event powstaje jako UPCOMING / is_open = 0 / is_active = 0 -
        // dokładnie tak jak w /start_pickem na Discordzie, gdzie event staje
        // się aktywny dopiero po opublikowaniu panelu. Świadomie NIE otwieramy
        // go od razu: getOpenEventId() bierze najnowszy otwarty event, więc
        // utworzenie kolejnego przejęłoby trwający turniej.
        //
        // Wcześniej ten INSERT w ogóle nie wymieniał is_open / is_active
        // (kolumna is_open ma DEFAULT 0), ale odpowiadał status: "OPEN".
        // Panel pokazywał więc event jako otwarty, podczas gdy dla całego
        // typowania - i na Discordzie, i na WWW - on nie istniał, i nic nie
        // wskazywało przyczyny. Teraz stan jest jawny i zwracany zgodnie z
        // prawdą; otwarcie eventu robi się przyciskiem (POST .../status).
        const [result] = await pool.query(
          `
        INSERT INTO events (
          guild_id,
          name,
          slug,
          phase,
          status,
          is_open,
          is_active,
          is_archived
        )
        VALUES (?, ?, ?, 'NOT_STARTED', 'UPCOMING', 0, 0, 0)
        `,
          [guildId, name, slug],
        );

        res.json({
          ok: true,
          event: {
            id: result.insertId,
            guild_id: guildId,
            name,
            slug,
            phase: "NOT_STARTED",
            status: "UPCOMING",
            is_open: 0,
            is_active: 0,
          },
          // Dla UI: event trzeba jeszcze otworzyć, żeby przyjmował typy.
          wymagaOtwarcia: true,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );

  // Hurtowe tworzenie meczów z wklejonej listy. Pojedynczy modal to najdroższa
  // czynność przy stawianiu turnieju - IEM Cologne 2026 ma 106 meczów.
  //
  // dryRun pozwala zobaczyć, co się utworzy i co zostanie odrzucone, ZANIM
  // cokolwiek trafi do bazy. Sam zapis idzie w transakcji: albo powstają
  // wszystkie mecze, albo żaden - połowicznie utworzona faza byłaby gorsza od
  // braku, bo trzeba by ją rozpoznawać ręcznie.
  app.post(
    "/api/guilds/:guildId/events/:slug/matches/bulk",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId, slug } = req.params;
        const { phase, text, defaultBestOf = 3, dryRun = false } = req.body || {};

        if (!phase || !String(text || "").trim()) {
          return res
            .status(400)
            .json({ error: "Wymagane: faza i lista meczów." });
        }

        if (![1, 3, 5].includes(Number(defaultBestOf))) {
          return res
            .status(400)
            .json({ error: "Domyślne BO musi wynosić 1, 3 albo 5." });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

        const { mecze, bledy, duplikaty } = parseMatchList(text, {
          domyslneBo: Number(defaultBestOf),
        });

        // Ta sama walidacja co przy pojedynczym meczu: drużyna musi istnieć i
        // być aktywna. Nie luzujemy jej dla wygody, bo matches.team_a to zwykły
        // varchar - literówka przeszłaby do bazy i rozjechała dopasowywanie
        // wyników oraz typy graczy.
        const [aktywne] = await pool.query(
          "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
          [guildId],
        );

        const znane = new Map(aktywne.map((t) => [t.name.toLowerCase(), t.name]));
        const nieznane = new Set();
        const doUtworzenia = [];

        for (const m of mecze) {
          const a = znane.get(m.teamA.toLowerCase());
          const b = znane.get(m.teamB.toLowerCase());

          if (!a) nieznane.add(m.teamA);
          if (!b) nieznane.add(m.teamB);

          if (a && b) {
            // Zapisujemy nazwę w brzmieniu z tabeli teams, a nie tak, jak
            // admin ją wkleił - inaczej "navi" i "NAVI" żyłyby obok siebie.
            doUtworzenia.push({ ...m, teamA: a, teamB: b });
          }
        }

        const podsumowanie = {
          rozpoznanych: mecze.length,
          doUtworzenia: doUtworzenia.length,
          bledy,
          duplikaty,
          nieznaneDruzyny: [...nieznane],
          podglad: doUtworzenia.slice(0, 200),
        };

        if (nieznane.size) {
          podsumowanie.wskazowka =
            aktywne.length === 0
              ? "Ten serwer nie ma ani jednej aktywnej drużyny. Dodaj je najpierw na stronie Drużyny (jest tam import z JSON)."
              : "Drużyny muszą istnieć i być aktywne. Dodaj brakujące na stronie Drużyny albo popraw nazwy w liście.";
        }

        if (dryRun) {
          return res.json({ ok: true, dryRun: true, ...podsumowanie });
        }

        if (!doUtworzenia.length) {
          return res.status(400).json({
            error: "Nie ma czego utworzyć — żadna linia nie przeszła walidacji.",
            ...podsumowanie,
          });
        }

        const [[next]] = await pool.query(
          `SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
                 FROM matches WHERE guild_id = ? AND event_id = ? AND phase = ?`,
          [guildId, event.id, phase],
        );

        let numer = Number(next.nextNo);

        const utworzone = await runInTransaction(pool, async (conn) => {
          const lista = [];

          for (const m of doUtworzenia) {
            const [wynik] = await conn.query(
              `INSERT INTO matches
                          (guild_id, event_id, phase, match_no, team_a, team_b, best_of, is_locked)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
              [guildId, event.id, phase, numer, m.teamA, m.teamB, m.bestOf],
            );

            lista.push({ id: wynik.insertId, matchNo: numer, ...m });
            numer++;
          }

          return lista;
        });

        logInfo("matches", "Bulk match creation", {
          guildId,
          slug,
          phase,
          utworzonych: utworzone.length,
          odrzuconych: bledy.length,
          by: req.session?.user?.id,
        });

        io.emit("dashboard:refresh", { slug });

        res.json({ ok: true, utworzone, ...podsumowanie });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Nie udało się utworzyć meczów." });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/events/:slug/matches",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId, slug } = req.params;
        const { phase, teamA, teamB, bestOf, startTimeUtc } = req.body;

        if (!phase || !teamA || !teamB || ![1, 3, 5].includes(Number(bestOf))) {
          return res.status(400).json({
            error:
              "phase, teamA, teamB and a valid bestOf (1, 3 or 5) are required",
          });
        }

        if (teamA === teamB) {
          return res.status(400).json({
            error: "Drużyny muszą być różne.",
          });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({ error: "Nie znaleziono turnieju." });
        }

        const [activeTeams] = await pool.query(
          "SELECT name FROM teams WHERE guild_id = ? AND active = 1 AND name IN (?, ?)",
          [guildId, teamA, teamB],
        );

        const activeNames = new Set(activeTeams.map((t) => t.name));

        if (!activeNames.has(teamA) || !activeNames.has(teamB)) {
          return res.status(400).json({
            error: "Both teams must be active teams on this server",
          });
        }

        const [[next]] = await pool.query(
          `
              SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
              FROM matches
              WHERE guild_id = ? AND event_id = ? AND phase = ?
              `,
          [guildId, event.id, phase],
        );

        const [result] = await pool.query(
          `
              INSERT INTO matches (
                  guild_id, event_id, phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
              `,
          [
            guildId,
            event.id,
            phase,
            next.nextNo,
            teamA,
            teamB,
            Number(bestOf),
            startTimeUtc || null,
          ],
        );

        res.json({
          ok: true,
          match: {
            id: result.insertId,
            guild_id: guildId,
            event_id: event.id,
            phase,
            match_no: next.nextNo,
            team_a: teamA,
            team_b: teamB,
            best_of: Number(bestOf),
            start_time_utc: startTimeUtc || null,
            is_locked: 0,
          },
        });

        io.emit("dashboard:refresh", { slug });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
        });
      }
    },
  );
}
