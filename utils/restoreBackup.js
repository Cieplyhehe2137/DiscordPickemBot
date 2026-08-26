const fs = require("fs");
const mysql = require("mysql2/promise");

const { loadGuildConfigsOnce, getGuildConfig } = require("./guildRegistry");
const { getCurrentGuildId } = require("./guildContext");

// =====================================================
// HELPERS – SQL PARSING (ZOSTAWIONE)
// =====================================================

function isEscaped(sql, i) {
  let cnt = 0;
  for (let j = i - 1; j >= 0 && sql[j] === "\\"; j--) cnt++;
  return cnt % 2 === 1;
}

function splitSqlStatements(sqlText) {
  const sql = String(sqlText || "").replace(/\r\n/g, "\n");
  const out = [];
  let stmt = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1] || "";

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

    if (!inSingle && !inDouble && ch === "`") {
      inBacktick = !inBacktick;
      stmt += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ";") {
      if (stmt.trim()) out.push(stmt.trim());
      stmt = "";
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

// Tabele celowo pomijane MIMO tego, że mają guild_id: to stan runtime
// (aktywne panele z przyciskami na Discordzie), a nie dane turniejowe.
// Odtwarzanie ich wskazywałoby na nieistniejące już wiadomości.
const VOLATILE_TABLES = new Set(["active_panels", "pending_match_edits"]);

function shouldSkipStatement(stmt) {
  const s = stmt.trim();

  // ❌ dump noise
  if (/^LOCK TABLES/i.test(s)) return true;
  if (/^UNLOCK TABLES/i.test(s)) return true;
  if (/^START TRANSACTION/i.test(s)) return true;
  if (/^COMMIT$/i.test(s)) return true;

  return false;
}

// Dump dzieli się na sekcje nagłówkami `# ---- DATA DUMP FOR TABLE: x ----`.
// Komentarze nie kończą się średnikiem, więc splitter przykleja je do
// NASTĘPNEJ instrukcji - każda instrukcja zaczyna się wtedy od `#`, a nie od
// `INSERT`/`CREATE`. Bez obcięcia tych linii rozpoznawanie instrukcji nie
// działa: nic nie zostaje zakwalifikowane jako INSERT, więc żadna tabela nie
// jest czyszczona przed wstawieniem, a CREATE TABLE trafia do środka
// transakcji (w MySQL każde DDL robi niejawny COMMIT).
function stripLeadingComments(stmt) {
  const lines = String(stmt).split("\n");
  let i = 0;

  while (
    i < lines.length &&
    (lines[i].trim() === "" || /^\s*(#|--\s)/.test(lines[i]))
  )
    i++;

  return lines.slice(i).join("\n").trim();
}

// Nazwa tabeli z `INSERT INTO`. mysqldump łamie te instrukcje na wiele linii
// (`INSERT INTO\n  \`teams\` (...)`), stąd \s+ zamiast pojedynczej spacji.
function parseInsertTable(stmt) {
  const m = /^INSERT\s+INTO\s+`?([A-Za-z0-9_$]+)`?/i.exec(stmt);
  return m ? m[1] : null;
}

function isDdlStatement(stmt) {
  return /^CREATE\s+TABLE/i.test(stmt);
}

// Które tabele w tej bazie są w ogóle przypisane do gildii. Restore dotyka
// wyłącznie ich - i przy czyszczeniu, i przy wstawianiu.
async function getGuildScopedTables(connection, dbName) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND COLUMN_NAME = 'guild_id'`,
    [dbName],
  );

  return new Set(rows.map((r) => r.TABLE_NAME));
}

// =====================================================
// DB CONFIG
// =====================================================

function getDbConfig(guildId) {
  if (!guildId) throw new Error("restoreBackup: guildId wymagane");

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

// Czyszczone są dokładnie te tabele, do których dump ma coś wstawić - nie
// lista wpisana na sztywno. Wcześniej lista miała 13 pozycji, a dump zawierał
// dane m.in. `teams`, `leaderboard`, `mvp_candidates`, `mvp_results`,
// `match_map_results` i `match_map_predictions`: nieusunięte wiersze zderzały
// się z INSERT-ami (ER_DUP_ENTRY), więc restore przewracał się PO tym, jak
// skasował pozostałe tabele. Efektem netto była utrata danych.
async function clearGuildData(connection, guildId, tables) {
  for (const table of tables) {
    await connection.query(`DELETE FROM \`${table}\` WHERE guild_id = ?`, [
      guildId,
    ]);
  }
}

// =====================================================
// EXEC
// =====================================================

async function execStatement(connection, stmt) {
  await connection.query(stmt);
}

// Wystawione do testów - klasyfikacja instrukcji decyduje o tym, co restore
// czyści i wstawia, więc musi dać się sprawdzić bez dotykania bazy.
function classifyDump(dumpText) {
  const statements = splitSqlStatements(dumpText)
    .map(stripLeadingComments)
    .filter((s) => s && !shouldSkipStatement(s));

  const inserts = [];
  const ddl = [];
  const other = [];

  for (const s of statements) {
    const table = parseInsertTable(s);
    if (table) inserts.push({ stmt: s, table });
    else if (isDdlStatement(s)) ddl.push(s);
    else other.push(s);
  }

  return { statements, inserts, ddl, other };
}

// =====================================================
// MAIN – RESTORE
// =====================================================

module.exports = async function restoreBackup(sqlFilePath, opts = {}) {
  const ctxGuildId =
    typeof getCurrentGuildId === "function" ? getCurrentGuildId() : null;

  const guildId = opts.guildId || ctxGuildId;
  if (!guildId) throw new Error("restoreBackup: brak guildId");

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error("Plik backupu nie istnieje");
  }

  const dump = fs.readFileSync(sqlFilePath, "utf8");
  if (!dump.trim()) throw new Error("Plik backupu jest pusty");

  const dbCfg = getDbConfig(guildId);

  const connection = await mysql.createConnection({
    ...dbCfg,
    multipleStatements: true,
    charset: "utf8mb4",
  });

  try {
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    const guildScoped = await getGuildScopedTables(connection, dbCfg.database);

    const statements = splitSqlStatements(dump)
      .map(stripLeadingComments)
      .filter((s) => s && !shouldSkipStatement(s));

    // W transakcji ląduje WYŁĄCZNIE DELETE + INSERT. Cała reszta z dumpa
    // (`/*!40101 SET ... */` oraz `CREATE TABLE IF NOT EXISTS`) idzie przed
    // nią: w MySQL każde DDL robi niejawny COMMIT, więc wykonane w środku
    // rozbiłoby atomowość odtwarzania danych. Na istniejącej bazie te
    // CREATE TABLE i tak są operacjami pustymi.
    const preamble = statements.filter((s) => !parseInsertTable(s));

    for (const stmt of preamble) {
      await execStatement(connection, stmt);
    }

    // Wstawiamy tylko do tabel przypisanych do gildii. Starsze pliki backupu
    // (sprzed naprawy filtra guild_id) zawierają też tabele globalne -
    // `sessions` i `admin_users` - których restore nie ma prawa nadpisywać,
    // bo nie należą do tej gildii i nie da się ich zawęzić po guild_id.
    const applied = [];
    const skipped = new Set();

    for (const stmt of statements) {
      const table = parseInsertTable(stmt);
      if (!table) continue;

      if (!guildScoped.has(table) || VOLATILE_TABLES.has(table)) {
        skipped.add(table);
        continue;
      }

      applied.push({ stmt, table });
    }

    const tablesToClear = [
      ...new Set(applied.map((a) => a.table).filter(Boolean)),
    ];

    await connection.beginTransaction();

    try {
      await clearGuildData(connection, guildId, tablesToClear);

      for (const { stmt } of applied) {
        await execStatement(connection, stmt);
      }

      await connection.commit();
    } catch (err) {
      // Bez tego rollbacku porażka w połowie zostawiała bazę z wyczyszczonymi
      // tabelami i tylko częściowo wstawionymi danymi.
      try {
        await connection.rollback();
      } catch (_) {}
      throw err;
    }

    return {
      clearedTables: tablesToClear,
      statementsApplied: applied.length,
      skippedTables: [...skipped],
    };
  } catch (err) {
    console.error("[RESTORE] FAIL", err);
    throw err;
  } finally {
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (_) {}
    try {
      await connection.end();
    } catch (_) {}
  }
};

// Wystawione do testów - klasyfikacja instrukcji decyduje o tym, co restore
// czyści i wstawia, więc musi dać się sprawdzić bez dotykania bazy.
module.exports.classifyDump = classifyDump;
