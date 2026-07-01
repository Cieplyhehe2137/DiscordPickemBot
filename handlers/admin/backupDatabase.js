const mysqldump = require('mysqldump');
const path = require('path');
const mysql = require('mysql2/promise');

const {
  getGuildConfig,
  getGuildPaths,
  ensureGuildDirs
} = require('../../utils/guildRegistry');

const { withGuild } = require('../../utils/guildContext');
const { logInfo, logError } = require('../../utils/logger');

function sqlEscape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
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
      [cfg.DB_NAME]
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
      content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
      ephemeral: true
    });
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  return withGuild(guildId, async () => {
    try {
      await interaction.editReply({
        content: '💽 **Tworzę backup danych tego serwera...**'
      });

      const cfg = getGuildConfig(guildId);

      if (!cfg) {
        return interaction.editReply({
          content: '❌ Brak konfiguracji bazy danych dla tego serwera.'
        });
      }

      ensureGuildDirs(guildId);

      const { backupDir } = getGuildPaths(guildId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup_${guildId}_${timestamp}.sql`;
      const filePath = path.join(backupDir, fileName);

      const tablesMap = await getDatabaseTablesAndColumns(cfg);

      const tables = [...tablesMap.keys()];

      const escapedGuildId = sqlEscape(guildId);

      const where = {};

      for (const [table, columns] of tablesMap.entries()) {
        if (columns.has('guild_id')) {
          where[table] = `guild_id = '${escapedGuildId}'`;
        }
      }

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
          where,
        },
        dumpToFile: filePath,
      });

      logInfo('backup', 'Guild backup created', {
        guildId,
        fileName,
        filePath,
        tablesCount: tables.length,
        filteredTablesCount: Object.keys(where).length,
      });

      await interaction.editReply({
        content:
          `✅ Backup ukończony!\n` +
          `📦 Backup objął **wszystkie tabele z bazy**.\n` +
          `🔒 Tabele z \`guild_id\` zapisano tylko dla tego serwera.\n` +
          `🗂️ Plik: \`${fileName}\``
      });

    } catch (error) {
      logError('backup', 'Backup failed', {
        guildId,
        message: error.message,
        stack: error.stack,
      });

      await interaction.editReply({
        content: '❌ Backup nie powiódł się. Sprawdź logi.'
      });
    }
  });
};