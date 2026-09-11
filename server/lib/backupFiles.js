// Pliki backupow gildii: lista i sprzatanie starych.
//
// Sprzatanie kasuje pliki, wiec regula "ile zostaje" jest warta testu - a da sie
// ja sprawdzic na katalogu tymczasowym, bo fs i rejestr sciezek przychodza
// argumentem.
//
// Lista jest posortowana od najnowszego i sprzatanie na tym stoi: do usuniecia
// idzie ogon po `retention` pozycjach. Odwrocenie sortowania skasowaloby wiec
// najnowsze kopie zamiast najstarszych - stad test pilnujacy kolejnosci osobno.

export function createBackupFiles({
  fs,
  path,
  guildRegistry,
  retention,
  logWarn,
}) {
  function listGuildBackups(guildId) {
    guildRegistry.ensureGuildDirs(guildId);

    const { backupDir } = guildRegistry.getGuildPaths(guildId);

    return fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => {
        const fullPath = path.join(backupDir, file);
        const stat = fs.statSync(fullPath);

        return {
          fileName: file,
          sizeBytes: stat.size,
          createdAt: stat.birthtime?.toISOString?.() || stat.mtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  }

  function pruneGuildBackups(guildId) {
    const { backupDir } = guildRegistry.getGuildPaths(guildId);

    // listGuildBackups sortuje od najnowszego, więc do usunięcia idzie ogon.
    const stale = listGuildBackups(guildId).slice(retention);
    const removed = [];

    for (const backup of stale) {
      try {
        fs.unlinkSync(path.join(backupDir, backup.fileName));
        removed.push(backup.fileName);
      } catch (err) {
        // Nieudane sprzątanie nie może wywrócić samego backupu - plik już
        // powstał i jest ważniejszy niż limit.
        logWarn("backup", "Could not prune old backup", {
          guildId,
          fileName: backup.fileName,
          message: err?.message,
        });
      }
    }

    return removed;
  }

  return { listGuildBackups, pruneGuildBackups };
}
