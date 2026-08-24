const mysqldump = require("mysqldump");
const path = require("path");
const mysql = require("mysql2/promise");

const {
  getGuildConfig,
  getGuildPaths,
  ensureGuildDirs,
} = require("../../utils/guildRegistry");

const { withGuild } = require("../../utils/guildContext");
const { logInfo, logError } = require("../../utils/logger");
const isAdmin = require("../../utils/isAdmin");

function sqlEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function getDatabaseTablesAndColumns(cfg) {
  const connection = await mysql.createConnection({
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

module.exports = async function backupDatabase(interaction) {
  const guildId = interaction.guildId;

  if (!guildId) {
    return interaction.reply({
      content: "❌ Ta funkcja działa tylko na serwerze (nie w DM).",
      ephemeral: true,
    });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: "⛔ Tylko administracja.",
      ephemeral: true,
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  return withGuild(guildId, async () => {
    try {
      await interaction.editReply({
        content: "💽 **Tworzę backup danych tego serwera...**",
      });

      const cfg = getGuildConfig(guildId);

      if (!cfg) {
        return interaction.editReply({
          content: "❌ Brak konfiguracji bazy danych dla tego serwera.",
        });
      }

      ensureGuildDirs(guildId);

      const { backupDir } = getGuildPaths(guildId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `backup_${guildId}_${timestamp}.sql`;
      const filePath = path.join(backupDir, fileName);

      // Backup gildii obejmuje WYŁĄCZNIE tabele z kolumną guild_id. Tabele bez
      // niej (sessions, admin_users) są globalne - filtr po guild_id z definicji
      // ich nie obejmuje, więc trafiały do pliku w całości, razem z sesjami
      // logowania wszystkich użytkowników panelu. Nie są to zresztą dane
      // turniejowe, więc nie ma czego z nich odtwarzać.
      const tablesMap = await getDatabaseTablesAndColumns(cfg);

      const escapedGuildId = sqlEscape(guildId);

      const where = {};
      const skippedTables = [];

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

      logInfo("backup", "Guild backup created", {
        guildId,
        fileName,
        filePath,
        tablesCount: tables.length,
        skippedTablesCount: skippedTables.length,
      });

      await interaction.editReply({
        content:
          `✅ Backup ukończony!\n` +
          `📦 Zapisano **${tables.length}** tabel — wyłącznie dane tego serwera.\n` +
          `🔒 Pominięto **${skippedTables.length}** tabel bez \`guild_id\` (globalne, m.in. sesje logowania).\n` +
          `🗂️ Plik: \`${fileName}\``,
      });
    } catch (error) {
      logError("backup", "Backup failed", {
        guildId,
        message: error.message,
        stack: error.stack,
      });

      await interaction.editReply({
        content: "❌ Backup nie powiódł się. Sprawdź logi.",
      });
    }
  });
};
