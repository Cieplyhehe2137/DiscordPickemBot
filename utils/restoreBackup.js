const fs = require('fs');
const mysql = require('mysql2/promise');

const { loadGuildConfigsOnce, getGuildConfig } = require('./guildRegistry');
const { getCurrentGuildId } = require('./guildContext');

// =====================================================
// HELPERS – SQL PARSING (ZOSTAWIONE, BO SĄ OK)
// =====================================================

function isEscaped(sql, i) {
  let cnt = 0;
  for (let j = i - 1; j >= 0 && sql[j] === '\\'; j--) cnt++;
  return (cnt % 2) === 1;
}

function splitBySemicolonTopLevel(sqlText) {
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
        const escaped = isEscaped(sql, i);
        if (!escaped && next === "'") {
          stmt += "''";
          i++;
          continue;
        }
        if (!escaped) inSingle = false;
      } else {
        inSingle = true;
      }
      stmt += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const escaped = isEscaped(sql, i);
        if (!escaped) inDouble = false;
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
        const escaped = isEscaped(sql, i);
        if (!escaped && next === "'") {
          stmt += "''";
          i++;
          continue;
        }
        if (!escaped) inSingle = false;
      } else inSingle = true;
      stmt += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const escaped = isEscaped(sql, i);
        if (!escaped) inDouble = false;
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

function shouldSkipStatement(s) {
  const t = s.trim().toUpperCase();
  return (
    t.startsWith('LOCK TABLES') ||
    t.startsWith('UNLOCK TABLES') ||
    t.startsWith('START TRANSACTION') ||
    t === 'COMMIT'
  );
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
// 🔒 KLUCZ: CZYSZCZENIE TYLKO JEDNEGO GUILDA
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
// EXECUTION HELPERS
// =====================================================



function shouldSkipStatement(s) {
  const t = s.trim().toUpperCase();

  if (t.includes('INSERT INTO `ACTIVE_PANELS`')) return true;
  if (t.startsWith('LOCK TABLES')) return true;
  if (t.startsWith('UNLOCK TABLES')) return true;
  if (t.startsWith('START TRANSACTION')) return true;
  if (t === 'COMMIT') return true;

  return false;
}

function sanitizeActivePanelsInsert(sql) {
  if (!/INSERT\s+INTO\s+`?active_panels`?/i.test(sql)) {
    return sql;
  }

  // usuń `id` i `stage_key` z listy kolumn
  sql = sql.replace(
    /\(\s*`id`\s*,/i,
    '('
  );

  sql = sql.replace(
    /,\s*`stage_key`\s*/i,
    ''
  );

  // usuń pierwszą wartość (id) z VALUES (...)
  sql = sql.replace(
    /VALUES\s*\(\s*\d+\s*,/i,
    'VALUES ('
  );

  // usuń ostatnią wartość stage_key jeśli była
  sql = sql.replace(
    /,\s*'[^']*'\s*\)\s*;?$/i,
    ')'
  );

  return sql;
}



async function execStatement(connection, stmt) {
  const cleanedStmt = sanitizeActivePanelsInsert(stmt);

  try {
    await connection.query(cleanedStmt);
  } catch (err) {
    const parts = splitBySemicolonTopLevel(cleanedStmt);
    if (parts.length > 1) {
      for (const p of parts) {
        if (p.trim()) await connection.query(p);
      }
      return;
    }
    throw err;
  }
}


// =====================================================
// MAIN – GUILD SAFE RESTORE
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

  let fkDisabled = false;

  try {
    console.log(`[RESTORE] start guildId=${guildId}`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    fkDisabled = true;

    console.log('[RESTORE] clearing ONLY guild data...');
    await clearGuildData(connection, guildId);

    console.log('[RESTORE] parsing dump...');
    const statements = splitSqlStatements(dump)
      .filter(s => s && !shouldSkipStatement(s));

    console.log(`[RESTORE] statements: ${statements.length}`);

    for (const stmt of statements) {
      await execStatement(connection, stmt);
    }

    console.log('[RESTORE] SUCCESS');
  } catch (err) {
    console.error('[RESTORE] FAIL', err);
    throw err;
  } finally {
    try {
      if (fkDisabled) {
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    } catch (_) {}

    try {
      await connection.end();
    } catch (_) {}
  }
};
