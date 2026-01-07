// utils/restoreBackup.js
const fs = require('fs');
const mysql = require('mysql2/promise');

// bierzemy config dokładnie tak jak reszta bota (per-guild config/*.env)
const { loadGuildConfigsOnce, getGuildConfig } = require('./guildRegistry');

// -----------------------------
// helpers: escaping + splitting
// -----------------------------

// apostrof/cudzysłów jest escaped, jeśli przed nim jest nieparzysta liczba backslashy
function isEscaped(sql, i) {
  let cnt = 0;
  for (let j = i - 1; j >= 0 && sql[j] === '\\'; j--) cnt++;
  return (cnt % 2) === 1;
}

/**
 * Split a SQL chunk by ';' at top level (outside quotes/backticks).
 * Used as a fallback when a "statement" actually contains many INSERTs.
 */
function splitBySemicolonTopLevel(sqlText) {
  const sql = String(sqlText || '').replace(/\r\n/g, '\n');
  const out = [];

  let stmt = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : '';

    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle) {
        const escaped = isEscaped(sql, i);

        // doubled '' only if NOT escaped
        if (!escaped && next === "'") {
          stmt += "''";
          i += 2;
          continue;
        }

        if (!escaped) inSingle = false;

        stmt += ch;
        i++;
        continue;
      } else {
        inSingle = true;
        stmt += ch;
        i++;
        continue;
      }
    }

    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const escaped = isEscaped(sql, i);
        if (!escaped) inDouble = false;
      } else {
        inDouble = true;
      }
      stmt += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      stmt += ch;
      i++;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      const t = stmt.trim();
      if (t) out.push(t);
      stmt = '';
      i++;
      continue;
    }

    stmt += ch;
    i++;
  }

  const tail = stmt.trim();
  if (tail) out.push(tail);

  return out;
}

/**
 * Split SQL dump into statements (no multipleStatements needed).
 * Supports:
 * - DELIMITER changes (basic) — treats delimiter client-side
 * - ignores line comments (--, #) and block comments (/* ... * /) except /*! ... * / (kept)
 * - avoids splitting inside quotes/backticks (proper escaping)
 */
function splitSqlStatements(sqlText) {
  const sql = String(sqlText || '').replace(/\r\n/g, '\n');
  const out = [];

  let delimiter = ';';
  let stmt = '';

  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  const len = sql.length;

  function isAtLineStart(idx) {
    return idx === 0 || sql[idx - 1] === '\n';
  }

  function readToLineEnd(idx) {
    let j = idx;
    while (j < len && sql[j] !== '\n') j++;
    return { line: sql.slice(idx, j), next: j };
  }

  let i = 0;
  while (i < len) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    // DELIMITER at line start (outside quotes)
    if (!inSingle && !inDouble && !inBacktick && isAtLineStart(i)) {
      let k = i;
      while (k < len && (sql[k] === ' ' || sql[k] === '\t')) k++;
      if (sql.slice(k, k + 9).toUpperCase() === 'DELIMITER') {
        const { line, next: nl } = readToLineEnd(k);
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) delimiter = parts[1];
        i = nl + 1;
        continue;
      }
    }

    // line comments
    if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '#' && isAtLineStart(i)) {
        const { next: nl } = readToLineEnd(i);
        i = nl + 1;
        continue;
      }
      if (ch === '-' && next === '-' && isAtLineStart(i)) {
        const third = i + 2 < len ? sql[i + 2] : '';
        if (third === ' ' || third === '\t' || third === '\n' || third === '\r') {
          const { next: nl } = readToLineEnd(i);
          i = nl + 1;
          continue;
        }
      }
    }

    // block comments (keep /*! ... */)
    if (!inSingle && !inDouble && !inBacktick && ch === '/' && next === '*') {
      const third = i + 2 < len ? sql[i + 2] : '';
      const isVersioned = third === '!';
      if (!isVersioned) {
        i += 2;
        while (i < len) {
          if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    // single quotes (FIX: escaped vs doubled)
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle) {
        const escaped = isEscaped(sql, i);

        if (!escaped && next === "'") {
          stmt += "''";
          i += 2;
          continue;
        }

        if (!escaped) inSingle = false;

        stmt += ch;
        i++;
        continue;
      } else {
        inSingle = true;
        stmt += ch;
        i++;
        continue;
      }
    }

    // double quotes
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const escaped = isEscaped(sql, i);
        if (!escaped) inDouble = false;
      } else {
        inDouble = true;
      }
      stmt += ch;
      i++;
      continue;
    }

    // backticks
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      stmt += ch;
      i++;
      continue;
    }

    // delimiter split
    if (!inSingle && !inDouble && !inBacktick && delimiter) {
      if (sql.startsWith(delimiter, i)) {
        const trimmed = stmt.trim();
        if (trimmed) out.push(trimmed);
        stmt = '';
        i += delimiter.length;
        continue;
      }
    }

    stmt += ch;
    i++;
  }

  const tail = stmt.trim();
  if (tail) out.push(tail);

  return out;
}

function shouldSkipStatement(s) {
  const t = s.trim().toUpperCase();
  if (t.startsWith('LOCK TABLES')) return true;
  if (t.startsWith('UNLOCK TABLES')) return true;
  if (t.startsWith('START TRANSACTION')) return true;
  if (t === 'COMMIT') return true;
  return false;
}

function removeMode(modeStr, modeName) {
  const modes = String(modeStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return modes.filter(m => m !== modeName).join(',');
}

// -----------------------------
// DB config + maintenance
// -----------------------------

function getDbConfig(guildId) {
  // Per-guild (config/*.env) — tak samo jak w db.js
  if (guildId) {
    const gid = String(guildId).trim();
    if (!gid) throw new Error('getDbConfig: guildId jest wymagane');

    // upewnij się, że configi są załadowane
    loadGuildConfigsOnce();

    const cfg = getGuildConfig(gid);
    if (!cfg) {
      throw new Error(`Brak configu dla guildId=${gid} (sprawdź config/*.env)`);
    }

    if (!cfg.DB_HOST || !cfg.DB_NAME) {
      throw new Error(`Niepełna konfiguracja DB dla guildId=${gid} (DB_HOST/DB_NAME)`);
    }

    return {
      host: cfg.DB_HOST,
      port: Number(cfg.DB_PORT || 3306),
      user: cfg.DB_USER,
      password: cfg.DB_PASS,
      database: cfg.DB_NAME,
      connectTimeout: Number(cfg.DB_CONNECT_TIMEOUT_MS || process.env.DB_CONNECT_TIMEOUT_MS || 15000),
    };
  }

  // Legacy/global .env
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('Brak DB_* w root .env i brak config/*.env - nie mam jak zbudować połączenia.');
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000),
  };
}

async function clearAllTables(connection) {
  const [tables] = await connection.query(`
    SELECT TABLE_NAME AS name
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `);

  for (const { name } of tables) {
    const table = String(name);
    try {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    } catch (_) {
      await connection.query(`DELETE FROM \`${table}\``);
    }
  }
}

// -----------------------------
// executor: FAST batches + fallback
// -----------------------------

function buildBatches(statements, opts = {}) {
  const maxStatementsPerBatch = Math.max(1, Number(opts.maxStatementsPerBatch || 200));
  const maxBatchBytes = Math.max(64_000, Number(opts.maxBatchBytes || 512_000)); // ~512KB

  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const s of statements) {
    if (!s || shouldSkipStatement(s)) continue;

    const one = s.endsWith(';') ? s : (s + ';');
    const bytes = Buffer.byteLength(one, 'utf8');

    if (bytes >= maxBatchBytes) {
      if (current.length) batches.push(current);
      batches.push([s]);
      current = [];
      currentBytes = 0;
      continue;
    }

    if (current.length >= maxStatementsPerBatch || (currentBytes + bytes) > maxBatchBytes) {
      if (current.length) batches.push(current);
      current = [s];
      currentBytes = bytes;
      continue;
    }

    current.push(s);
    currentBytes += bytes;
  }

  if (current.length) batches.push(current);
  return batches;
}

async function execStatementWithFallback(connection, stmt) {
  try {
    return await connection.query(stmt);
  } catch (err) {
    const insertCount = (stmt.match(/INSERT\s+INTO/gi) || []).length;
    const looksLikeMulti = insertCount >= 2 && stmt.includes(';');

    if (err?.code === 'ER_PARSE_ERROR' && looksLikeMulti) {
      const parts = splitBySemicolonTopLevel(stmt);
      if (parts.length >= 2) {
        for (const p of parts) {
          const x = p.trim();
          if (!x) continue;
          await connection.query(x);
        }
        return;
      }
    }

    throw err;
  }
}

async function execBatch(connection, batchStatements) {
  const sql = batchStatements.map(s => (s.endsWith(';') ? s : s + ';')).join('\n');

  try {
    await connection.query(sql);
    return;
  } catch (_) {
    for (const s of batchStatements) {
      await execStatementWithFallback(connection, s);
    }
  }
}

// -----------------------------
// main
// -----------------------------

module.exports = async function restoreBackup(sqlFilePath, opts = {}) {
  const guildId = opts.guildId ? String(opts.guildId) : null;

  if (!fs.existsSync(sqlFilePath)) throw new Error('Plik backupu nie istnieje');

  const dump = fs.readFileSync(sqlFilePath, 'utf8');
  if (!dump.trim()) throw new Error('Plik backupu jest pusty');

  const dbCfg = getDbConfig(guildId);

  // UWAGA: tutaj celowo włączamy multipleStatements TYLKO dla restore
  const connection = await mysql.createConnection({
    host: dbCfg.host,
    port: dbCfg.port,
    user: dbCfg.user,
    password: dbCfg.password,
    database: dbCfg.database,

    multipleStatements: true,
    connectTimeout: dbCfg.connectTimeout || 30000,
    charset: 'utf8mb4',
  });

  let oldSqlMode = null;
  let fkDisabled = false;

  try {
    console.log('[RESTORE] start', guildId ? `(guildId=${guildId})` : '');
    console.log('[RESTORE] DB:', dbCfg.host, dbCfg.port, dbCfg.database);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    fkDisabled = true;

    const [[row]] = await connection.query('SELECT @@SESSION.sql_mode AS mode');
    oldSqlMode = String(row?.mode || '');
    const newSqlMode = removeMode(oldSqlMode, 'NO_BACKSLASH_ESCAPES');
    if (newSqlMode !== oldSqlMode) {
      await connection.query('SET SESSION sql_mode = ?', [newSqlMode]);
    }

    console.log('[RESTORE] clearing tables...');
    await clearAllTables(connection);

    console.log('[RESTORE] parsing dump...');
    const statementsRaw = splitSqlStatements(dump);
    const statements = statementsRaw.filter(s => s && !shouldSkipStatement(s));
    console.log(`[RESTORE] statements: ${statements.length}`);

    console.log('[RESTORE] executing dump statements (FAST batches)...');
    const batches = buildBatches(statements, {
      maxStatementsPerBatch: 200,
      maxBatchBytes: 512_000,
    });

    const started = Date.now();
    let done = 0;

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      await execBatch(connection, batch);
      done += batch.length;

      if (done % 100 === 0 || b === batches.length - 1) {
        const sec = Math.round((Date.now() - started) / 1000);
        console.log(`[RESTORE] progress: ${done}/${statements.length} (${sec}s)`);
      }
    }

    console.log('[RESTORE] SUCCESS');
  } catch (err) {
    console.error('[RESTORE] FAIL', err);
    throw err;
  } finally {
    try {
      if (oldSqlMode != null) {
        await connection.query('SET SESSION sql_mode = ?', [oldSqlMode]);
      }
    } catch (_) {}

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
