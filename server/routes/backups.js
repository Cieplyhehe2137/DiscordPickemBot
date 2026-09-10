// Backupy bazy per gildia: lista, pobranie, utworzenie i odtworzenie,
// oraz archiwum gildii.
//
// Nazwy plikow przechodza przez assertSafeBackupFileName (server/lib/
// validation.js) - trafiaja tu z zewnatrz, wiec bez tego sciezka mogla by
// wyjsc poza katalog backupow.

export function registerBackupRoutes(
  app,
  {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    assertSafeBackupFileName,
    createGuildBackup,
    emitDashboardRefresh,
    fs,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    listGuildBackups,
    logError,
    logInfo,
    logWarn,
    path,
    pool,
    registerEventAdminRoutes,
    requireGuildAdmin,
    restoreBackup,
    runInTransaction,
    safeFileBase,
  },
) {
  app.get(
    "/api/guilds/:guildId/archive",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const { guildId } = req.params;

        const [events] = await pool.query(
          `
              SELECT
                  e.id,
                  e.slug,
                  e.name,
                  e.status,
                  e.is_archived,
                  e.phase,
                  e.created_at,
                  (SELECT COUNT(*) FROM leaderboard l
                    WHERE l.event_id = e.id AND l.guild_id = ?) AS players,
                  (SELECT COUNT(*) FROM matches m
                    WHERE m.event_id = e.id AND m.guild_id = ?) AS matches,
                  (SELECT COALESCE(SUM(l.total_points), 0) FROM leaderboard l
                    WHERE l.event_id = e.id AND l.guild_id = ?) AS total_points
              FROM events e
              WHERE e.guild_id = ?
                AND (e.status IN ('CLOSED', 'FINISHED') OR e.is_archived = 1)
              ORDER BY e.id DESC
              `,
          // guild_id porównujemy z parametrem, a nie z e.guild_id: kolumny
          // guild_id w leaderboard/matches i events mają różne collation
          // (utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci), więc złączenie
          // kolumna-do-kolumny wywala ER_CANT_AGGREGATE_2COLLATIONS.
          [guildId, guildId, guildId, guildId],
        );

        // Pliki eksportu są przypisane do gildii, nie do eventu - dopasowujemy
        // po nazwie pliku, którą tworzy end-tournament (safeFileBase ze slug/nazwy).
        const [files] = await pool.query(
          "SELECT id, filename, created_at FROM archive_files WHERE guild_id = ? ORDER BY id DESC",
          [guildId],
        );

        res.json({
          guildId,
          events: events.map((e) => ({
            ...e,
            archive_file:
              files.find((f) =>
                f.filename.toLowerCase().includes(String(e.slug).toLowerCase()),
              ) || null,
          })),
          files,
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd bazy danych." });
      }
    },
  );

  // Podgląd wyników jednego zarchiwizowanego turnieju.
  //
  // Klasyfikacja bierze się z tabeli `leaderboard`, bo tylko ona przeżywa
  // "zakończ turniej" z opcją cleanup - tabele *_scores, match_points i matches
  // są wtedy kasowane. Rozbicie na fazy i nazwy graczy doklejamy z *_scores
  // tam, gdzie jeszcze istnieją, więc świeżo zamknięty turniej pokaże pełny
  // szczegół, a dawno wyczyszczony - samą klasyfikację końcową.
  // Cykl zycia eventu siedzi w server/routes/eventAdmin.js. Wywolanie stoi
  // tam, gdzie byly trasy - kolejnosc rejestracji jest zachowaniem.
  registerEventAdminRoutes(app, {
    FAZA_PANELU,
    FAZY_PANELU_CONFIG,
    emitDashboardRefresh,
    getCurrentDoubleElimResults,
    getCurrentPlayinResults,
    getCurrentPlayoffs,
    guildIdFromEventSlug,
    guildRegistry,
    io,
    logInfo,
    pool,
    requireGuildAdmin,
    runInTransaction,
  });


  app.get(
    "/api/guilds/:guildId/backups",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        res.json({ backups: listGuildBackups(req.params.guildId) });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not list backups" });
      }
    },
  );

  // Backup, którego nie da się zabrać z serwera, chroni tylko przed pomyłką
  // admina - nie przed utratą samego hosta. Stąd pobieranie, tą samą bramką
  // uprawnień co tworzenie i przywracanie.
  app.get(
    "/api/guilds/:guildId/backups/:fileName/download",
    requireGuildAdmin((req) => req.params.guildId),
    (req, res) => {
      try {
        const guildId = req.params.guildId;
        const fileName = assertSafeBackupFileName(req.params.fileName);
        const { backupDir } = guildRegistry.getGuildPaths(guildId);
        const filePath = path.join(backupDir, fileName);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "Nie znaleziono pliku kopii zapasowej." });
        }

        logInfo("backup", "Guild backup downloaded from web panel", {
          guildId,
          fileName,
          by: req.session?.user?.id,
        });

        res.download(filePath, fileName);
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: "Invalid backup file name" });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/backups",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const result = await createGuildBackup(req.params.guildId);

        logInfo("backup", "Guild backup created from web panel", {
          guildId: req.params.guildId,
          fileName: result.fileName,
          tablesCount: result.tablesCount,
          filteredTablesCount: result.filteredTablesCount,
          prunedFiles: result.prunedFiles,
          by: req.session?.user?.id,
        });

        res.json({
          ok: true,
          backup: result,
          backups: listGuildBackups(req.params.guildId),
        });
      } catch (err) {
        console.error(err);

        logError("backup", "Web backup failed", {
          guildId: req.params.guildId,
          message: err?.message,
          stack: err?.stack,
        });

        res.status(500).json({ error: "Backup failed" });
      }
    },
  );

  app.post(
    "/api/guilds/:guildId/backups/:fileName/restore",
    requireGuildAdmin((req) => req.params.guildId),
    async (req, res) => {
      try {
        const guildId = req.params.guildId;
        const fileName = assertSafeBackupFileName(req.params.fileName);
        const { backupDir } = guildRegistry.getGuildPaths(guildId);
        const filePath = path.join(backupDir, fileName);

        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ error: "Nie znaleziono pliku kopii zapasowej." });
        }

        const summary = await restoreBackup(filePath, { guildId });

        logWarn("backup", "Guild backup restored from web panel", {
          guildId,
          fileName,
          clearedTables: summary?.clearedTables,
          statementsApplied: summary?.statementsApplied,
          skippedTables: summary?.skippedTables,
          by: req.session?.user?.id,
        });

        io.emit("dashboard:refresh", {});

        res.json({ ok: true, fileName, summary });
      } catch (err) {
        console.error(err);

        logError("backup", "Web restore failed", {
          guildId: req.params.guildId,
          fileName: req.params.fileName,
          message: err?.message,
          stack: err?.stack,
        });

        res.status(500).json({ error: "Restore failed" });
      }
    },
  );
}
