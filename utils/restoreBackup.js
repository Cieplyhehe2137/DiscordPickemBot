// utils/restoreBackup.js
const fs = require('fs');
const db = require('../db');

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

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    // single quotes
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle) {
        if (next === "'") { stmt += "''"; i++; continue; }
        const prev = i > 0 ? sql[i - 1] : '';
        if (prev !== '\\') inSingle = false;
      } else {
        inSingle = true;
      }
      stmt += ch;
      continue;
    }

    // double quotes
    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const prev = i > 0 ? sql[i - 1] : '';
        if (prev !== '\\') inDouble = false;
      } else {
        inDouble = true;
      }
      stmt += ch;
      continue;
    }

    // backticks
    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      stmt += ch;
      continue;
    }

    // split
    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      const t = stmt.trim();
      if (t) out.push(t);
      stmt = '';
      continue;
    }

    stmt += ch;
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
    if (idx === 0) return true;
    return sql[idx - 1] === '\n';
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

    // quotes/backticks
    if (!inDouble && !inBacktick && ch === "'") {
      if (inSingle) {
        if (next === "'") { stmt += "''"; i += 2; continue; }
        const prev = i > 0 ? sql[i - 1] : '';
        if (prev !== '\\') inSingle = false;
      } else {
        inSingle = true;
      }
      stmt += ch;
      i++;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      if (inDouble) {
        const prev = i > 0 ? sql[i - 1] : '';
        if (prev !== '\\') inDouble = false;
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

module.exports = async function restoreBackup(sqlFilePath, opts = {}) {
  const guildId = opts.guildId ? String(opts.guildId) : null;
  const pool = guildId ? db.getPoolForGuild(guildId) : db;

  if (!fs.existsSync(sqlFilePath)) throw new Error('Plik backupu nie istnieje');

  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  if (!sql.trim()) throw new Error('Plik backupu jest pusty');

  const connection = await pool.getConnection();

  try {
    console.log('[RESTORE] start', guildId ? `(guildId=${guildId})` : '');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query(`SET @__old_sql_mode := @@sql_mode`);

    await connection.query(`
  SET @__new_sql_mode := @@sql_mode;
  SET @__new_sql_mode := REPLACE(@__new_sql_mode, 'NO_BACKSLASH_ESCAPES', '');
  SET @__new_sql_mode := REPLACE(@__new_sql_mode, ',,', ',');
  SET @__new_sql_mode := TRIM(BOTH ',' FROM @__new_sql_mode);
  SET SESSION sql_mode := @__new_sql_mode;
`);
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
        // Fallback for "many INSERTs in one string"
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
            continue; // ✅ rescued
          }
        }

        err.message = `[RESTORE] Statement #${idx + 1}/${statements.length} failed: ${err.message}`;
        throw err;
      }
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    await connection.query(`SET SESSION sql_mode := @__old_sql_mode`);
    console.log('[RESTORE] SUCCESS');
  } catch (err) {
    console.error('[RESTORE] FAIL', err);
    throw err;
  } finally {
    connection.release();
  }
};
