const fs = require('fs');
const mysql = require('mysql2/promise');

const { loadGuildConfigsOnce, getGuildConfig } = require('./guildRegistry');
const { getCurrentGuildId } = require('./guildContext');

// =====================================================
// HELPERS – SQL PARSING (ZOSTAWIONE)
// =====================================================

function isEscaped(sql, i) {
  let cnt = 0;
  for (let j = i - 1; j >= 0 && sql[j] === '\\'; j--) cnt++;
  return (cnt % 2) === 1;
}

function splitSqlStatements(sqlText) {
  const sql = String(sqlText || '').replace(/\r\n/g, '\n');
  const out = [];
  let stmt = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1] || '';

    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle) {
        if (!isEscaped(sql, i) && next === "'") {
          stmt += "''";
          i++;
          continue;
        }
        if (!isEscaped(sql, i)) inSingle = false;
      } else inSingle = true;
      stmt += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        if (!isEscaped(sql, i)) inDouble = false;
      } else inDouble = true;
      stmt += ch;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      stmt += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      if (stmt.trim()) out.push(stmt.trim());
      stmt = '';
      continue;
    }

    stmt += ch;
  }

  if (stmt.trim()) out.push(stmt.trim());
  return out;
}

// =====================================================
// 🔥 KLUCZ: CO SKIPUJEMY
// =====================================================

function shouldSkipStatement(stmt) {
  const s = stmt.trim();

  // ❌ runtime / volatile
  if (/INSERT\s+INTO\s+`?active_panels`?/i.test(s)) return true;

  // ❌ dump noise
  if (/^LOCK TABLES/i.test(s)) return true;
  if (/^UNLOCK TABLES/i.test(s)) return true;
  if (/^START TRANSACTION/i.test(s)) return true;
  if (/^COMMIT$/i.test(s)) return true;

  return false;
}

// =====================================================
// DB CONFIG
// =====================================================

function getDbConfig(guildId) {
  if (!guildId) throw new Error('restoreBackup: guildId wymagane');

  loadGuildConfigsOnce();
  const cfg = getGuildConfig(String(guildId));

  if (!cfg || !cfg.DB_HOST || !cfg.DB_NAME) {
    throw new Error(`Brak konfiguracji DB dla guildId=${guildId}`);
  }

  return {
    host: cfg.DB_HOST,
    port: Number(cfg.DB_PORT || 3306),
    user: cfg.DB_USER,
    password: cfg.DB_PASS,
    database: cfg.DB_NAME,
    connectTimeout: Number(cfg.DB_CONNECT_TIMEOUT_MS || 15000),
  };
}

// =====================================================
// 🔒 GUILD SAFE – CZYŚCIMY TYLKO DANE HISTORYCZNE
// =====================================================

async function clearGuildData(connection, guildId) {
  const tables = [
    'matches',

    'swiss_predictions',
    'playoffs_predictions',
    'doubleelim_predictions',
    'playin_predictions',

    'swiss_results',
    'playoffs_results',
    'doubleelim_results',
    'playin_results',

    'swiss_scores',
    'playoffs_scores',
    'doubleelim_scores',
    'playin_scores',
  ];

  for (const table of tables) {
    await connection.query(
      `DELETE FROM \`${table}\` WHERE guild_id = ?`,
      [guildId]
    );
  }
}

// =====================================================
// EXEC
// =====================================================

async function execStatement(connection, stmt) {
  await connection.query(stmt);
}

// =====================================================
// MAIN – RESTORE
// =====================================================

module.exports = async function restoreBackup(sqlFilePath, opts = {}) {
  const ctxGuildId = typeof getCurrentGuildId === 'function'
    ? getCurrentGuildId()
    : null;

  const guildId = opts.guildId || ctxGuildId;
  if (!guildId) throw new Error('restoreBackup: brak guildId');

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error('Plik backupu nie istnieje');
  }

  const dump = fs.readFileSync(sqlFilePath, 'utf8');
  if (!dump.trim()) throw new Error('Plik backupu jest pusty');

  const dbCfg = getDbConfig(guildId);

  const connection = await mysql.createConnection({
    ...dbCfg,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    console.log(`[RESTORE] start guildId=${guildId}`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('[RESTORE] clearing guild data...');
    await clearGuildData(connection, guildId);

    const statements = splitSqlStatements(dump)
      .filter(s => s && !shouldSkipStatement(s));

    console.log(`[RESTORE] executing ${statements.length} statements`);

    for (const stmt of statements) {
      await execStatement(connection, stmt);
    }

    console.log('[RESTORE] SUCCESS');
  } catch (err) {
    console.error('[RESTORE] FAIL', err);
    throw err;
  } finally {
    try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (_) {}
    try { await connection.end(); } catch (_) {}
  }
};
