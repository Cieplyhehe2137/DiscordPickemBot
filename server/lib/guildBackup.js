// Tworzenie backupu jednej gildii.
//
// Ta funkcja ma za soba dwa bledy i oba byly wyciekiem danych miedzy gildiami,
// oba ciche - zrzut powstawal normalnie, tylko zawieral za duzo:
//
//   1. Tabele BEZ kolumny guild_id (sessions, admin_users) sa globalne, wiec
//      filtr po guild_id z definicji ich nie obejmowal i trafialy do pliku w
//      calosci. Admin jednej gildii pobieral tak sesje logowania wszystkich.
//      Stad pomijanie tabel bez tej kolumny zamiast zrzucania ich bez filtra.
//
//   2. `where` byl podawany jako dump.where, a nalezy do dump.data.where.
//      mysqldump po cichu ignoruje nieznane pola, wiec filtr nie dzialal wcale
//      i backup jednej gildii zawieral CALA baze.
//
// Zaleznosci przychodza argumentem, zeby dalo sie sprawdzic testem, co
// dokladnie trafia do mysqldump - bo w obu tych bledach roznica byla wylacznie
// w ksztalcie przekazanych opcji.

export function createGuildBackupTools({
  mysql2,
  mysqldump,
  guildRegistry,
  path,
  sqlEscape,
  pruneGuildBackups,
}) {
  async function getDatabaseTablesAndColumns(cfg) {
    const connection = await mysql2.createConnection({
      host: cfg.DB_HOST,
      port: Number(cfg.DB_PORT) || 3306,
      user: cfg.DB_USER,
      password: cfg.DB_PASS || cfg.DB_PASSWORD,
      database: cfg.DB_NAME,
    });

    try {
      const [rows] = await connection.query(
        `
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        `,
        [cfg.DB_NAME],
      );

      const map = new Map();

      for (const row of rows) {
        if (!map.has(row.TABLE_NAME)) {
          map.set(row.TABLE_NAME, new Set());
        }

        map.get(row.TABLE_NAME).add(row.COLUMN_NAME);
      }

      return map;
    } finally {
      await connection.end();
    }
  }

  async function createGuildBackup(guildId) {
    const cfg = guildRegistry.getGuildConfig(guildId);
    if (!cfg) throw new Error(`Missing DB config for guildId=${guildId}`);

    guildRegistry.ensureGuildDirs(guildId);

    const { backupDir } = guildRegistry.getGuildPaths(guildId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup_${guildId}_${timestamp}.sql`;
    const filePath = path.join(backupDir, fileName);

    // Backup gildii zrzuca WYŁĄCZNIE tabele z kolumną guild_id. Tabele bez
    // niej (sessions, admin_users) są globalne - filtr po guild_id z definicji
    // ich nie obejmuje, więc trafiały do pliku w całości. Admin jednej gildii
    // pobierał w ten sposób sesje logowania wszystkich użytkowników panelu.
    // Nie są to zresztą dane turniejowe, więc nie ma czego z nich odtwarzać.
    const tablesMap = await getDatabaseTablesAndColumns(cfg);
    const where = {};
    const skippedTables = [];
    const escapedGuildId = sqlEscape(guildId);

    for (const [table, columns] of tablesMap.entries()) {
      if (columns.has("guild_id")) {
        where[table] = `guild_id = '${escapedGuildId}'`;
      } else {
        skippedTables.push(table);
      }
    }

    const tables = Object.keys(where);

    await mysqldump({
      connection: {
        host: cfg.DB_HOST,
        port: Number(cfg.DB_PORT) || 3306,
        user: cfg.DB_USER,
        password: cfg.DB_PASS || cfg.DB_PASSWORD,
        database: cfg.DB_NAME,
      },
      dump: {
        tables,
        // `where` należy do DataDumpOptions (dump.data.where), a nie do
        // dump.where - biblioteka po cichu ignoruje nieznane pola, więc
        // filtr po guild_id nie działał i backup jednej gildii zawierał
        // CAŁĄ bazę, czyli też dane pozostałych serwerów.
        data: { where },
      },
      dumpToFile: filePath,
    });

    const removed = pruneGuildBackups(guildId);

    return {
      fileName,
      filePath,
      tablesCount: tables.length,
      filteredTablesCount: tables.length,
      skippedTablesCount: skippedTables.length,
      prunedFiles: removed,
    };
  }

  return { getDatabaseTablesAndColumns, createGuildBackup };
}
