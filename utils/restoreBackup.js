// utils/restoreBackup.js
const fs = require('fs');
const db = require('../db');

// apostrof/cudzysłów jest escaped, jeśli bezpośrednio przed nim jest nieparzysta liczba backslashy
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

    // single quotes
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

    // split on ; outside quotes
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
 * Split SQL dump into statements without using multipleStatements=true.
 * Supports:
 * - DELIMITER changes (basic)
 * - ignores line comments (--, #) and block comments (/* ... * /) except /*! ... * / (kept)
 * - avoids splitting inside quotes/backticks
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

function removeMode(modeStr, modeName) {
  const modes = String(modeStr || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return modes.filter(m => m !== modeName).join(',');
}

module.exports = async function restoreBackup(sqlFilePath, opts = {}) {
  const guildId = opts.guildId ? String(opts.guildId) : null;
  const pool = guildId ? db.getPoolForGuild(guildId) : db;

  if (!fs.existsSync(sqlFilePath)) throw new Error('Plik backupu nie istnieje');

  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  if (!sql.trim()) throw new Error('Plik backupu jest pusty');

  const connection = await pool.getConnection();

  let oldSqlMode = null;
  let fkDisabled = false;

  try {
    console.log('[RESTORE] start', guildId ? `(guildId=${guildId})` : '');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    fkDisabled = true;

    // zdejmij NO_BACKSLASH_ESCAPES na czas restore (bez multi statements)
    const [[row]] = await connection.query('SELECT @@SESSION.sql_mode AS mode');
    oldSqlMode = String(row?.mode || '');
    const newSqlMode = removeMode(oldSqlMode, 'NO_BACKSLASH_ESCAPES');
    if (newSqlMode !== oldSqlMode) {
      await connection.query('SET SESSION sql_mode = ?', [newSqlMode]);
    }

    console.log('[RESTORE] clearing tables...');
    await clearAllTables(connection);

    console.log('[RESTORE] executing dump statements...');
    const statements = splitSqlStatements(sql);

    for (let idx = 0; idx < statements.length; idx++) {
      const s = statements[idx];
      if (!s || shouldSkipStatement(s)) continue;

      try {
        await connection.query(s);
      } catch (err) {
        // safety fallback: if something is still multi-statement-like, split by ';'
        const insertCount = (s.match(/INSERT\s+INTO/gi) || []).length;
        const looksLikeMulti = insertCount >= 2 && s.includes(';');

        if (err?.code === 'ER_PARSE_ERROR' && looksLikeMulti) {
          const parts = splitBySemicolonTopLevel(s);
          if (parts.length >= 2) {
            for (const part of parts) {
              const stmt2 = part.trim();
              if (!stmt2) continue;
              await connection.query(stmt2);
            }
            continue;
          }
        }

        err.message = `[RESTORE] Statement #${idx + 1}/${statements.length} failed: ${err.message}`;
        throw err;
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

    connection.release();
  }
};
