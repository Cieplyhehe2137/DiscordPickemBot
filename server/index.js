import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();
console.log("[ENV] DISCORD_CLIENT_ID:", process.env.DISCORD_CLIENT_ID);
console.log("[ENV] DISCORD_REDIRECT_URI:", process.env.DISCORD_REDIRECT_URI);
import http from "http";
import { Server } from "socket.io";
import { startCs2LogReceiver } from "./live/cs2LogReceiver.js";
import { parseCs2LogLine } from "./live/cs2LogParser.js";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const calculateScores = require("../handlers/matches/calculateScores");
const {
  assertPredictionsAllowed,
  normalizePhase,
} = require("../utils/protectionsGuards");
const guildRegistry = require("../utils/guildRegistry");
const teamsStore = require("../utils/teamsStore");
const matchesStore = require("../utils/matchesStore");
const recalculateMatchPoints = require("../services/recalculateMatchPoints");
const applyMatchResult = require("../services/applyMatchResult");
// emitDashboardRefresh było używane w /api/events/:slug/status, ale nigdy
// nie zostało zaimportowane - zmiana statusu turnieju zapisywała się w bazie,
// a potem wywalała się na ReferenceError i zwracała 500.
const { setIo, emitDashboardRefresh } = require("../utils/socket");
const resultProposalsStore = require("../utils/resultProposalsStore");
const { getResultProvider } = require("../utils/resultProviders");
const { runInTransaction } = require("../utils/runInTransaction");
const { parseMatchList } = require("../utils/parseMatchList");
const {
  isWinnerCorrect,
  isSeriesExact,
  isMapWinnerCorrect,
  isMapExact,
  calculateStreaks,
  calculateRecentForm,
  getBoStats,
  calculateMapAccuracy,
  calculateTeamStats,
  calculateContrarianStats,
  calculateCommunityAnalysis,
  calculateTrendStats,
  calculatePlayerStyle,
  percentageNumber,
} = require("../utils/playerStats");
const { getOpenEventId } = require("../utils/getOpenEventId");
const exportClassification = require("../handlers/admin/exportClassification");
const { loadActiveTeams } = require("../utils/loadActiveTeams");
const { getCurrentSwissResults } = require("../utils/swissRepository");
const { getCurrentPlayoffs } = require("../utils/playoffsRepository");
const {
  getCurrentDoubleElimResults,
} = require("../utils/doubleelimRepository");
const { getCurrentPlayinResults } = require("../utils/playinRepository");
const { maxMapsFromBo } = require("../utils/mapLabels");
const {
  getEventPickemConfig,
  setEventPickemConfig,
  getPhaseLimits,
  sprawdzTyp,
  FAZY: FAZY_PICKEM,
} = require("../utils/eventPickemConfig");

const {
  phasesConfig: FAZY_PANELU_CONFIG,
  FAZA_PANELU,
} = require("../utils/pickemPanelBuilder");
const fs = require("fs");

const restoreBackup = require("../utils/restoreBackup");
const mysqldump = require("mysqldump");
const { logInfo, logWarn, logError } = require("../utils/logger");
const mysql2 = require("mysql2/promise");
const {
  getLockBeforeSec,
  isMatchStarted,
  isMatchLocked,
} = require("../utils/matchLock");

const {
  VALID_PHASES,
  parseDeadlineInput,
  findPanelForDeadline,
  findPanelForMatchDeadline,
  isPickDeadlinePassed,
  isMatchDeadlinePassed,
} = require("../utils/deadlineRepository");

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:5173";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMINISTRATOR_PERMISSION = 0x8n;

function sqlEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeFileBase(value, fallback = "pickem_export") {
  const safe = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");

  return safe || fallback;
}

function assertSafeBackupFileName(fileName) {
  const name = String(fileName || "");

  if (!/^backup_[a-zA-Z0-9_-]+_\d{4}-\d{2}-\d{2}T[\d-]+Z\.sql$/.test(name)) {
    throw new Error("Invalid backup file name");
  }

  return name;
}

function validateCs2Score(scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);

  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return false;
  }

  if (a < 0 || b < 0) {
    return false;
  }

  if (a === b) {
    return false;
  }

  const winner = Math.max(a, b);
  const loser = Math.min(a, b);

  if (winner === 13) {
    return loser >= 0 && loser <= 11;
  }

  if (winner >= 16 && (winner - 16) % 3 === 0) {
    return loser >= winner - 4 && loser <= winner - 2;
  }

  return false;
}

function validateSeriesMapOrder(mapPicks, bestOf) {
  const winsNeeded = Math.ceil(bestOf / 2);

  let winsA = 0;
  let winsB = 0;

  for (let index = 0; index < mapPicks.length; index += 1) {
    const map = mapPicks[index];

    const scoreA = Number(map.pred_exact_a);
    const scoreB = Number(map.pred_exact_b);

    if (scoreA > scoreB) {
      winsA += 1;
    } else if (scoreB > scoreA) {
      winsB += 1;
    } else {
      return false;
    }

    const seriesFinished = winsA === winsNeeded || winsB === winsNeeded;

    if (seriesFinished && index !== mapPicks.length - 1) {
      return false;
    }
  }

  return winsA === winsNeeded || winsB === winsNeeded;
}

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

// Ile backupów trzymamy na gildię. Zrzut to ~40 KB, więc 10 sztuk to
// pół megabajta - limit istnieje po to, żeby katalog nie rósł w nieskończoność
// przy adminie klikającym "Utwórz backup" przed każdą zmianą, a nie po to,
// żeby oszczędzać miejsce.
const BACKUP_RETENTION = Number(process.env.BACKUP_RETENTION) || 10;

function pruneGuildBackups(guildId) {
  const { backupDir } = guildRegistry.getGuildPaths(guildId);

  // listGuildBackups sortuje od najnowszego, więc do usunięcia idzie ogon.
  const stale = listGuildBackups(guildId).slice(BACKUP_RETENTION);
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

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: WEB_ORIGIN,
    credentials: true,
  },
});

setIo(io);

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Frontend disconnected:", socket.id);
  });
});

function parseCsvPick(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Na produkcji aplikacja stoi za reverse proxy (Plesk/nginx kończy TLS i
// dopiero wewnętrznie odzywa się po HTTP). Bez tego Express widzi połączenie
// jako nieszyfrowane i express-session PRZY cookie.secure=true w ogóle nie
// ustawi ciasteczka sesji - logowanie po prostu przestaje działać, bez
// żadnego błędu w logach. Zaufanie ograniczone do pierwszego skoku (proxy
// hosta), żeby nie dało się podszyć nagłówkiem X-Forwarded-For z zewnątrz.
if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json());

const MySQLStore = MySQLStoreFactory(session);

// Table is created manually (see migrations/README.md) rather than via
// createDatabaseTable, so schema changes stay reviewable like everything
// else touching the shared production database.
const sessionStore = new MySQLStore({ createDatabaseTable: false }, pool);

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "pickem-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: IS_PRODUCTION,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// Discord's permission bitfield can exceed 32 bits, so it must be compared as a BigInt.
function hasAdminPermission(user, guildId) {
  if (!user || !guildId) return false;
  const guild = (user.guilds || []).find((g) => g.id === String(guildId));
  if (!guild) return false;

  try {
    return (
      (BigInt(guild.permissions) & ADMINISTRATOR_PERMISSION) ===
      ADMINISTRATOR_PERMISSION
    );
  } catch {
    return false;
  }
}

function isGuildMember(user, guildId) {
  if (!user || !guildId) return false;
  return (user.guilds || []).some((g) => g.id === String(guildId));
}

// resolveGuildId(req) -> guildId | Promise<guildId>; runs after the login check so it can safely query the DB.
function requireGuildAdmin(resolveGuildId) {
  return async (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Musisz być zalogowany." });
    }

    try {
      const guildId = await resolveGuildId(req);

      if (!guildId) {
        return res.status(404).json({ error: "Nie znaleziono." });
      }

      if (!hasAdminPermission(user, guildId)) {
        return res
          .status(403)
          .json({ error: "Wymagane uprawnienia administratora na tym serwerze." });
      }

      req.guildId = String(guildId);
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się zweryfikować uprawnień." });
    }
  };
}

// Kind values used by the pickem endpoints -> phase strings stored in
// active_panels (matches what /set_deadline writes; swiss additionally
// resolves to swiss_stageN + stage_key inside isPickDeadlinePassed).
const PICKEM_PANEL_PHASE = {
  SWISS: "swiss",
  PLAYIN: "playin",
  PLAYOFFS: "playoffs",
  DOUBLEELIM: "doubleelim",
};

// matches.phase values -> active_panels.phase strings for match panels
// (what the match-deadline endpoint writes; not stage-specific, same as the bot).
//
// Kluczujemy po WYNIKU normalizePhase(), nie po surowej wartości kolumny.
// matches.phase trzyma 'swiss_stage1' / 'playoffs' / 'doubleelim' / 'playin',
// a wcześniejsze klucze ('SWISS', 'PLAY_IN', 'PLAYOFFS', 'DOUBLE_ELIM') nie
// pasowały do żadnej z nich - odczyt zawsze dawał undefined, więc warunek
// `if (matchPanelPhase)` nie wchodził w ŻADNYM z pięciu miejsc i deadline
// meczowy nie blokował niczego po stronie WWW, mimo że na Discordzie
// closeExpiredPanels wyłączał wtedy komponenty panelu.
const MATCH_PANEL_PHASE = {
  SWISS: "swiss",
  SWISS_STAGE1: "swiss",
  SWISS_STAGE2: "swiss",
  SWISS_STAGE3: "swiss",
  PLAYIN: "playin",
  PLAYOFFS: "playoffs",
  DOUBLEELIM: "doubleelim",
};

// normalizePhase() zbija warianty zapisu ('playin' / 'play_in' / 'PLAY-IN',
// 'doubleelim' / 'double_elim') do jednej postaci, więc stare wiersze z
// legacy zapisem fazy trafiają tu tak samo jak nowe.
function matchPanelPhaseFor(phase) {
  if (!phase) return null;
  return MATCH_PANEL_PHASE[normalizePhase(phase)] || null;
}

// ======================================================
// KOMUNIKATY GUARDA -> WWW
// ======================================================
//
// Guardy w utils/protectionsGuards.js piszą komunikaty pod Discorda: emoji na
// początku i **pogrubienie** markdownem. API oddawało je bez zmian, a React
// renderuje tekst dosłownie, więc gracz widział na ekranie:
//
//   ❌ ❌ Aktualna faza to **SWISS_STAGE1** — typowanie Play-In jest niedostępne.
//
// (drugie ❌ dokleja frontend). Do tego SWISS_STAGE1 to surowa wartość kolumny.
//
// Nie zmieniamy tekstów w guardzie, bo Discord renderuje je poprawnie -
// czyścimy je dopiero na granicy HTTP.

const NAZWY_FAZ_WWW = {
  SWISS: "Swiss",
  SWISS_STAGE1: "Swiss Stage 1",
  SWISS_STAGE2: "Swiss Stage 2",
  SWISS_STAGE3: "Swiss Stage 3",
  PLAYOFFS: "Playoffs",
  PLAYIN: "Play-In",
  DOUBLEELIM: "Double Elimination",
  MATCHES: "mecze",
  NOT_STARTED: "nierozpoczęty",
  UNKNOWN: "nieznana",
};

function komunikatNaWWW(tekst, zapasowy = null) {
  if (!tekst) return zapasowy;

  return (
    String(tekst)
      // identyfikatory faz -> nazwy czytelne dla gracza
      .replace(/\*\*([A-Z0-9_]+)\*\*/g, (dopasowanie, faza) =>
        NAZWY_FAZ_WWW[faza] ? NAZWY_FAZ_WWW[faza] : faza,
      )
      // reszta pogrubień markdownem
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // emoji statusu na początku (Discord je potrzebuje, WWW ma własne style)
      .replace(/^[\s\p{Extended_Pictographic}️]+/u, "")
      .trim() || zapasowy
  );
}

// ======================================================
// MECZ + STAN TYPOWANIA - WSPOLNE DLA LISTY I POJEDYNCZEGO MECZU
// ======================================================
//
// Strona meczu na WWW pobierala CALA liste meczow turnieju i wyszukiwala
// w niej jeden po id, bo nie bylo publicznego endpointu pojedynczego meczu
// (/api/matches/:matchId jest adminowy). Przy 4 meczach to niewidoczne,
// przy 106 - kazde wejscie w mecz i kazde odswiezenie po zdarzeniu realtime
// ciagnie pelna liste razem z per-meczowa kontrola deadline'u.
//
// Zapytanie i wyliczanie stanu siedza tutaj, zeby lista i pojedynczy mecz
// nie mogly sie rozjechac - inaczej mecz otwarty na liscie moglby byc
// zablokowany na swojej stronie albo odwrotnie.

function sqlMeczeZTypem(warunek) {
  return `
      SELECT
        m.id,
        m.event_id,
        m.guild_id,
        m.phase,
        m.match_no,
        m.team_a,
        m.team_b,
        m.best_of,
        m.start_time_utc,
        m.is_locked,
        m.lock_override,

        mp.pred_a,
        mp.pred_b,
        mp.pred_exact_a,
        mp.pred_exact_b,

        COALESCE(mmp.saved_maps, 0) AS saved_maps,

        CASE
          WHEN mr.match_id IS NOT NULL THEN 'FINAL'
          WHEN m.lock_override = 1 THEN 'LOCKED'
          WHEN m.lock_override = 0 THEN 'OPEN'
          WHEN m.is_locked = 1 THEN 'LOCKED'
          ELSE 'OPEN'
        END AS ui_status,

        CASE
          WHEN ? IS NULL THEN 'empty'

          WHEN m.best_of = 1
            AND mp.match_id IS NOT NULL
            AND mp.pred_exact_a IS NOT NULL
            AND mp.pred_exact_b IS NOT NULL
          THEN 'complete'

          WHEN m.best_of > 1
            AND mp.match_id IS NOT NULL
            AND COALESCE(mmp.saved_maps, 0) >= (mp.pred_a + mp.pred_b)
          THEN 'complete'

          WHEN mp.match_id IS NOT NULL
            OR COALESCE(mmp.saved_maps, 0) > 0
          THEN 'partial'

          ELSE 'empty'
        END AS prediction_status

      FROM matches m

      LEFT JOIN match_results mr
        ON mr.match_id = m.id
       AND mr.event_id = m.event_id
       AND mr.guild_id = m.guild_id

      LEFT JOIN match_predictions mp
        ON mp.guild_id = m.guild_id
       AND mp.event_id = m.event_id
       AND mp.match_id = m.id
       AND mp.user_id = ?

      LEFT JOIN (
        SELECT
          guild_id,
          event_id,
          match_id,
          user_id,
          COUNT(*) AS saved_maps
        FROM match_map_predictions
        GROUP BY
          guild_id,
          event_id,
          match_id,
          user_id
      ) mmp
        ON mmp.guild_id = m.guild_id
       AND mmp.event_id = m.event_id
       AND mmp.match_id = m.id
       AND mmp.user_id = ?

      WHERE ${warunek}

      ORDER BY
        m.match_no ASC,
        m.id ASC
      `;
}

// Dolicza do wiersza meczu to, czego nie da sie policzyc w SQL:
// globalny gate turnieju, blokade meczu i deadline meczowy fazy.
//
// deadlineCache trzyma obietnice per faza panelu - lista 106 meczow pyta
// wtedy o deadline raz na faze, a nie raz na mecz.
async function stanTypowaniaMeczu({ match, gate, guildId, deadlineCache }) {
  const base = {
    ...match,
    saved_maps: Number(match.saved_maps || 0),
  };

  if (match.ui_status === "FINAL") {
    return {
      ...base,
      predictions_allowed: false,
      lock_reason: "Mecz został zakończony.",
      ui_status: "FINAL",
    };
  }

  if (!gate.allowed) {
    return {
      ...base,
      predictions_allowed: false,
      lock_reason: komunikatNaWWW(
        gate.message,
        "Typowanie meczów jest aktualnie zamknięte.",
      ),
      ui_status: "LOCKED",
    };
  }

  if (isMatchLocked(match)) {
    return {
      ...base,
      predictions_allowed: false,
      lock_reason: "Mecz jest zablokowany.",
      ui_status: "LOCKED",
    };
  }

  const matchPanelPhase = matchPanelPhaseFor(match.phase);

  if (matchPanelPhase) {
    if (!deadlineCache.has(matchPanelPhase)) {
      deadlineCache.set(
        matchPanelPhase,
        isMatchDeadlinePassed(pool, guildId, matchPanelPhase),
      );
    }

    const { passed } = await deadlineCache.get(matchPanelPhase);

    if (passed) {
      return {
        ...base,
        predictions_allowed: false,
        lock_reason: "Deadline typowania wyników meczów dla tej fazy minął.",
        ui_status: "LOCKED",
      };
    }
  }

  return {
    ...base,
    predictions_allowed: true,
    lock_reason: null,
    ui_status: "OPEN",
  };
}

// Tournament-state gate + panel deadline gate in one place. Discord only
// enforces deadlines by disabling message components, which the web API
// never sees - this adds the equivalent server-side block for web saves.
async function pickemGate(guildId, kind, stage = null) {
  const gate = await assertPredictionsAllowed({ guildId, kind, stage });

  if (!gate.allowed) return gate;

  const { passed } = await isPickDeadlinePassed(
    pool,
    guildId,
    PICKEM_PANEL_PHASE[kind],
    stage,
  );

  if (passed) {
    return {
      allowed: false,
      message: "Deadline typowania dla tej fazy minął.",
    };
  }

  return gate;
}

async function guildIdFromEventSlug(req) {
  const [[event]] = await pool.query(
    "SELECT guild_id FROM events WHERE slug = ? LIMIT 1",
    [req.params.slug],
  );
  return event?.guild_id || null;
}

async function guildIdFromMatchId(req) {
  const [[match]] = await pool.query(
    "SELECT guild_id FROM matches WHERE id = ? LIMIT 1",
    [req.params.matchId],
  );
  return match?.guild_id || null;
}

async function guildIdFromProposalId(req) {
  const [[row]] = await pool.query(
    "SELECT guild_id FROM match_result_proposals WHERE id = ? LIMIT 1",
    [req.params.proposalId],
  );
  return row?.guild_id || null;
}

app.get("/api/auth/me", (req, res) => {
  res.json({
    user: req.session?.user || null,
  });
});

app.get("/api/auth/discord", (req, res) => {
  console.log("[AUTH] Discord login start");

  req.session.returnTo = req.query.returnTo || "/public";

  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).send("Session save failed");
    }

    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
    });

    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log("[AUTH] returnTo query:", req.query.returnTo);
    console.log("[AUTH] returnTo saved:", req.session.returnTo);

    res.redirect(url);
  });
});

app.get("/api/auth/discord/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Missing code");
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Discord token error:", tokenData);
      return res.status(401).send("Discord OAuth failed");
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const discordUser = await userResponse.json();

    if (!userResponse.ok) {
      console.error("Discord user error:", discordUser);
      return res.status(401).send("Discord user fetch failed");
    }

    // Needed to know which guilds the user can administer (used by hasAdminPermission/isGuildMember).
    const guildsResponse = await fetch(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const discordGuilds = guildsResponse.ok ? await guildsResponse.json() : [];

    if (!guildsResponse.ok) {
      console.error(
        "Discord guilds fetch failed:",
        await guildsResponse.text().catch(() => ""),
      );
    }

    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name,
      avatar: discordUser.avatar,
      guilds: Array.isArray(discordGuilds)
        ? discordGuilds.map((g) => ({
          id: g.id,
          name: g.name,
          permissions: g.permissions,
        }))
        : [],
    };

    await pool.query(
      `
  INSERT INTO user_profiles (
    user_id,
    username,
    displayname,
    avatar
  )
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    username = VALUES(username),
    displayname = VALUES(displayname),
    avatar = VALUES(avatar),
    updated_at = CURRENT_TIMESTAMP
  `,
      [
        discordUser.id,
        discordUser.username,
        discordUser.global_name || discordUser.username,
        discordUser.avatar,
      ],
    );

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session save failed");
      }

      const returnTo = req.session.returnTo || "/public";
      delete req.session.returnTo;

      res.redirect(`${WEB_ORIGIN}${returnTo}`);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth callback failed");
  }
});

if (!IS_PRODUCTION) {
  // Dev-only login shortcut. Never enable in production - it logs anyone in as a real Discord account with no credentials.
  app.get("/api/auth/dev-login", (req, res) => {
    req.session.user = {
      id: "461851082570596352",
      username: "cieplyhehe",
      global_name: "cieplyhehe",
      avatar: null,
      guilds: guildRegistry.getAllGuildIds().map((id) => ({
        id,
        name: id,
        permissions: String(ADMINISTRATOR_PERMISSION),
      })),
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Session save failed");
      }

      res.redirect(`${WEB_ORIGIN}/public`);
    });
  });
}

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      ok: true,
    });
  });
});

app.get("/api/events/active", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        e.id,
        e.name,
        e.slug,
        e.phase,
        e.status,

        (
          SELECT COUNT(DISTINCT mp.user_id)
          FROM match_predictions mp
          WHERE mp.event_id = e.id
        ) AS participants,

        (
          SELECT COUNT(*)
          FROM match_predictions mp
          WHERE mp.event_id = e.id
        ) AS predictions,

        (
          SELECT ap.deadline
          FROM active_panels ap
          WHERE ap.guild_id COLLATE utf8mb4_unicode_ci = e.guild_id
            AND ap.phase COLLATE utf8mb4_unicode_ci = e.phase
            AND ap.active = 1
            AND ap.deadline IS NOT NULL
          ORDER BY ap.deadline ASC
          LIMIT 1
        ) AS deadline

      FROM events e
      WHERE e.is_active = 1
        AND e.is_archived = 0
      ORDER BY e.id DESC
    `);

    res.json({
      events: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd bazy danych." });
  }
});

// Ilu graczy w ogole wzielo udzial w evencie.
//
// Wczesniej liczyla to sama tabela match_predictions, wiec ktos, kto typowal
// tylko druzyny (Swiss, Playoffs, Play-In, Double Elim), a nie typowal
// meczow, nie liczyl sie jako uczestnik. Odkad typowanie druzyn jest osobnym
// bytem podpietym do eventu, to juz nie jest przypadek brzegowy.
//
// CAST + COLLATE w kazdej galezi UNION, bo user_id ma rozne kolacje
// w roznych tabelach i inaczej leci ER_CANT_AGGREGATE_NCOLLATIONS.
async function policzUczestnikow(eventId) {
  const [[wiersz]] = await pool.query(
    `
    SELECT COUNT(DISTINCT user_id) AS uczestnicy
    FROM (
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
        FROM match_predictions WHERE event_id = ?
      UNION
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM swiss_predictions WHERE event_id = ?
      UNION
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM playoffs_predictions WHERE event_id = ?
      UNION
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM playin_predictions WHERE event_id = ?
      UNION
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
        FROM doubleelim_predictions WHERE event_id = ?
    ) typujacy
    `,
    [eventId, eventId, eventId, eventId, eventId],
  );

  return Number(wiersz?.uczestnicy || 0);
}

app.get("/api/events/:slug/summary", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const [[matchStats]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_matches
      FROM matches
      WHERE event_id = ?
      `,
      [event.id],
    );

    const [[predictionStats]] = await pool.query(
      `
      SELECT COUNT(*) AS predictions
      FROM match_predictions
      WHERE event_id = ?
      `,
      [event.id],
    );

    const uczestnicy = await policzUczestnikow(event.id);

    const user = req.session?.user;

    let myPredictions = 0;

    if (user) {
      const [[myPredictionStats]] = await pool.query(
        `
    SELECT COUNT(*) AS predictions
    FROM match_predictions
    WHERE event_id = ?
      AND user_id = ?
    `,
        [event.id, user.id],
      );

      myPredictions = myPredictionStats?.predictions || 0;
    }

    const [[statusStats]] = await pool.query(
      `
  SELECT
    COUNT(*) AS total,

    SUM(
      mr.match_id IS NOT NULL
    ) AS finished_matches,

    SUM(
      mr.match_id IS NULL
      AND m.start_time_utc IS NOT NULL
      AND m.start_time_utc <= UTC_TIMESTAMP()
    ) AS live_matches,

SUM(
  mr.match_id IS NULL
  AND m.is_locked = 1
  AND (
    m.start_time_utc IS NULL
    OR m.start_time_utc > UTC_TIMESTAMP()
  )
) AS locked_matches,

    SUM(
      mr.match_id IS NULL
      AND m.is_locked = 0
      AND (
        m.start_time_utc IS NULL
        OR m.start_time_utc > UTC_TIMESTAMP()
      )
    ) AS scheduled_matches

  FROM matches m

  LEFT JOIN match_results mr
    ON mr.match_id = m.id
   AND mr.event_id = m.event_id
   AND mr.guild_id = m.guild_id

  WHERE m.event_id = ?
  `,
      [event.id],
    );

    const [[nextMatch]] = await pool.query(
      `
  SELECT
    m.id,
    m.phase,
    m.team_a,
    m.team_b,
    m.best_of,
    m.start_time_utc,
    m.is_locked
  FROM matches m
  LEFT JOIN match_results mr
    ON mr.match_id = m.id
   AND mr.event_id = m.event_id
   AND mr.guild_id = m.guild_id
  WHERE m.event_id = ?
    AND m.start_time_utc IS NOT NULL
    AND m.start_time_utc >= UTC_TIMESTAMP()
    AND mr.match_id IS NULL
  ORDER BY m.start_time_utc ASC
  LIMIT 1
  `,
      [event.id],
    );

    const [phaseRows] = await pool.query(
      `
  SELECT DISTINCT phase
  FROM matches
  WHERE event_id = ?
    AND phase IS NOT NULL
  `,
      [event.id],
    );

    // Które fazy Pick'Em ten turniej FAKTYCZNIE ma.
    //
    // Strona eventu linkowała na sztywno wszystkie sześć (Swiss 1/2/3,
    // Play-In, Playoffs, Double Elim) niezależnie od formatu, więc turniej
    // bez Play-In i tak go pokazywał, a kliknięcie prowadziło na stronę
    // z komunikatem o niedostępności.
    //
    // active_panels nie nadaje się na źródło - nie ma event_id, jest per
    // gildia, a po zamknięciu panelu wiersz i tak przestaje być aktywny.
    // Bierzemy więc ślady w danych: mecze, typy graczy i wpisane wyniki.
    // Dzięki temu zakończony turniej nadal pokazuje swoje fazy.
    // Kto pyta - potrzebne, żeby powiedzieć "już wytypowałeś tę fazę".
    const userId = req.session?.user?.id || null;

    const [
      [swissStages],
      [pozostaleFazy],
      [swissZWynikiem],
      [inneZWynikiem],
      [swissMojeTypy],
      [inneMojeTypy],
    ] = await Promise.all([
      pool.query(
        `
        SELECT DISTINCT stage FROM swiss_predictions
         WHERE event_id = ? AND stage IS NOT NULL
        UNION
        SELECT DISTINCT stage FROM swiss_results
         WHERE event_id = ? AND stage IS NOT NULL
        `,
        [event.id, event.id],
      ),
      pool.query(
        `
        SELECT
          (SELECT COUNT(*) FROM playoffs_predictions WHERE event_id = ?)
        + (SELECT COUNT(*) FROM playoffs_results     WHERE event_id = ?) AS playoffs,
          (SELECT COUNT(*) FROM playin_predictions   WHERE event_id = ?)
        + (SELECT COUNT(*) FROM playin_results       WHERE event_id = ?) AS playin,
          (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ?)
        + (SELECT COUNT(*) FROM doubleelim_results     WHERE event_id = ?) AS doubleelim
        `,
        [event.id, event.id, event.id, event.id, event.id, event.id],
      ),

      // Które fazy mają już OPUBLIKOWANY oficjalny wynik (nie tylko typy).
      pool.query(
        `SELECT DISTINCT stage FROM swiss_results
          WHERE event_id = ? AND active = 1 AND stage IS NOT NULL`,
        [event.id],
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM playoffs_results   WHERE event_id = ? AND active = 1) AS playoffs,
           (SELECT COUNT(*) FROM playin_results     WHERE event_id = ? AND active = 1) AS playin,
           (SELECT COUNT(*) FROM doubleelim_results WHERE event_id = ? AND active = 1) AS doubleelim`,
        [event.id, event.id, event.id],
      ),

      // Czy pytający ma już zapisany typ w danej fazie.
      userId
        ? pool.query(
            `SELECT DISTINCT stage FROM swiss_predictions
              WHERE event_id = ? AND user_id = ? AND stage IS NOT NULL`,
            [event.id, userId],
          )
        : Promise.resolve([[]]),
      userId
        ? pool.query(
            `SELECT
               (SELECT COUNT(*) FROM playoffs_predictions   WHERE event_id = ? AND user_id = ?) AS playoffs,
               (SELECT COUNT(*) FROM playin_predictions     WHERE event_id = ? AND user_id = ?) AS playin,
               (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ? AND user_id = ?) AS doubleelim`,
            [event.id, userId, event.id, userId, event.id, userId],
          )
        : Promise.resolve([[{}]]),
    ]);

    const fazyPickem = new Set();

    // Fazy wynikające z meczów (matches.phase -> klucz trasy frontu).
    for (const row of phaseRows) {
      const znormalizowana = normalizePhase(row.phase);

      // Starsze mecze mają fazę "SWISS" bez numeru etapu - z czasów sprzed
      // podziału na stage1/2/3. Traktujemy je jak Stage 1, bo tam trafiały
      // ich typy; inaczej stary turniej nie pokazałby żadnej fazy Swiss.
      if (znormalizowana === "SWISS") fazyPickem.add("stage1");

      if (znormalizowana === "SWISS_STAGE1") fazyPickem.add("stage1");
      if (znormalizowana === "SWISS_STAGE2") fazyPickem.add("stage2");
      if (znormalizowana === "SWISS_STAGE3") fazyPickem.add("stage3");
      if (znormalizowana === "PLAYOFFS") fazyPickem.add("playoffs");
      if (znormalizowana === "PLAYIN") fazyPickem.add("playin");
      if (znormalizowana === "DOUBLEELIM") fazyPickem.add("doubleelim");
    }

    for (const row of swissStages) {
      if (["stage1", "stage2", "stage3"].includes(row.stage)) {
        fazyPickem.add(row.stage);
      }
    }

    const liczniki = pozostaleFazy[0] || {};
    if (Number(liczniki.playoffs) > 0) fazyPickem.add("playoffs");
    if (Number(liczniki.playin) > 0) fazyPickem.add("playin");
    if (Number(liczniki.doubleelim) > 0) fazyPickem.add("doubleelim");

    // Faza, w której turniej jest teraz - nawet jeśli nikt jeszcze nie typował
    // i nie ma jeszcze meczów. Bez tego świeżo otwarta faza nie miałaby linku.
    const biezaca = normalizePhase(event.phase);
    const MAPA_BIEZACEJ = {
      SWISS_STAGE1: "stage1",
      SWISS_STAGE2: "stage2",
      SWISS_STAGE3: "stage3",
      PLAYOFFS: "playoffs",
      PLAYIN: "playin",
      DOUBLEELIM: "doubleelim",
    };
    if (MAPA_BIEZACEJ[biezaca]) fazyPickem.add(MAPA_BIEZACEJ[biezaca]);

    const KOLEJNOSC = [
      "stage1",
      "stage2",
      "stage3",
      "playin",
      "playoffs",
      "doubleelim",
    ];

    // Konfiguracja typowania DRUŻYN dla tego eventu.
    //
    // Gdy admin ją zapisał, ona decyduje o zestawie faz. Gdy nie (starsze
    // turnieje), zostaje wyznaczenie po śladach w danych - inaczej event
    // sprzed tej funkcji nagle nie miałby żadnej fazy.
    const konfiguracja = await getEventPickemConfig(pool, event.guild_id, event.id);

    if (konfiguracja.skonfigurowany) {
      fazyPickem.clear();

      for (const faza of KOLEJNOSC) {
        if (konfiguracja.fazy[faza]?.enabled) fazyPickem.add(faza);
      }
    }

    // Które fazy mają opublikowany wynik i w których pytający już typował.
    const zWynikiem = new Set(
      swissZWynikiem.map((r) => r.stage).filter(Boolean),
    );
    const licznikiWynikow = inneZWynikiem[0] || {};
    if (Number(licznikiWynikow.playoffs) > 0) zWynikiem.add("playoffs");
    if (Number(licznikiWynikow.playin) > 0) zWynikiem.add("playin");
    if (Number(licznikiWynikow.doubleelim) > 0) zWynikiem.add("doubleelim");

    const mojeTypy = new Set(swissMojeTypy.map((r) => r.stage).filter(Boolean));
    const licznikiTypow = inneMojeTypy[0] || {};
    if (Number(licznikiTypow.playoffs) > 0) mojeTypy.add("playoffs");
    if (Number(licznikiTypow.playin) > 0) mojeTypy.add("playin");
    if (Number(licznikiTypow.doubleelim) > 0) mojeTypy.add("doubleelim");

    const fazaAktywna = MAPA_BIEZACEJ[biezaca] || null;

    // Typowanie drużyn jest otwarte tylko w bieżącej fazie i tylko przed
    // deadline'em - pickemGate sprawdza jedno i drugie, tak samo jak zapis.
    let typowanieOtwarte = false;

    // pickemGate pyta o AKTUALNIE OTWARTY event gildii, nie o ten z URL-a.
    // Bez tego porównania zamknięty turniej, którego faza zgadza się z fazą
    // trwającego turnieju, raportował "typowanie otwarte" i front pokazywałby
    // na historycznym evencie przycisk "Typuj teraz".
    const otwartyEventId = await getOpenEventId(pool, event.guild_id);
    const toBiezacyEvent =
      otwartyEventId && Number(otwartyEventId) === Number(event.id);

    if (toBiezacyEvent && fazaAktywna && fazyPickem.has(fazaAktywna)) {
      const rodzaj = fazaAktywna.startsWith("stage")
        ? "SWISS"
        : fazaAktywna.toUpperCase();

      const bramka = await pickemGate(
        event.guild_id,
        rodzaj,
        fazaAktywna.startsWith("stage") ? fazaAktywna : null,
      );

      typowanieOtwarte = Boolean(bramka.allowed);
    }

    const fazyZeStatusem = KOLEJNOSC.filter((faza) => fazyPickem.has(faza)).map(
      (faza) => ({
        faza,
        aktywna: faza === fazaAktywna,
        // "otwarta" = da się teraz zapisać typ. Tylko bieżąca faza i tylko
        // przed deadline'em; reszta jest do oglądania.
        otwarta: faza === fazaAktywna && typowanieOtwarte,
        wynikOpublikowany: zWynikiem.has(faza),
        mamTyp: mojeTypy.has(faza),
        limity: konfiguracja.fazy[faza]?.limity || null,
      }),
    );

    res.json({
      event,
      stats: {
        participants: uczestnicy,
        predictions: predictionStats?.predictions || 0,
        matches: matchStats?.total_matches || 0,
      },
      match_status: {
        total: statusStats?.total || 0,
        live: statusStats?.live_matches || 0,
        finished: statusStats?.finished_matches || 0,
        locked: statusStats?.locked_matches || 0,
        scheduled: statusStats?.scheduled_matches || 0,
      },
      next_match: nextMatch || null,

      phase_info: {
        current: event.phase,
        status: event.status,
        available: phaseRows.map((row) => row.phase),

        // Klucze tras frontu (stage1 / playin / playoffs / doubleelim)
        // dla faz, które ten turniej realnie ma.
        pickem: KOLEJNOSC.filter((faza) => fazyPickem.has(faza)),
      },

      // Typowanie DRUŻYN - osobny byt od typowania meczów, przypisany
      // do tego eventu. Front używa tego, żeby prowadzić gracza do fazy,
      // w której faktycznie można teraz typować.
      pickem_druzyn: {
        skonfigurowany: konfiguracja.skonfigurowany,
        faza_aktywna: fazaAktywna,
        typowanie_otwarte: typowanieOtwarte,
        fazy: fazyZeStatusem,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/events/:slug/matches", async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.session?.user?.id || null;

    const [[event]] = await pool.query(
      `
      SELECT id, name, slug, guild_id
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    // ============================================
    // MECZE
    // ============================================

    const [matches] = await pool.query(
      sqlMeczeZTypem("m.event_id = ?"),
      [userId, userId, userId, event.id],
    );

    // ============================================
    // GLOBALNY GATE
    // ============================================

    const gate = await assertPredictionsAllowed({
      guildId: event.guild_id,
      kind: "MATCHES",
    });

    const deadlineCache = new Map();

    // ============================================
    // LOCK STATE
    // ============================================

    const matchesWithPredictionState = await Promise.all(
      matches.map((match) =>
        stanTypowaniaMeczu({
          match,
          gate,
          guildId: event.guild_id,
          deadlineCache,
        }),
      ),
    );

    // ============================================
    // PROGRESS PER FAZA
    // ============================================

    const progress = {};

    for (const match of matchesWithPredictionState) {
      const phase = match.phase || "other";

      if (!progress[phase]) {
        progress[phase] = {
          total: 0,
          complete: 0,
          partial: 0,
          empty: 0,
        };
      }

      progress[phase].total += 1;

      if (match.prediction_status === "complete") {
        progress[phase].complete += 1;
      } else if (match.prediction_status === "partial") {
        progress[phase].partial += 1;
      } else {
        progress[phase].empty += 1;
      }
    }

    // ============================================
    // RESPONSE
    // ============================================

    res.json({
      event,
      matches: matchesWithPredictionState,
      progress,
    });
  } catch (err) {
    console.error("EVENT MATCHES ERROR:", err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/events/:slug/leaderboard", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
      SELECT id
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    // Klasyfikacja idzie z tabeli `leaderboard`, a nie z sumy match_points.
    //
    // Dwa powody. Po pierwsze `total_points` ma być tym samym, co pokazuje bot
    // i co ląduje w eksporcie klasyfikacji - wcześniej ten endpoint sumował
    // WYŁĄCZNIE punkty meczowe, więc strona "Ranking graczy" pomijała Swiss,
    // Playoffs, Play-In, Double Elim i MVP. Po drugie wiersze brały się z
    // `match_predictions`, przez co gracz, który typował tylko fazy Pick'Em,
    // a nie typował meczów, w ogóle nie pojawiał się w rankingu.
    //
    // Statystyki meczowe (skuteczność, trafieni zwycięzcy) zostają jako
    // uzupełnienie i są teraz doklejane LEFT JOIN-em, więc brak typów
    // meczowych daje zera zamiast wypadnięcia z listy.
    const [rows] = await pool.query(
      `
  SELECT
    lb.user_id,
    COALESCE(up.displayname, up.username, lb.user_id) AS displayname,
    up.avatar,

    COALESCE(lb.total_points, 0) AS total_points,

    COALESCE(stats.total_predictions, 0) AS total_predictions,
    COALESCE(stats.correct_winners, 0) AS correct_winners,

    -- Rozbicie sumy na fazy. Wcześniej dawał je osobny endpoint
    -- /api/public/events/:slug/leaderboard, którego front nigdy nie wołał -
    -- utrzymywaliśmy dwa rankingi, z czego jeden martwy.
    COALESCE(fazy.swiss_points, 0) AS swiss_points,
    COALESCE(fazy.playoffs_points, 0) AS playoffs_points,
    COALESCE(fazy.playin_points, 0) AS playin_points,
    COALESCE(fazy.doubleelim_points, 0) AS doubleelim_points,
    COALESCE(fazy.match_points, 0) AS match_points,
    COALESCE(fazy.mvp_points, 0) AS mvp_points

  FROM leaderboard lb

  LEFT JOIN user_profiles up
    ON up.user_id COLLATE utf8mb4_unicode_ci
     = lb.user_id COLLATE utf8mb4_unicode_ci

  LEFT JOIN (
    SELECT
      user_id,
      SUM(swiss_points) AS swiss_points,
      SUM(playoffs_points) AS playoffs_points,
      SUM(playin_points) AS playin_points,
      SUM(doubleelim_points) AS doubleelim_points,
      SUM(match_points) AS match_points,
      SUM(mvp_points) AS mvp_points
    FROM (
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id, COALESCE(points,0) swiss_points, 0 playoffs_points, 0 playin_points, 0 doubleelim_points, 0 match_points, 0 mvp_points
        FROM swiss_scores WHERE event_id = ?
      UNION ALL
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, COALESCE(points,0), 0, 0, 0, 0 FROM playoffs_scores WHERE event_id = ?
      UNION ALL
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, COALESCE(points,0), 0, 0, 0 FROM playin_scores WHERE event_id = ?
      UNION ALL
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, COALESCE(points,0), 0, 0 FROM doubleelim_scores WHERE event_id = ?
      UNION ALL
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, COALESCE(points,0), 0 FROM match_points WHERE event_id = ?
      UNION ALL
      SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, 0, 0, 0, 0, 0, COALESCE(points,0) FROM mvp_scores WHERE event_id = ?
    ) skladowe
    GROUP BY user_id
  ) fazy
    ON fazy.user_id = lb.user_id COLLATE utf8mb4_unicode_ci

  LEFT JOIN (
    SELECT
      mp.user_id,

      COUNT(DISTINCT mp.match_id) AS total_predictions,

      COUNT(
        DISTINCT CASE
          WHEN mr.match_id IS NOT NULL
           AND (
             (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
             OR
             (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
           )
          THEN mp.match_id
          ELSE NULL
        END
      ) AS correct_winners

    FROM match_predictions mp

    LEFT JOIN match_results mr
      ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    WHERE mp.event_id = ?

    GROUP BY mp.user_id
  ) stats
    ON stats.user_id COLLATE utf8mb4_unicode_ci
     = lb.user_id COLLATE utf8mb4_unicode_ci

  WHERE lb.event_id = ?

  ORDER BY
    total_points DESC,
    correct_winners DESC,
    lb.user_id ASC

  LIMIT 100
  `,
      [
        event.id, event.id, event.id, event.id, event.id, event.id,
        event.id,
        event.id,
      ],
    );
    const [pointBreakdownRows] = await pool.query(
      `
  SELECT
    user_id,
    COALESCE(
      SUM(
        CASE
          WHEN source = 'series'
          THEN points
          ELSE 0
        END
      ),
      0
    ) AS series_points,

    COALESCE(
      SUM(
        CASE
          WHEN source = 'map'
          THEN points
          ELSE 0
        END
      ),
      0
    ) AS map_points

  FROM match_points

  WHERE event_id = ?

  GROUP BY user_id
  `,
      [event.id],
    );

    const pointBreakdownByUser = new Map(
      pointBreakdownRows.map((row) => [
        String(row.user_id),
        {
          series_points: Number(row.series_points || 0),
          map_points: Number(row.map_points || 0),
        },
      ]),
    );

    const [mapStatsRows] = await pool.query(
      `
  SELECT
    mmp.user_id,

    COUNT(*) AS predicted_maps,

    SUM(
      CASE
        WHEN mmr.match_id IS NOT NULL
         AND (
          (
            mmp.pred_exact_a > mmp.pred_exact_b
            AND mmr.exact_a > mmr.exact_b
          )
          OR
          (
            mmp.pred_exact_b > mmp.pred_exact_a
            AND mmr.exact_b > mmr.exact_a
          )
         )
        THEN 1
        ELSE 0
      END
    ) AS correct_maps,

    SUM(
      CASE
        WHEN mmr.match_id IS NOT NULL
         AND mmp.pred_exact_a = mmr.exact_a
         AND mmp.pred_exact_b = mmr.exact_b
        THEN 1
        ELSE 0
      END
    ) AS exact_maps

  FROM match_map_predictions mmp

  LEFT JOIN match_map_results mmr
    ON mmr.event_id = mmp.event_id
   AND mmr.match_id = mmp.match_id
   AND mmr.map_no = mmp.map_no

  WHERE mmp.event_id = ?

  GROUP BY mmp.user_id
  `,
      [event.id],
    );

    const mapStatsByUser = new Map(
      mapStatsRows.map((row) => [
        String(row.user_id),
        {
          predicted_maps: Number(row.predicted_maps || 0),
          correct_maps: Number(row.correct_maps || 0),
          exact_maps: Number(row.exact_maps || 0),
        },
      ]),
    );

    const leaderboardData = rows.map((row) => {
      const totalPredictions = Number(row.total_predictions || 0);
      const correctWinners = Number(row.correct_winners || 0);
      const pointBreakdown = pointBreakdownByUser.get(String(row.user_id)) || {
        series_points: 0,
        map_points: 0,
      };

      const mapStats = mapStatsByUser.get(String(row.user_id)) || {
        predicted_maps: 0,
        correct_maps: 0,
        exact_maps: 0,
      };

      return {
        user_id: row.user_id,
        displayname: row.displayname,
        avatar: row.avatar,

        total_points: Number(row.total_points || 0),

        // Rozbicie na serie/mapy bierze się z match_points (pointBreakdown),
        // bo główne zapytanie zwraca już tylko sumę końcową z `leaderboard`.
        series_points: pointBreakdown.series_points,
        map_points: pointBreakdown.map_points,

        // Rozbicie na fazy turnieju.
        swiss_points: Number(row.swiss_points || 0),
        playoffs_points: Number(row.playoffs_points || 0),
        playin_points: Number(row.playin_points || 0),
        doubleelim_points: Number(row.doubleelim_points || 0),
        phase_match_points: Number(row.match_points || 0),
        mvp_points: Number(row.mvp_points || 0),

        total_predictions: totalPredictions,
        correct_winners: correctWinners,

        predicted_maps: mapStats.predicted_maps,
        correct_maps: mapStats.correct_maps,
        exact_maps: mapStats.exact_maps,

        accuracy:
          totalPredictions > 0
            ? Math.round((correctWinners / totalPredictions) * 100)
            : 0,
      };
    });

    leaderboardData.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }

      if (b.correct_winners !== a.correct_winners) {
        return b.correct_winners - a.correct_winners;
      }

      if (b.correct_maps !== a.correct_maps) {
        return b.correct_maps - a.correct_maps;
      }

      if (b.exact_maps !== a.exact_maps) {
        return b.exact_maps - a.exact_maps;
      }

      return String(a.user_id).localeCompare(String(b.user_id));
    });

    const leaderboard = leaderboardData.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

    // Ranking bierze sie z tabeli `leaderboard`, a ta zapelnia sie dopiero po
    // naliczeniu punktow. Dopoki nic nie jest rozliczone, lista jest pusta,
    // mimo ze gracze juz typuja - front musi umiec odroznic "nikt nie typowal"
    // od "typuja, ale nie ma jeszcze za co przyznac punktow".
    const uczestnicy = await policzUczestnikow(event.id);

    res.json({
      leaderboard,
      uczestnicy,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});


app.post(
  "/api/events/:slug/status",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { status } = req.body;
      const { guildId } = req;

      // The UI sends OPEN / CLOSED / ARCHIVED. ARCHIVED is not a value of
      // the events.status enum ('UPCOMING','OPEN','CLOSED','FINISHED') -
      // archiving is stored as status FINISHED + is_archived = 1, matching
      // what the end-tournament endpoint writes.
      const STATUS_ACTIONS = {
        OPEN: { status: "OPEN", is_open: 1, is_active: 1, is_archived: 0 },
        CLOSED: { status: "CLOSED", is_open: 0, is_active: 1, is_archived: 0 },
        ARCHIVED: {
          status: "FINISHED",
          is_open: 0,
          is_active: 0,
          is_archived: 1,
        },
      };

      const action = STATUS_ACTIONS[String(status || "").toUpperCase()];

      if (!action) {
        return res.status(400).json({
          error: "Nieprawidłowy status.",
          allowedStatuses: Object.keys(STATUS_ACTIONS),
        });
      }

      const [result] = await pool.query(
        `
  UPDATE events
  SET
    status = ?,
    is_open = ?,
    is_active = ?,
    is_archived = ?
  WHERE guild_id = ?
    AND slug = ?
  LIMIT 1
  `,
        [
          action.status,
          action.is_open,
          action.is_active,
          action.is_archived,
          guildId,
          slug,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }
      emitDashboardRefresh({
        slug,
        guildId,
        reason: "event_status_updated",
      });

      // Broadcast the status actually stored, not the requested action -
      // "ARCHIVED" is persisted as FINISHED + is_archived, so echoing the
      // raw input would leave every open client showing a status that
      // does not exist in the database.
      io.emit("event:status_updated", {
        slug,
        status: action.status,
        is_archived: action.is_archived,
      });

      res.json({
        ok: true,
        slug,
        status: action.status,
        is_archived: action.is_archived,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get("/api/guilds", (req, res) => {
  const user = req.session?.user;

  if (!user) {
    return res.status(401).json({ error: "Musisz być zalogowany." });
  }

  const knownGuildIds = new Set(guildRegistry.getAllGuildIds());

  const guilds = (user.guilds || [])
    .filter((g) => knownGuildIds.has(g.id) && hasAdminPermission(user, g.id))
    .map((g) => ({ id: g.id, name: g.name, role: "admin" }));

  res.json({ guilds });
});

app.get(
  "/api/guilds/:guildId/events",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;

      const [events] = await pool.query(
        `
      SELECT
  e.id,
  e.guild_id,
  e.name,
  e.slug,
  e.phase,
  e.status,
  e.is_archived,
  e.created_at,

  (
    SELECT COUNT(*)
    FROM matches m
    WHERE m.event_id = e.id
  ) AS matches_count,

  (
    SELECT COUNT(*)
    FROM match_predictions mp
    WHERE mp.event_id = e.id
  ) AS predictions_count,

  (
    SELECT COUNT(DISTINCT mp.user_id)
    FROM match_predictions mp
    WHERE mp.event_id = e.id
  ) AS participants_count

FROM events e
WHERE e.guild_id = ?
ORDER BY e.id DESC
      `,
        [guildId],
      );

      res.json({
        guildId,
        events,
        stats: {
          // events.status enum is UPPERCASE ('UPCOMING','OPEN','CLOSED',
          // 'FINISHED'); comparing against lowercase made all three
          // counters permanently 0. Archived is a flag, not a status.
          totalEvents: events.length,
          activeEvents: events.filter((e) => e.status === "OPEN").length,
          closedEvents: events.filter((e) => e.status === "CLOSED").length,
          archivedEvents: events.filter((e) => Number(e.is_archived) === 1)
            .length,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/guilds/:guildId/teams",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const includeInactive = req.query.includeInactive === "1";

      const teams = await teamsStore.listTeams(guildId, { includeInactive });

      res.json({ guildId, teams });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/guilds/:guildId/teams",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { name, shortName } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          error: "Nazwa drużyny jest wymagana.",
        });
      }

      await teamsStore.addTeam(guildId, name, { shortName: shortName || null });

      const teams = await teamsStore.listTeams(guildId, {
        includeInactive: true,
      });
      const team = teams.find(
        (t) => t.name === String(name).trim().replace(/\s+/g, " "),
      );

      res.json({ ok: true, team });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Drużyna o tej nazwie już istnieje na tym serwerze.",
        });
      }

      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.patch(
  "/api/guilds/:guildId/teams/:teamId",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId, teamId } = req.params;
      const { name, shortName, active, externalName } = req.body;

      if (name !== undefined) {
        await teamsStore.renameTeam(guildId, teamId, name, {
          shortName: shortName ?? null,
        });
      }

      // Alias nazwy u dostawcy danych. Osobno od renameTeam, bo teamsStore
      // jest współdzielony z botem, a ta kolumna dotyczy wyłącznie integracji
      // z wynikami - pusty ciąg zapisujemy jako NULL, żeby nie mieszać
      // "brak aliasu" z "alias to pusty tekst".
      if (externalName !== undefined) {
        await pool.query(
          "UPDATE teams SET external_name = ? WHERE id = ? AND guild_id = ?",
          [String(externalName).trim() || null, teamId, guildId],
        );
      }

      if (active !== undefined) {
        const teams = await teamsStore.listTeams(guildId, {
          includeInactive: true,
        });
        const current = teams.find((t) => String(t.id) === String(teamId));

        if (current && Boolean(current.active) !== Boolean(active)) {
          await teamsStore.toggleTeamActive(guildId, teamId);
        }
      }

      const teams = await teamsStore.listTeams(guildId, {
        includeInactive: true,
      });
      const team = teams.find((t) => String(t.id) === String(teamId));

      if (!team) {
        return res.status(404).json({ error: "Nie znaleziono drużyny." });
      }

      res.json({ ok: true, team });
    } catch (err) {
      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Drużyna o tej nazwie już istnieje na tym serwerze.",
        });
      }

      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.delete(
  "/api/guilds/:guildId/teams/:teamId",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId, teamId } = req.params;

      const teams = await teamsStore.listTeams(guildId, {
        includeInactive: true,
      });
      const team = teams.find((t) => String(t.id) === String(teamId));

      if (!team) {
        return res.status(404).json({ error: "Nie znaleziono drużyny." });
      }

      const [[usage]] = await pool.query(
        `
            SELECT COUNT(*) AS count
            FROM matches
            WHERE guild_id = ?
              AND (team_a = ? OR team_b = ?)
            `,
        [guildId, team.name, team.name],
      );

      if (usage.count > 0) {
        return res.status(409).json({
          error: `Cannot delete "${team.name}" - it is referenced by ${usage.count} match(es). Deactivate it instead.`,
        });
      }

      await teamsStore.deleteTeams(guildId, [teamId]);

      res.json({ ok: true, deletedId: Number(teamId) });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/guilds/:guildId/teams/import",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const jsonText = String(req.body.jsonText ?? "");

      let count;

      try {
        count = await teamsStore.importTeamsFromJsonText(guildId, jsonText);
      } catch (err) {
        if (err.message === "INVALID_JSON") {
          return res.status(400).json({
            error:
              'Invalid JSON - expected an array of team name strings, e.g. ["FaZe","NAVI","G2"]',
          });
        }

        throw err;
      }

      const teams = await teamsStore.listTeams(guildId, {
        includeInactive: true,
      });

      res.json({ ok: true, count, teams });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/guilds/:guildId/deadline",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { phase, stage } = req.query;

      if (!VALID_PHASES.includes(phase)) {
        return res.status(400).json({
          error: `phase must be one of: ${VALID_PHASES.join(", ")}`,
        });
      }

      if (phase === "swiss" && !stage) {
        return res.status(400).json({
          error: "Dla fazy Swiss wymagany jest etap (1, 2 albo 3).",
        });
      }

      const lookup = await findPanelForDeadline(
        pool,
        guildId,
        phase,
        stage,
      );

      if (lookup.error) {
        return res.status(400).json({
          error: lookup.error,
        });
      }

      return res.json({
        ok: true,
        deadline: lookup.row?.deadline ?? null,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/guilds/:guildId/deadline",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { phase, data, stage } = req.body;

      if (!VALID_PHASES.includes(phase)) {
        return res
          .status(400)
          .json({ error: `phase must be one of: ${VALID_PHASES.join(", ")}` });
      }

      if (phase === "swiss" && !stage) {
        return res.status(400).json({
          error: "Dla fazy Swiss wymagany jest etap (1, 2 albo 3).",
        });
      }

      const parsed = parseDeadlineInput(data);

      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }

      const lookup = await findPanelForDeadline(pool, guildId, phase, stage);

      if (lookup.error) {
        return res.status(400).json({ error: lookup.error });
      }

      if (!lookup.row) {
        return res.status(404).json({
          error: `No active panel found for phase "${lookup.lookupPhase}"${lookup.lookupStageKey ? ` / stage "${lookup.lookupStageKey}"` : ""}`,
        });
      }

      await pool.query(
        "UPDATE active_panels SET deadline = ?, reminded = 0 WHERE id = ?",
        [parsed.utcDate, lookup.row.id],
      );

      res.json({ ok: true, deadline: parsed.utcDate });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.delete(
  "/api/guilds/:guildId/deadline",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { phase, stage } = req.body ?? {};

      if (!VALID_PHASES.includes(phase)) {
        return res.status(400).json({
          error: `phase must be one of: ${VALID_PHASES.join(", ")}`,
        });
      }

      let result;

      if (phase === "swiss") {
        const stageNumber = String(stage || "").match(/\d+/)?.[0];

        if (!stageNumber) {
          return res.status(400).json({
            error: "Dla fazy Swiss wymagany jest etap.",
          });
        }

        const dbPhase = `swiss_stage${stageNumber}`;
        const stageKey = `stage${stageNumber}`;

        [result] = await pool.query(
          `
          UPDATE active_panels
          SET deadline = NULL,
              reminded = 0
          WHERE guild_id = ?
            AND phase = ?
            AND stage_key = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [guildId, dbPhase, stageKey],
        );
      } else {
        [result] = await pool.query(
          `
          UPDATE active_panels
          SET deadline = NULL,
              reminded = 0
          WHERE guild_id = ?
            AND phase = ?
          ORDER BY id DESC
          LIMIT 1
          `,
          [guildId, phase],
        );
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "No panel found for this phase.",
        });
      }

      return res.json({
        ok: true,
        deadline: null,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/guilds/:guildId/match-deadline",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { phase, data } = req.body;

      if (!VALID_PHASES.includes(phase)) {
        return res
          .status(400)
          .json({ error: `phase must be one of: ${VALID_PHASES.join(", ")}` });
      }

      const parsed = parseDeadlineInput(data);

      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }

      const lookup = await findPanelForMatchDeadline(pool, guildId, phase);

      if (!lookup.row) {
        return res
          .status(404)
          .json({ error: `No active panel found for phase "${phase}"` });
      }

      await pool.query(
        "UPDATE active_panels SET match_deadline = ? WHERE id = ?",
        [parsed.utcDate, lookup.row.id],
      );

      res.json({ ok: true, matchDeadline: parsed.utcDate });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/guilds/:guildId/teams/reorder",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds) || !orderedIds.length) {
        return res.status(400).json({
          error: "orderedIds musi być niepustą tablicą.",
        });
      }

      await teamsStore.reorderTeams(guildId, orderedIds);

      const teams = await teamsStore.listTeams(guildId, {
        includeInactive: true,
      });

      res.json({ ok: true, teams });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

function getPublicCountdown(startTimeUtc) {
  if (!startTimeUtc) return "TBA";

  const target = new Date(startTimeUtc).getTime();
  const diff = target - Date.now();

  if (diff <= 0) return "LIVE";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours <= 0) return `${minutes}m`;

  return `${hours}h ${minutes}m`;
}

function formatPublicDate(startTimeUtc) {
  if (!startTimeUtc) return "Start time TBA";

  return new Date(startTimeUtc).toISOString();
}

function getPublicMatchStatus(match) {
  if (Number(match.is_locked) === 1) {
    return "LOCKED";
  }

  const startTime = match.start_time_utc
    ? new Date(match.start_time_utc).getTime()
    : null;

  if (startTime && startTime <= Date.now()) {
    return "LIVE";
  }

  return "OPEN";
}

function buildPublicMatch(match) {
  let uiStatus = getPublicMatchStatus(match);

  if (match.live_status === "FINAL") {
    uiStatus = "FINAL";
  } else if (Number(match.score_a || 0) > 0 || Number(match.score_b || 0) > 0) {
    uiStatus = "LIVE";
  }

  return {
    id: match.id,
    phase: match.phase,
    match_no: match.match_no,
    team_a: match.team_a,
    team_b: match.team_b,
    best_of: match.best_of,

    score_a: Number(match.score_a || 0),
    score_b: Number(match.score_b || 0),

    current_map: match.current_map || 1,
    live_status: match.live_status || null,

    start_time_utc: match.start_time_utc,
    formatted_time: formatPublicDate(match.start_time_utc),
    countdown: getPublicCountdown(match.start_time_utc),

    is_locked: Number(match.is_locked) === 1,
    ui_status: uiStatus,
  };
}

// ======================================================
// PUBLICZNA LISTA EVENTOW - AKTYWNE I ZAKONCZONE
// ======================================================
//
// /api/events/active filtruje `is_active = 1 AND is_archived = 0`, wiec
// zamkniety albo zarchiwizowany turniej wypadal z jedynej listy, jaka miala
// strona. Same podstrony eventu dzialaly dalej (mecze, ranking, statystyki),
// ale nie bylo do nich z UI zadnego linku - dane istnialy bez drogi dojscia.
//
// Ten endpoint nie filtruje po stanie: zwraca wszystko, oznaczajac czy event
// jest otwarty na typowanie. Podzial na sekcje robi frontend.
app.get("/api/public/events", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        e.id,
        e.guild_id,
        e.name,
        e.slug,
        e.phase,
        e.status,
        e.is_open,
        e.is_active,
        e.is_archived,
        e.created_at,

        (e.status = 'OPEN' AND e.is_open = 1 AND e.is_active = 1) AS is_live,

        (
          SELECT COUNT(*)
          FROM matches m
          WHERE m.event_id = e.id
        ) AS matches_count,

        (
          SELECT COUNT(DISTINCT lb.user_id)
          FROM leaderboard lb
          WHERE lb.event_id = e.id
        ) AS participants

      FROM events e
      ORDER BY e.id DESC
      `,
    );

    return res.json({
      events: rows.map((row) => ({
        id: Number(row.id),
        guild_id: row.guild_id,
        name: row.name,
        slug: row.slug,
        phase: row.phase,
        status: row.status,
        is_live: Boolean(Number(row.is_live)),
        is_archived: Boolean(Number(row.is_archived)),
        matches_count: Number(row.matches_count || 0),
        participants: Number(row.participants || 0),
        created_at: row.created_at,
        guild: getKnownGuildInfo(row.guild_id),
      })),
    });
  } catch (err) {
    console.error("PUBLIC EVENTS ERROR:", err);

    return res.status(500).json({
      error: "Nie udalo sie pobrac listy turniejow.",
    });
  }
});

// ======================================================
// PUBLICZNE WYNIKI FAZY + TYP GRACZA
// ======================================================
//
// Wszystkie GET-y z wynikami faz (/api/events/:slug/{swiss,playoffs,playin,
// doubleelim}-results) sa za requireGuildAdmin, wiec po zamknieciu fazy gracz
// nie mial gdzie zobaczyc oficjalnego wyniku ani tego, czy trafil. Widzial
// wylacznie swoj zapisany typ.
//
// Jeden endpoint na wszystkie fazy zamiast czterech blizniaczych - ksztalt
// odpowiedzi jest wspolny: oficjalny wynik, typ gracza, punkty.
const PHASE_RESULT_KINDS = {
  stage1: "swiss",
  stage2: "swiss",
  stage3: "swiss",
  playoffs: "playoffs",
  playin: "playin",
  doubleelim: "doubleelim",
};

// Typy trzymane sa jako tekst "A, B, C" - ta sama normalizacja co w
// calculateScores (cleanList), zeby trafienia liczyly sie identycznie.
function splitTeamList(value) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // zwykly CSV
  }

  return String(value)
    .replace(/[[\]"]+/g, "")
    .split(/[;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

app.get("/api/public/events/:slug/phase-results/:phase", async (req, res) => {
  try {
    const { slug, phase } = req.params;
    const userId = req.session?.user?.id || null;

    const kind = PHASE_RESULT_KINDS[phase];

    if (!kind) {
      return res.status(400).json({
        error: "Nieznana faza turnieju.",
      });
    }

    const [[event]] = await pool.query(
      "SELECT id, guild_id, name, slug FROM events WHERE slug = ? LIMIT 1",
      [slug],
    );

    if (!event) {
      return res.status(404).json({ error: "Nie znaleziono turnieju." });
    }

    // Typ i punkty sa prywatne - pokazujemy je wylacznie zalogowanemu
    // czlonkowi tej gildii. Sam oficjalny wynik jest publiczny.
    const czlonek = Boolean(
      userId && isGuildMember(req.session.user, event.guild_id),
    );

    let results = null;
    let prediction = null;
    let points = null;

    if (kind === "swiss") {
      const [[row]] = await pool.query(
        `SELECT correct_3_0, correct_0_3, correct_advancing
           FROM swiss_results
          WHERE guild_id = ? AND event_id = ? AND stage = ? AND active = 1
          ORDER BY id DESC LIMIT 1`,
        [event.guild_id, event.id, phase],
      );

      if (row) {
        results = {
          three_zero: splitTeamList(row.correct_3_0),
          zero_three: splitTeamList(row.correct_0_3),
          advancing: splitTeamList(row.correct_advancing),
        };
      }

      if (czlonek) {
        const [[pred]] = await pool.query(
          `SELECT pick_3_0, pick_0_3, advancing
             FROM swiss_predictions
            WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
            LIMIT 1`,
          [event.guild_id, event.id, userId, phase],
        );

        if (pred) {
          prediction = {
            three_zero: splitTeamList(pred.pick_3_0),
            zero_three: splitTeamList(pred.pick_0_3),
            advancing: splitTeamList(pred.advancing),
          };
        }

        const [[score]] = await pool.query(
          `SELECT points FROM swiss_scores
            WHERE guild_id = ? AND event_id = ? AND user_id = ? AND stage = ?
            LIMIT 1`,
          [event.guild_id, event.id, userId, phase],
        );

        if (score) points = Number(score.points || 0);
      }
    }

    if (kind === "playoffs") {
      const [[row]] = await pool.query(
        `SELECT correct_semifinalists, correct_finalists, correct_winner,
                correct_third_place_winner
           FROM playoffs_results
          WHERE guild_id = ? AND event_id = ? AND active = 1
          ORDER BY id DESC LIMIT 1`,
        [event.guild_id, event.id],
      );

      if (row) {
        results = {
          semifinalists: splitTeamList(row.correct_semifinalists),
          finalists: splitTeamList(row.correct_finalists),
          winner: row.correct_winner || null,
          third_place_winner: row.correct_third_place_winner || null,
        };
      }

      if (czlonek) {
        const [[pred]] = await pool.query(
          `SELECT semifinalists, finalists, winner, third_place_winner
             FROM playoffs_predictions
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (pred) {
          prediction = {
            semifinalists: splitTeamList(pred.semifinalists),
            finalists: splitTeamList(pred.finalists),
            winner: pred.winner || null,
            third_place_winner: pred.third_place_winner || null,
          };
        }

        const [[score]] = await pool.query(
          `SELECT points FROM playoffs_scores
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (score) points = Number(score.points || 0);
      }
    }

    if (kind === "playin") {
      const [[row]] = await pool.query(
        `SELECT correct_teams FROM playin_results
          WHERE guild_id = ? AND event_id = ? AND active = 1
          ORDER BY id DESC LIMIT 1`,
        [event.guild_id, event.id],
      );

      if (row) results = { teams: splitTeamList(row.correct_teams) };

      if (czlonek) {
        const [[pred]] = await pool.query(
          `SELECT teams FROM playin_predictions
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (pred) prediction = { teams: splitTeamList(pred.teams) };

        const [[score]] = await pool.query(
          `SELECT points FROM playin_scores
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (score) points = Number(score.points || 0);
      }
    }

    if (kind === "doubleelim") {
      const [[row]] = await pool.query(
        `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
           FROM doubleelim_results
          WHERE guild_id = ? AND event_id = ? AND active = 1
          ORDER BY id DESC LIMIT 1`,
        [event.guild_id, event.id],
      );

      if (row) {
        results = {
          upper_final_a: splitTeamList(row.upper_final_a),
          lower_final_a: splitTeamList(row.lower_final_a),
          upper_final_b: splitTeamList(row.upper_final_b),
          lower_final_b: splitTeamList(row.lower_final_b),
        };
      }

      if (czlonek) {
        const [[pred]] = await pool.query(
          `SELECT upper_final_a, lower_final_a, upper_final_b, lower_final_b
             FROM doubleelim_predictions
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (pred) {
          prediction = {
            upper_final_a: splitTeamList(pred.upper_final_a),
            lower_final_a: splitTeamList(pred.lower_final_a),
            upper_final_b: splitTeamList(pred.upper_final_b),
            lower_final_b: splitTeamList(pred.lower_final_b),
          };
        }

        const [[score]] = await pool.query(
          `SELECT points FROM doubleelim_scores
            WHERE guild_id = ? AND event_id = ? AND user_id = ? LIMIT 1`,
          [event.guild_id, event.id, userId],
        );

        if (score) points = Number(score.points || 0);
      }
    }

    return res.json({
      event: { id: event.id, name: event.name, slug: event.slug },
      phase,
      kind,
      published: Boolean(results),
      results,
      prediction,
      points,
    });
  } catch (err) {
    console.error("PHASE RESULTS ERROR:", err);

    return res.status(500).json({
      error: "Nie udalo sie pobrac wynikow fazy.",
    });
  }
});

// ======================================================
// KONFIGURACJA TYPOWANIA DRUŻYN DLA EVENTU
// ======================================================
//
// Typowanie drużyn jest osobnym bytem od typowania meczów i - tak jak mecze,
// deadline'y i ranking - należy do konkretnego eventu. Tutaj admin ustala,
// które fazy ten turniej ma i ile drużyn wchodzi w każdą kategorię.
//
// Brak zapisanej konfiguracji = wartości domyślne, więc turnieje sprzed tej
// funkcji działają dalej bez żadnej migracji danych.
// Które fazy typowania drużyn są już zamrożone dla danego eventu.
//
// Limity fazy wolno zmieniać tylko dopóki nikt nie oddał w niej typu i nie ma
// wpisanego wyniku. Później zapisane typy były sprawdzane wobec INNYCH liczb -
// zmiana limitu nie unieważnia ich ani nie przelicza, tylko sprawia, że turniej
// przestaje się zgadzać sam ze sobą, a strony faz pokazują historię, której
// nigdy nie było.
//
// Zakończony lub zarchiwizowany event jest zamrożony w całości, także w fazach,
// w których nikt nie typował - inaczej dałoby się zmienić opis formatu
// rozegranego turnieju.
async function zamrozoneFazy(eventId) {
  const [[event]] = await pool.query(
    "SELECT status, is_archived FROM events WHERE id = ? LIMIT 1",
    [eventId],
  );

  const poEvencie =
    String(event?.status || "").toUpperCase() === "FINISHED" ||
    Number(event?.is_archived) === 1;

  if (poEvencie) {
    return Object.fromEntries(
      FAZY_PICKEM.map((faza) => [faza, "event zakończony"]),
    );
  }

  const [[swissStages], [inne]] = await Promise.all([
    pool
      .query(
        `
        SELECT DISTINCT stage FROM swiss_predictions
         WHERE event_id = ? AND stage IS NOT NULL
        UNION
        SELECT DISTINCT stage FROM swiss_results
         WHERE event_id = ? AND stage IS NOT NULL
        `,
        [eventId, eventId],
      )
      .then(([rows]) => [rows]),
    pool
      .query(
        `
        SELECT
          (SELECT COUNT(*) FROM playoffs_predictions WHERE event_id = ?)
        + (SELECT COUNT(*) FROM playoffs_results     WHERE event_id = ?) AS playoffs,
          (SELECT COUNT(*) FROM playin_predictions   WHERE event_id = ?)
        + (SELECT COUNT(*) FROM playin_results       WHERE event_id = ?) AS playin,
          (SELECT COUNT(*) FROM doubleelim_predictions WHERE event_id = ?)
        + (SELECT COUNT(*) FROM doubleelim_results     WHERE event_id = ?) AS doubleelim
        `,
        [eventId, eventId, eventId, eventId, eventId, eventId],
      )
      .then(([rows]) => [rows[0]]),
  ]);

  const zamrozone = {};

  // normalizePhase() zwraca 'SWISS_STAGE1', a konfiguracja kluczuje po
  // 'stage1' - bez tego przełożenia żaden etap Swiss nigdy by nie trafił.
  const KLUCZ_ETAPU = {
    SWISS_STAGE1: "stage1",
    SWISS_STAGE2: "stage2",
    SWISS_STAGE3: "stage3",
  };

  for (const wiersz of swissStages || []) {
    const faza = KLUCZ_ETAPU[normalizePhase(wiersz.stage)];

    if (faza) {
      zamrozone[faza] = "są już typy lub wynik";
    }
  }

  for (const faza of ["playoffs", "playin", "doubleelim"]) {
    if (Number(inne?.[faza] || 0) > 0) {
      zamrozone[faza] = "są już typy lub wynik";
    }
  }

  return zamrozone;
}

app.get(
  "/api/events/:slug/pickem-config",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id, name FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, req.params.slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const konfiguracja = await getEventPickemConfig(pool, guildId, event.id);
      const zamrozone = await zamrozoneFazy(event.id);

      return res.json({
        event: { id: event.id, name: event.name },
        skonfigurowany: konfiguracja.skonfigurowany,
        fazy: FAZY_PICKEM.map((faza) => ({
          faza,
          enabled: konfiguracja.fazy[faza].enabled,
          limity: konfiguracja.fazy[faza].limity,
          zamrozona: Boolean(zamrozone[faza]),
          powodZamrozenia: zamrozone[faza] || null,
        })),
      });
    } catch (err) {
      console.error("PICKEM CONFIG GET:", err);
      return res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.put(
  "/api/events/:slug/pickem-config",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { guildId } = req;
      const { fazy } = req.body || {};

      if (!Array.isArray(fazy) || !fazy.length) {
        return res
          .status(400)
          .json({ error: "fazy musi być niepustą tablicą." });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, req.params.slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // API i panel mówią o fazie "faza", moduł konfiguracji - "phase".
      // Bez tego mapowania wpisy były po cichu pomijane (jestFaza(undefined)
      // zwraca false), endpoint odpowiadał 200, a nic się nie zapisywało.
      const doZapisu = fazy.map((wpis) => ({
        phase: wpis?.phase ?? wpis?.faza,
        enabled: Boolean(wpis?.enabled),
        limity: wpis?.limity,
      }));

      const nieznane = doZapisu.filter((w) => !FAZY_PICKEM.includes(w.phase));

      if (nieznane.length) {
        return res.status(400).json({
          error: `Nieznane fazy: ${nieznane.map((w) => w.phase).join(", ")}`,
        });
      }

      // Zamrożonej fazy nie wolno przestawić - zapisane typy były sprawdzane
      // wobec innych liczb, a zakończony turniej musi zostać opisany tak, jak
      // faktycznie został rozegrany.
      const zamrozone = await zamrozoneFazy(event.id);
      const biezaca = await getEventPickemConfig(pool, guildId, event.id);

      const naruszenia = doZapisu.filter((wpis) => {
        if (!zamrozone[wpis.phase]) return false;

        const stare = biezaca.fazy[wpis.phase];

        if (Boolean(stare.enabled) !== Boolean(wpis.enabled)) return true;

        return Object.entries(stare.limity || {}).some(
          ([grupa, wartosc]) =>
            Number(wpis.limity?.[grupa] ?? wartosc) !== Number(wartosc),
        );
      });

      if (naruszenia.length) {
        return res.status(409).json({
          error:
            "Nie można zmienić tych faz: " +
            naruszenia
              .map((w) => `${w.phase} (${zamrozone[w.phase]})`)
              .join(", ") +
            ".",
          zamrozone: naruszenia.map((w) => w.phase),
        });
      }

      await setEventPickemConfig(pool, guildId, event.id, doZapisu);

      const konfiguracja = await getEventPickemConfig(pool, guildId, event.id);

      logInfo("pickem", "Event pickem config saved", {
        guildId,
        eventId: event.id,
        by: req.session?.user?.id,
        extra: {
          wlaczone: FAZY_PICKEM.filter((f) => konfiguracja.fazy[f].enabled),
        },
      });

      emitDashboardRefresh({
        slug: req.params.slug,
        guildId,
        reason: "pickem_config_updated",
      });

      const poZapisie = await zamrozoneFazy(event.id);

      return res.json({
        ok: true,
        fazy: FAZY_PICKEM.map((faza) => ({
          faza,
          enabled: konfiguracja.fazy[faza].enabled,
          limity: konfiguracja.fazy[faza].limity,
          zamrozona: Boolean(poZapisie[faza]),
          powodZamrozenia: poZapisie[faza] || null,
        })),
      });
    } catch (err) {
      console.error("PICKEM CONFIG PUT:", err);
      return res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.get("/api/public/archives", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
            SELECT
                id,
                guild_id,
                filename,
                created_at
            FROM archive_files
            ORDER BY created_at DESC
            `,
    );

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się wczytać archiwum.",
    });
  }
});

// Guild display name/slug/invite come from config/*.env (GUILD_NAME, GUILD_SLUG,
// DISCORD_INVITE_URL) - the same files guildRegistry already loads for DB credentials.
// A guild with no config file (shouldn't happen, but defensive) falls back to its
// raw guild_id and no invite link rather than showing wrong info.
function getKnownGuildInfo(guildId) {
  const cfg = guildRegistry.getGuildConfig(guildId);

  return {
    slug: cfg?.GUILD_SLUG || guildId,
    name: cfg?.GUILD_NAME || guildId,
    discord_url: cfg?.DISCORD_INVITE_URL || null,
  };
}

// Resolves a URL slug (e.g. "hyperland") back to a guild_id by checking every
// known guild's GUILD_SLUG. Falls back to treating the slug as a raw guild_id
// directly, since /public/:guildSlug already supports that for guilds without
// a configured vanity slug.
function resolveGuildIdFromSlug(guildSlug) {
  for (const id of guildRegistry.getAllGuildIds()) {
    const cfg = guildRegistry.getGuildConfig(id);
    if (cfg?.GUILD_SLUG === guildSlug) return id;
  }

  return guildSlug;
}

app.get("/api/public/servers", async (req, res) => {
  try {
    const [servers] = await pool.query(
      `
    SELECT
        e.guild_id,
        COUNT(*) AS events_count,
        SUM(e.status = 'OPEN') AS open_events
    FROM events e
    WHERE e.guild_id IS NOT NULL
    GROUP BY e.guild_id
    ORDER BY events_count DESC
    `,
    );

    const [featuredEvents] = await pool.query(
      `
    SELECT
        e.id,
        e.name,
        e.slug,
        e.phase,
        e.status,
        e.guild_id
    FROM events e
    ORDER BY e.id DESC
    LIMIT 6
    `,
    );

    res.json({
      servers: servers.map((server) => {
        const known = getKnownGuildInfo(server.guild_id);

        return {
          guild_id: server.guild_id,
          name: known.name,
          slug: known.slug,
          events_count: Number(server.events_count || 0),
          open_events: Number(server.open_events || 0),
          discord_url: known.discord_url,
        };
      }),
      featured_events: featuredEvents,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/public/:guildSlug", async (req, res) => {
  try {
    const { guildSlug } = req.params;

    const guildId = resolveGuildIdFromSlug(guildSlug);
    const known = getKnownGuildInfo(guildId);

    const [events] = await pool.query(
      `
            SELECT
                id,
                name,
                slug,
                phase,
                status
            FROM events
            WHERE guild_id = ?
            ORDER BY id DESC
            LIMIT 12
            `,
      [guildId],
    );

    const [[stats]] = await pool.query(
      `
    SELECT
        COUNT(DISTINCT e.id) AS events_count,
        COUNT(DISTINCT mp.user_id) AS participants,
        COUNT(mp.user_id) AS predictions
    FROM events e
    LEFT JOIN match_predictions mp
        ON mp.event_id = e.id
    WHERE e.guild_id = ?
    `,
      [guildId],
    );

    const [topPlayers] = await pool.query(
      `
    SELECT
        lb.user_id,
        SUM(lb.total_points) AS total_points
    FROM leaderboard lb
    JOIN events e
        ON e.id = lb.event_id
    WHERE e.guild_id = ?
    GROUP BY lb.user_id
    ORDER BY total_points DESC
    LIMIT 5
    `,
      [guildId],
    );

    const featuredEvent =
      events.find((e) => e.status === "OPEN") || events[0] || null;

    res.json({
      guild: {
        guild_id: guildId,
        slug: known.slug,
        name: known.name,
        discord_url: known.discord_url,
      },
      stats: {
        events: Number(stats?.events_count || 0),
        participants: Number(stats?.participants || 0),
        predictions: Number(stats?.predictions || 0),
      },
      top_players: topPlayers,
      featured_event: featuredEvent,
      events,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Błąd bazy danych." });
  }
});

app.get("/api/public/:slug/overview", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
      SELECT
  id,
  guild_id,
  name,
  slug,
  phase,
  status
FROM events
WHERE slug = ?
LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const [leaderboard] = await pool.query(
      `
  SELECT
    user_id,
    total_points
  FROM leaderboard
  WHERE event_id = ?
  ORDER BY total_points DESC
  LIMIT 10
  `,
      [event.id],
    );

    const [matches] = await pool.query(
      `
  SELECT
  m.id,
  m.phase,
  m.match_no,
  m.team_a,
  m.team_b,
  m.best_of,
  m.start_time_utc,
  m.is_locked,

  COALESCE(lms.score_a, 0) AS score_a,
  COALESCE(lms.score_b, 0) AS score_b,
  lms.current_map,
  lms.status AS live_status,

  CASE
    WHEN m.is_locked = 1 THEN 'LOCKED'
    ELSE 'OPEN'
  END AS ui_status

FROM matches m
LEFT JOIN live_match_scores lms
  ON lms.match_id = m.id
WHERE m.event_id = ?
ORDER BY m.match_no ASC, m.id ASC
LIMIT 8
  `,
      [event.id],
    );

    const [[stats]] = await pool.query(
      `
  SELECT
    COUNT(*) AS matches
  FROM matches
  WHERE event_id = ?
  `,
      [event.id],
    );

    const [[predictionStats]] = await pool.query(
      `
  SELECT
    COUNT(DISTINCT user_id) AS participants,
    COUNT(*) AS predictions
  FROM match_predictions
  WHERE event_id = ?
  `,
      [event.id],
    );

    const publicMatches = matches.map(buildPublicMatch);

    const featuredMatch =
      publicMatches.find((match) => match.ui_status === "LIVE") ||
      publicMatches.find((match) => match.ui_status === "OPEN") ||
      publicMatches[0] ||
      null;

    res.json({
      event,
      // Zaproszenie na Discorda bierze się z configu gildii, a nie ze
      // stałej w kodzie. Gildie bez DISCORD_INVITE_URL dostają null i
      // front po prostu nie rysuje przycisku - lepiej nie pokazać nic
      // niż pokazać link prowadzący donikąd.
      guild: getKnownGuildInfo(event.guild_id),
      stats: {
        participants: predictionStats?.participants || 0,
        predictions: predictionStats?.predictions || 0,
        matches: stats?.matches || 0,
        phase: event.phase,
      },
      leaderboard,
      featured_match: featuredMatch,
      matches: publicMatches,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/guilds/:guildId/meta", async (req, res) => {
  try {
    const { guildId } = req.params;

    res.json({
      guild: {
        id: guildId,
        name: "Hyperland",
        icon: null,
        description: "Competitive CS Pick'Em Community",
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.post(
  "/api/guilds/:guildId/events",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;
      const { name, slug } = req.body;

      if (!name || !slug) {
        return res.status(400).json({
          error: "Name and slug are required",
        });
      }

      // Nowy event powstaje jako UPCOMING / is_open = 0 / is_active = 0 -
      // dokładnie tak jak w /start_pickem na Discordzie, gdzie event staje
      // się aktywny dopiero po opublikowaniu panelu. Świadomie NIE otwieramy
      // go od razu: getOpenEventId() bierze najnowszy otwarty event, więc
      // utworzenie kolejnego przejęłoby trwający turniej.
      //
      // Wcześniej ten INSERT w ogóle nie wymieniał is_open / is_active
      // (kolumna is_open ma DEFAULT 0), ale odpowiadał status: "OPEN".
      // Panel pokazywał więc event jako otwarty, podczas gdy dla całego
      // typowania - i na Discordzie, i na WWW - on nie istniał, i nic nie
      // wskazywało przyczyny. Teraz stan jest jawny i zwracany zgodnie z
      // prawdą; otwarcie eventu robi się przyciskiem (POST .../status).
      const [result] = await pool.query(
        `
      INSERT INTO events (
        guild_id,
        name,
        slug,
        phase,
        status,
        is_open,
        is_active,
        is_archived
      )
      VALUES (?, ?, ?, 'NOT_STARTED', 'UPCOMING', 0, 0, 0)
      `,
        [guildId, name, slug],
      );

      res.json({
        ok: true,
        event: {
          id: result.insertId,
          guild_id: guildId,
          name,
          slug,
          phase: "NOT_STARTED",
          status: "UPCOMING",
          is_open: 0,
          is_active: 0,
        },
        // Dla UI: event trzeba jeszcze otworzyć, żeby przyjmował typy.
        wymagaOtwarcia: true,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// Hurtowe tworzenie meczów z wklejonej listy. Pojedynczy modal to najdroższa
// czynność przy stawianiu turnieju - IEM Cologne 2026 ma 106 meczów.
//
// dryRun pozwala zobaczyć, co się utworzy i co zostanie odrzucone, ZANIM
// cokolwiek trafi do bazy. Sam zapis idzie w transakcji: albo powstają
// wszystkie mecze, albo żaden - połowicznie utworzona faza byłaby gorsza od
// braku, bo trzeba by ją rozpoznawać ręcznie.
app.post(
  "/api/guilds/:guildId/events/:slug/matches/bulk",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId, slug } = req.params;
      const { phase, text, defaultBestOf = 3, dryRun = false } = req.body || {};

      if (!phase || !String(text || "").trim()) {
        return res
          .status(400)
          .json({ error: "Wymagane: faza i lista meczów." });
      }

      if (![1, 3, 5].includes(Number(defaultBestOf))) {
        return res
          .status(400)
          .json({ error: "Domyślne BO musi wynosić 1, 3 albo 5." });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

      const { mecze, bledy, duplikaty } = parseMatchList(text, {
        domyslneBo: Number(defaultBestOf),
      });

      // Ta sama walidacja co przy pojedynczym meczu: drużyna musi istnieć i
      // być aktywna. Nie luzujemy jej dla wygody, bo matches.team_a to zwykły
      // varchar - literówka przeszłaby do bazy i rozjechała dopasowywanie
      // wyników oraz typy graczy.
      const [aktywne] = await pool.query(
        "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
        [guildId],
      );

      const znane = new Map(aktywne.map((t) => [t.name.toLowerCase(), t.name]));
      const nieznane = new Set();
      const doUtworzenia = [];

      for (const m of mecze) {
        const a = znane.get(m.teamA.toLowerCase());
        const b = znane.get(m.teamB.toLowerCase());

        if (!a) nieznane.add(m.teamA);
        if (!b) nieznane.add(m.teamB);

        if (a && b) {
          // Zapisujemy nazwę w brzmieniu z tabeli teams, a nie tak, jak
          // admin ją wkleił - inaczej "navi" i "NAVI" żyłyby obok siebie.
          doUtworzenia.push({ ...m, teamA: a, teamB: b });
        }
      }

      const podsumowanie = {
        rozpoznanych: mecze.length,
        doUtworzenia: doUtworzenia.length,
        bledy,
        duplikaty,
        nieznaneDruzyny: [...nieznane],
        podglad: doUtworzenia.slice(0, 200),
      };

      if (nieznane.size) {
        podsumowanie.wskazowka =
          aktywne.length === 0
            ? "Ten serwer nie ma ani jednej aktywnej drużyny. Dodaj je najpierw na stronie Drużyny (jest tam import z JSON)."
            : "Drużyny muszą istnieć i być aktywne. Dodaj brakujące na stronie Drużyny albo popraw nazwy w liście.";
      }

      if (dryRun) {
        return res.json({ ok: true, dryRun: true, ...podsumowanie });
      }

      if (!doUtworzenia.length) {
        return res.status(400).json({
          error: "Nie ma czego utworzyć — żadna linia nie przeszła walidacji.",
          ...podsumowanie,
        });
      }

      const [[next]] = await pool.query(
        `SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
               FROM matches WHERE guild_id = ? AND event_id = ? AND phase = ?`,
        [guildId, event.id, phase],
      );

      let numer = Number(next.nextNo);

      const utworzone = await runInTransaction(pool, async (conn) => {
        const lista = [];

        for (const m of doUtworzenia) {
          const [wynik] = await conn.query(
            `INSERT INTO matches
                        (guild_id, event_id, phase, match_no, team_a, team_b, best_of, is_locked)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
            [guildId, event.id, phase, numer, m.teamA, m.teamB, m.bestOf],
          );

          lista.push({ id: wynik.insertId, matchNo: numer, ...m });
          numer++;
        }

        return lista;
      });

      logInfo("matches", "Bulk match creation", {
        guildId,
        slug,
        phase,
        utworzonych: utworzone.length,
        odrzuconych: bledy.length,
        by: req.session?.user?.id,
      });

      io.emit("dashboard:refresh", { slug });

      res.json({ ok: true, utworzone, ...podsumowanie });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się utworzyć meczów." });
    }
  },
);

app.post(
  "/api/guilds/:guildId/events/:slug/matches",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId, slug } = req.params;
      const { phase, teamA, teamB, bestOf, startTimeUtc } = req.body;

      if (!phase || !teamA || !teamB || ![1, 3, 5].includes(Number(bestOf))) {
        return res.status(400).json({
          error:
            "phase, teamA, teamB and a valid bestOf (1, 3 or 5) are required",
        });
      }

      if (teamA === teamB) {
        return res.status(400).json({
          error: "Drużyny muszą być różne.",
        });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const [activeTeams] = await pool.query(
        "SELECT name FROM teams WHERE guild_id = ? AND active = 1 AND name IN (?, ?)",
        [guildId, teamA, teamB],
      );

      const activeNames = new Set(activeTeams.map((t) => t.name));

      if (!activeNames.has(teamA) || !activeNames.has(teamB)) {
        return res.status(400).json({
          error: "Both teams must be active teams on this server",
        });
      }

      const [[next]] = await pool.query(
        `
            SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
            FROM matches
            WHERE guild_id = ? AND event_id = ? AND phase = ?
            `,
        [guildId, event.id, phase],
      );

      const [result] = await pool.query(
        `
            INSERT INTO matches (
                guild_id, event_id, phase, match_no, team_a, team_b, best_of, start_time_utc, is_locked
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
        [
          guildId,
          event.id,
          phase,
          next.nextNo,
          teamA,
          teamB,
          Number(bestOf),
          startTimeUtc || null,
        ],
      );

      res.json({
        ok: true,
        match: {
          id: result.insertId,
          guild_id: guildId,
          event_id: event.id,
          phase,
          match_no: next.nextNo,
          team_a: teamA,
          team_b: teamB,
          best_of: Number(bestOf),
          start_time_utc: startTimeUtc || null,
          is_locked: 0,
        },
      });

      io.emit("dashboard:refresh", { slug });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/matches/:matchId/result",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { guildId } = req;
      const resA = Number(req.body.resA);
      const resB = Number(req.body.resB);

      if (
        !Number.isInteger(resA) ||
        !Number.isInteger(resB) ||
        resA < 0 ||
        resB < 0
      ) {
        return res.status(400).json({
          error: "Wyniki muszą być nieujemnymi liczbami całkowitymi.",
        });
      }

      const match = await matchesStore.getMatchById(pool, guildId, matchId);

      if (!match) {
        return res.status(404).json({ error: "Nie znaleziono meczu." });
      }

      await applyMatchResult(pool, { guildId, match, resA, resB });

      const [[eventRow]] = await pool.query(
        "SELECT slug FROM events WHERE id = ? LIMIT 1",
        [match.event_id],
      );

      if (eventRow?.slug) {
        io.emit("dashboard:refresh", { slug: eventRow.slug });
      }

      res.json({ ok: true, matchId: Number(matchId), resA, resB });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// ============================================================
// Propozycje wyników z zewnętrznego dostawcy
//
// Wynik NIGDY nie zapisuje się sam: synchronizacja tylko odkłada propozycje
// do kolejki, a dopiero zatwierdzenie przez admina wpisuje wynik i przelicza
// punkty. Automat piszący wprost do match_results rozjechałby ranking przy
// pierwszej błędnej albo częściowej odpowiedzi API - bez śladu w interfejsie.
// ============================================================

app.post(
  "/api/events/:slug/result-proposals/sync",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { guildId } = req;

      const provider = getResultProvider();

      if (!provider) {
        return res.status(400).json({
          error:
            "Dostawca wyników nie jest skonfigurowany (RESULT_PROVIDER w server/.env)",
        });
      }

      const [[event]] = await pool.query(
        "SELECT id, slug, external_tournament_id FROM events WHERE slug = ? AND guild_id = ? LIMIT 1",
        [req.params.slug, guildId],
      );

      if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

      const podsumowanie = await resultProposalsStore.syncProposals(pool, {
        guildId,
        event,
        provider,
      });

      logInfo("results", "Result proposals synced", {
        guildId,
        slug: event.slug,
        ...podsumowanie,
        by: req.session?.user?.id,
      });

      res.json({
        ok: true,
        summary: podsumowanie,
        proposals: await resultProposalsStore.listProposals(
          pool,
          guildId,
          event.id,
        ),
      });
    } catch (err) {
      console.error(err);

      if (err.code === "NO_EXTERNAL_TOURNAMENT") {
        return res.status(400).json({ error: err.message });
      }

      logError("results", "Result proposal sync failed", {
        guildId: req.guildId,
        slug: req.params.slug,
        message: err?.message,
      });

      res
        .status(502)
        .json({ error: `Nie udało się pobrać wyników: ${err.message}` });
    }
  },
);

app.get(
  "/api/events/:slug/result-proposals",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id, external_tournament_id FROM events WHERE slug = ? AND guild_id = ? LIMIT 1",
        [req.params.slug, guildId],
      );

      if (!event) return res.status(404).json({ error: "Nie znaleziono turnieju." });

      res.json({
        proposals: await resultProposalsStore.listProposals(
          pool,
          guildId,
          event.id,
        ),
        externalTournamentId: event.external_tournament_id,
        providerConfigured: !!getResultProvider(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.post(
  "/api/result-proposals/:proposalId/accept",
  requireGuildAdmin(guildIdFromProposalId),
  async (req, res) => {
    try {
      const { guildId } = req;
      const proposal = await resultProposalsStore.getProposal(
        pool,
        guildId,
        req.params.proposalId,
      );

      if (!proposal)
        return res.status(404).json({ error: "Propozycja nie istnieje" });

      if (proposal.status !== "PENDING") {
        return res
          .status(409)
          .json({ error: `Propozycja jest już ${proposal.status}` });
      }

      const match = await matchesStore.getMatchById(
        pool,
        guildId,
        proposal.match_id,
      );
      if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

      // Ta sama ścieżka, którą idzie ręczne wpisanie wyniku - jeden zapis,
      // jedno przeliczenie punktów, żeby obie drogi nie mogły się rozjechać.
      await applyMatchResult(pool, {
        guildId,
        match,
        resA: proposal.res_a,
        resB: proposal.res_b,
      });

      await resultProposalsStore.markResolved(
        pool,
        guildId,
        proposal.id,
        "ACCEPTED",
        req.session?.user?.id,
      );

      logWarn("results", "Result proposal accepted", {
        guildId,
        matchId: match.id,
        resA: proposal.res_a,
        resB: proposal.res_b,
        source: proposal.source,
        by: req.session?.user?.id,
      });

      const [[eventRow]] = await pool.query(
        "SELECT slug FROM events WHERE id = ? LIMIT 1",
        [match.event_id],
      );

      if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

      res.json({
        ok: true,
        matchId: match.id,
        resA: proposal.res_a,
        resB: proposal.res_b,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.post(
  "/api/result-proposals/:proposalId/reject",
  requireGuildAdmin(guildIdFromProposalId),
  async (req, res) => {
    try {
      const { guildId } = req;
      const proposal = await resultProposalsStore.getProposal(
        pool,
        guildId,
        req.params.proposalId,
      );

      if (!proposal)
        return res.status(404).json({ error: "Propozycja nie istnieje" });

      await resultProposalsStore.markResolved(
        pool,
        guildId,
        proposal.id,
        "REJECTED",
        req.session?.user?.id,
      );

      logInfo("results", "Result proposal rejected", {
        guildId,
        matchId: proposal.match_id,
        by: req.session?.user?.id,
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

// Powiązanie eventu z turniejem u dostawcy oraz drużyny z jej nazwą u
// dostawcy. Bez tego nie da się dopasować niczego automatycznie.
app.patch(
  "/api/events/:slug/external-link",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { guildId } = req;
      const wartosc =
        String(req.body?.externalTournamentId ?? "").trim() || null;

      const [result] = await pool.query(
        "UPDATE events SET external_tournament_id = ? WHERE slug = ? AND guild_id = ?",
        [wartosc, req.params.slug, guildId],
      );

      if (!result.affectedRows)
        return res.status(404).json({ error: "Nie znaleziono turnieju." });

      res.json({ ok: true, externalTournamentId: wartosc });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.get(
  "/api/matches/:matchId",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { guildId } = req;

      const match = await matchesStore.getMatchById(pool, guildId, matchId);

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
        });
      }

      res.json({ match });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/matches/:matchId/exact",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { guildId } = req;

      const match = await matchesStore.getMatchById(pool, guildId, matchId);

      if (!match) {
        return res.status(404).json({ error: "Nie znaleziono meczu." });
      }

      const maxMaps = maxMapsFromBo(match.best_of);
      const maps = [];

      if (maxMaps === 1) {
        const [[row]] = await pool.query(
          "SELECT exact_a, exact_b FROM match_results WHERE match_id = ? AND guild_id = ? LIMIT 1",
          [matchId, guildId],
        );

        maps.push({
          mapNo: 1,
          exactA: row?.exact_a ?? null,
          exactB: row?.exact_b ?? null,
        });
      } else {
        const [rows] = await pool.query(
          "SELECT map_no, exact_a, exact_b FROM match_map_results WHERE match_id = ? AND guild_id = ?",
          [matchId, guildId],
        );

        const byMap = new Map(rows.map((r) => [Number(r.map_no), r]));

        for (let i = 1; i <= maxMaps; i += 1) {
          const r = byMap.get(i);
          maps.push({
            mapNo: i,
            exactA: r?.exact_a ?? null,
            exactB: r?.exact_b ?? null,
          });
        }
      }

      res.json({ bestOf: match.best_of, maxMaps, maps });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// Pojedynczy mecz w tym samym ksztalcie co element listy.
//
// Bez tego strona meczu wolala /api/events/:slug/matches i szukala jednego
// meczu w calej tablicy - przy 106 meczach kazde wejscie i kazde odswiezenie
// po zdarzeniu realtime ciagnelo pelna liste.
//
// Publiczny, bo dokladnie te dane pokazuje lista meczow, ktora tez jest
// publiczna. Typ gracza (pred_*) dokleja sie tylko dla zalogowanego -
// zapytanie joinuje match_predictions po user_id z sesji.
app.get("/api/public/matches/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.session?.user?.id || null;

    const [wiersze] = await pool.query(sqlMeczeZTypem("m.id = ?"), [
      userId,
      userId,
      userId,
      matchId,
    ]);

    const match = wiersze[0];

    if (!match) {
      return res.status(404).json({ error: "Nie znaleziono meczu." });
    }

    const [[event]] = await pool.query(
      "SELECT id, name, slug, guild_id FROM events WHERE id = ? LIMIT 1",
      [match.event_id],
    );

    if (!event) {
      return res.status(404).json({ error: "Nie znaleziono turnieju." });
    }

    const gate = await assertPredictionsAllowed({
      guildId: event.guild_id,
      kind: "MATCHES",
    });

    const wzbogacony = await stanTypowaniaMeczu({
      match,
      gate,
      guildId: event.guild_id,
      deadlineCache: new Map(),
    });

    return res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
      },
      match: wzbogacony,
    });
  } catch (err) {
    console.error("PUBLIC MATCH ERROR:", err);

    return res.status(500).json({
      error: "Nie udało się pobrać meczu.",
    });
  }
});

app.get("/api/public/matches/:matchId/result", async (req, res) => {
  try {
    const { matchId } = req.params;

    const [[match]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        event_id,
        best_of
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId],
    );

    if (!match) {
      return res.status(404).json({
        error: "Nie znaleziono meczu.",
      });
    }

    const [[result]] = await pool.query(
      `
      SELECT
        res_a,
        res_b,
        exact_a,
        exact_b
      FROM match_results
      WHERE match_id = ?
        AND guild_id = ?
        AND event_id = ?
      LIMIT 1
      `,
      [match.id, match.guild_id, match.event_id],
    );

    if (!result) {
      return res.status(404).json({
        error: "Match result not found",
      });
    }

    const maxMaps = maxMapsFromBo(match.best_of);
    const maps = [];

    if (maxMaps === 1) {
      maps.push({
        mapNo: 1,
        exactA: result.exact_a ?? null,
        exactB: result.exact_b ?? null,
      });
    } else {
      const [rows] = await pool.query(
        `
        SELECT
          map_no,
          exact_a,
          exact_b
        FROM match_map_results
        WHERE match_id = ?
          AND guild_id = ?
          AND event_id = ?
        ORDER BY map_no ASC
        `,
        [match.id, match.guild_id, match.event_id],
      );

      const byMap = new Map(rows.map((row) => [Number(row.map_no), row]));

      for (let i = 1; i <= maxMaps; i += 1) {
        const row = byMap.get(i);

        maps.push({
          mapNo: i,
          exactA: row?.exact_a ?? null,
          exactB: row?.exact_b ?? null,
        });
      }
    }

    return res.json({
      bestOf: Number(match.best_of),
      maxMaps,
      maps,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.post(
  "/api/matches/:matchId/exact",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { guildId } = req;

      const match = await matchesStore.getMatchById(
        pool,
        guildId,
        matchId,
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
        });
      }

      if (!match.event_id) {
        return res.status(400).json({
          error: "Match has no event_id",
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);

      if (![1, 3, 5].includes(Number(match.best_of))) {
        return res.status(400).json({
          error: `Nieobsługiwany format BO${match.best_of}.`,
        });
      }

      const inputMaps = Array.isArray(req.body.maps)
        ? req.body.maps
        : [];

      const clean = [];

      // ============================================
      // NORMALIZACJA + PODSTAWOWA WALIDACJA
      // ============================================

      for (const map of inputMaps) {
        const mapNo = Number(map.mapNo);
        const exactA = Number(map.exactA);
        const exactB = Number(map.exactB);

        if (
          !Number.isInteger(mapNo) ||
          mapNo < 1 ||
          mapNo > maxMaps
        ) {
          return res.status(400).json({
            error: `Invalid mapNo: ${map.mapNo}`,
          });
        }

        if (!validateCs2Score(exactA, exactB)) {
          return res.status(400).json({
            error: `Mapa ${mapNo}: nieprawidłowy wynik CS2.`,
          });
        }

        clean.push({
          mapNo,
          exactA,
          exactB,
        });
      }

      if (!clean.length) {
        return res.status(400).json({
          error: "No map scores provided",
        });
      }

      const uniqueMapNos = new Set(
        clean.map((map) => map.mapNo),
      );

      if (uniqueMapNos.size !== clean.length) {
        return res.status(400).json({
          error: "Numery map nie mogą się powtarzać.",
        });
      }

      const sortedMaps = [...clean].sort(
        (a, b) => a.mapNo - b.mapNo,
      );

      // ============================================
      // KOLEJNOŚĆ MAP
      // ============================================

      for (
        let index = 0;
        index < sortedMaps.length;
        index += 1
      ) {
        if (sortedMaps[index].mapNo !== index + 1) {
          return res.status(400).json({
            error:
              "Numery map muszą być kolejne: 1, 2, 3...",
          });
        }
      }

      let finalResA = 0;
      let finalResB = 0;

      // ============================================
      // BO1
      // ============================================

      if (maxMaps === 1) {
        if (sortedMaps.length !== 1) {
          return res.status(400).json({
            error: "BO1 musi zawierać dokładnie jedną mapę.",
          });
        }

        const { exactA, exactB } = sortedMaps[0];

        finalResA = exactA > exactB ? 1 : 0;
        finalResB = exactB > exactA ? 1 : 0;
      }

      // ============================================
      // BO3 / BO5
      // ============================================

      else {
        const winsNeeded = Math.ceil(
          Number(match.best_of) / 2,
        );

        let resA = 0;
        let resB = 0;

        for (
          let index = 0;
          index < sortedMaps.length;
          index += 1
        ) {
          const { mapNo, exactA, exactB } =
            sortedMaps[index];

          if (exactA > exactB) {
            resA += 1;
          } else {
            resB += 1;
          }

          const seriesFinished =
            resA === winsNeeded ||
            resB === winsNeeded;

          if (
            seriesFinished &&
            index !== sortedMaps.length - 1
          ) {
            return res.status(400).json({
              error:
                `Seria zakończyła się już po mapie ${mapNo}.`,
            });
          }
        }

        if (
          resA !== winsNeeded &&
          resB !== winsNeeded
        ) {
          return res.status(400).json({
            error:
              `Seria BO${match.best_of} nie jest jeszcze zakończona.`,
          });
        }

        finalResA = resA;
        finalResB = resB;
      }

      // ============================================
      // TRANSACTION
      // ============================================

      await runInTransaction(
        pool,
        async (conn) => {
          // BO1
          if (maxMaps === 1) {
            const { exactA, exactB } =
              sortedMaps[0];

            await conn.query(
              `
              INSERT INTO match_results (
                guild_id,
                event_id,
                match_id,
                res_a,
                res_b,
                exact_a,
                exact_b,
                finished_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

              ON DUPLICATE KEY UPDATE
                event_id = VALUES(event_id),
                res_a = VALUES(res_a),
                res_b = VALUES(res_b),
                exact_a = VALUES(exact_a),
                exact_b = VALUES(exact_b),
                finished_at = CURRENT_TIMESTAMP
              `,
              [
                guildId,
                match.event_id,
                matchId,
                finalResA,
                finalResB,
                exactA,
                exactB,
              ],
            );
          }

          // BO3 / BO5
          else {
            await conn.query(
              `
              DELETE FROM match_map_results
              WHERE guild_id = ?
                AND event_id = ?
                AND match_id = ?
              `,
              [
                guildId,
                match.event_id,
                matchId,
              ],
            );

            for (const {
              mapNo,
              exactA,
              exactB,
            } of sortedMaps) {
              await conn.query(
                `
                INSERT INTO match_map_results (
                  guild_id,
                  event_id,
                  match_id,
                  map_no,
                  exact_a,
                  exact_b
                )
                VALUES (?, ?, ?, ?, ?, ?)
                `,
                [
                  guildId,
                  match.event_id,
                  matchId,
                  mapNo,
                  exactA,
                  exactB,
                ],
              );
            }

            await conn.query(
              `
              INSERT INTO match_results (
                guild_id,
                event_id,
                match_id,
                res_a,
                res_b,
                finished_at
              )
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

              ON DUPLICATE KEY UPDATE
                event_id = VALUES(event_id),
                res_a = VALUES(res_a),
                res_b = VALUES(res_b),
                exact_a = NULL,
                exact_b = NULL,
                finished_at = CURRENT_TIMESTAMP
              `,
              [
                guildId,
                match.event_id,
                matchId,
                finalResA,
                finalResB,
              ],
            );
          }

          // ============================================
          // LOCK
          // ============================================

          await conn.query(
            `
            UPDATE matches
            SET is_locked = 1
            WHERE guild_id = ?
              AND event_id = ?
              AND id = ?
            `,
            [
              guildId,
              match.event_id,
              matchId,
            ],
          );

          // ============================================
          // POINTS
          // ============================================

          await recalculateMatchPoints(
            conn,
            guildId,
            match.event_id,
            matchId,
            match.best_of,
          );
        },
      );

      // ============================================
      // REALTIME — PO COMMIT
      // ============================================

      const [[eventRow]] = await pool.query(
        `
        SELECT slug
        FROM events
        WHERE guild_id = ?
          AND id = ?
        LIMIT 1
        `,
        [
          guildId,
          match.event_id,
        ],
      );

      emitDashboardRefresh({
        slug: eventRow?.slug ?? null,
        guildId,
        eventId: match.event_id,
        matchId: Number(matchId),
        phase: match.phase,
        reason: "match_finished",
      });

      return res.json({
        ok: true,

        result: {
          res_a: finalResA,
          res_b: finalResB,
        },

        maps: sortedMaps,
      });
    } catch (err) {
      console.error(
        "ADMIN MATCH EXACT SAVE ERROR:",
        err,
      );

      return res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/recalculate",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;

      const [[event]] = await pool.query(
        `
      SELECT *
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
        [slug],
      );

      if (!event) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      const wynik = await calculateScores(event.guild_id, event.id);

      // Zarchiwizowany turniej nie jest przeliczany - zasady punktacji map
      // zmieniły się po IEM Cologne 2026, więc przeliczenie zamkniętego
      // eventu przepisałoby jego ranking nowymi regułami.
      if (wynik?.skipped) {
        return res.status(409).json({
          error:
            `Turniej "${wynik.eventName}" jest zarchiwizowany, więc punkty nie zostały przeliczone. ` +
            "Zasady punktacji map zmieniły się po jego zakończeniu - przeliczenie zmieniłoby " +
            "zamknięty ranking. Jeśli naprawdę tego chcesz, najpierw cofnij archiwizację.",
          skipped: true,
          reason: wynik.reason,
        });
      }

      io.emit("dashboard:refresh", {
        slug,
      });

      res.json({
        success: true,
        guild_id: event.guild_id,
        event_id: event.id,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Failed to recalculate scores",
      });
    }
  },
);

const SWISS_STAGES = ["stage1", "stage2", "stage3"];

app.get(
  "/api/events/:slug/swiss-results/:stage",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug, stage } = req.params;
      const { guildId } = req;

      if (!SWISS_STAGES.includes(stage)) {
        return res.status(400).json({ error: "Nieprawidłowy etap." });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const current = await getCurrentSwissResults(
        pool,
        guildId,
        event.id,
        stage,
      );

      res.json({
        x3_0: current.x3_0,
        x0_3: current.x0_3,
        advancing: current.adv,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/swiss-results/:stage",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug, stage } = req.params;
      const { guildId } = req;

      if (!SWISS_STAGES.includes(stage)) {
        return res.status(400).json({ error: "Nieprawidłowy etap." });
      }

      const x3_0 = Array.isArray(req.body.x3_0)
        ? req.body.x3_0.map(String)
        : [];
      const x0_3 = Array.isArray(req.body.x0_3)
        ? req.body.x0_3.map(String)
        : [];
      const advancing = Array.isArray(req.body.advancing)
        ? req.body.advancing.map(String)
        : [];

      const all = [...x3_0, ...x0_3, ...advancing];

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // Limity wyniku biorą się z konfiguracji tego eventu (maksimum,
      // nie liczba wymagana - wynik wpisuje się etapami).
      const limityWyniku = await getPhaseLimits(pool, guildId, event.id, stage);

      const walidacjaWyniku = sprawdzWynik(stage, limityWyniku, { x3_0, x0_3, advancing });

      if (!walidacjaWyniku.ok) {
        return res.status(400).json({ error: walidacjaWyniku.blad });
      }

      const teams = await loadActiveTeams(pool, guildId);
      const validTeams = new Set(teams.map((t) => t.toLowerCase()));
      const invalid = all.filter((t) => !validTeams.has(t.toLowerCase()));

      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
      }

      await pool.query(
        `
            INSERT INTO swiss_results
              (guild_id, event_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
              event_id = VALUES(event_id),
              correct_3_0 = VALUES(correct_3_0),
              correct_0_3 = VALUES(correct_0_3),
              correct_advancing = VALUES(correct_advancing),
              active = 1
            `,
        [
          guildId,
          event.id,
          stage,
          x3_0.join(", "),
          x0_3.join(", "),
          advancing.join(", "),
        ],
      );

      res.json({ ok: true, stage, x3_0, x0_3, advancing });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/events/:slug/playoffs-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const current = await getCurrentPlayoffs(pool, guildId, event.id);

      res.json({
        semifinalists: current.semifinalists,
        finalists: current.finalists,
        winner: current.winner[0] || null,
        third: current.third[0] || null,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/playoffs-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const semifinalists = Array.isArray(req.body.semifinalists)
        ? req.body.semifinalists.map(String)
        : [];
      const finalists = Array.isArray(req.body.finalists)
        ? req.body.finalists.map(String)
        : [];
      const winner = req.body.winner ? String(req.body.winner) : null;
      const third = req.body.third ? String(req.body.third) : null;

      if (finalists.some((t) => !semifinalists.includes(t))) {
        return res
          .status(400)
          .json({ error: "Finalists must be semifinalists" });
      }

      if (winner && !finalists.includes(winner)) {
        return res.status(400).json({ error: "Zwycięzca musi być finalistą." });
      }

      if (third && (third === winner || !semifinalists.includes(third))) {
        return res.status(400).json({ error: "Invalid third place" });
      }

      const all = [
        ...semifinalists,
        ...finalists,
        ...(winner ? [winner] : []),
        ...(third ? [third] : []),
      ];

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
      // wpisuje sie etapami - czesciowy tez musi sie zapisac).
      const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "playoffs");

      const walidacjaWyniku = sprawdzWynik("playoffs", limityWyniku, { semifinalists, finalists, winner: winner ? [winner] : [], third: third ? [third] : [] });

      if (!walidacjaWyniku.ok) {
        return res.status(400).json({ error: walidacjaWyniku.blad });
      }

      const teams = await loadActiveTeams(pool, guildId);
      const invalid = all.filter((t) => !teams.includes(t));

      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
      }

      await runInTransaction(pool, async (conn) => {
        await conn.query(
          "UPDATE playoffs_results SET active = 0 WHERE guild_id = ? AND event_id = ?",
          [guildId, event.id],
        );

        await conn.query(
          `INSERT INTO playoffs_results
                    (guild_id, event_id, correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            guildId,
            event.id,
            semifinalists.join(", "),
            finalists.join(", "),
            winner || null,
            third || null,
          ],
        );
      });

      res.json({ ok: true, semifinalists, finalists, winner, third });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/events/:slug/doubleelim-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const current = await getCurrentDoubleElimResults(
        pool,
        guildId,
        event.id,
      );

      res.json(current);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/doubleelim-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const upperFinalA = Array.isArray(req.body.upperFinalA)
        ? req.body.upperFinalA.map(String)
        : [];
      const lowerFinalA = Array.isArray(req.body.lowerFinalA)
        ? req.body.lowerFinalA.map(String)
        : [];
      const upperFinalB = Array.isArray(req.body.upperFinalB)
        ? req.body.upperFinalB.map(String)
        : [];
      const lowerFinalB = Array.isArray(req.body.lowerFinalB)
        ? req.body.lowerFinalB.map(String)
        : [];

      for (const [label, arr] of [
        ["Upper Final A", upperFinalA],
        ["Lower Final A", lowerFinalA],
        ["Upper Final B", upperFinalB],
        ["Lower Final B", lowerFinalB],
      ]) {
        if (new Set(arr).size !== arr.length) {
          return res
            .status(400)
            .json({ error: `${label}: drużyny nie mogą się powtarzać.` });
        }
      }

      const all = [
        ...upperFinalA,
        ...lowerFinalA,
        ...upperFinalB,
        ...lowerFinalB,
      ];

      if (!all.length) {
        return res.status(400).json({ error: "No teams selected" });
      }

      if (new Set(all).size !== all.length) {
        return res
          .status(400)
          .json({ error: "A team cannot appear in more than one slot" });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
      // wpisuje sie etapami - czesciowy tez musi sie zapisac).
      const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "doubleelim");

      const walidacjaWyniku = sprawdzWynik("doubleelim", limityWyniku, { upperFinalA, lowerFinalA, upperFinalB, lowerFinalB });

      if (!walidacjaWyniku.ok) {
        return res.status(400).json({ error: walidacjaWyniku.blad });
      }

      const teams = await loadActiveTeams(pool, guildId);
      const invalid = all.filter((t) => !teams.includes(t));

      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
      }

      await runInTransaction(pool, async (conn) => {
        await conn.query(
          "UPDATE doubleelim_results SET active = 0 WHERE guild_id = ? AND event_id = ? AND active = 1",
          [guildId, event.id],
        );

        await conn.query(
          `INSERT INTO doubleelim_results
                    (guild_id, event_id, upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            guildId,
            event.id,
            upperFinalA.join(", ") || null,
            lowerFinalA.join(", ") || null,
            upperFinalB.join(", ") || null,
            lowerFinalB.join(", ") || null,
          ],
        );
      });

      res.json({
        ok: true,
        upperFinalA,
        lowerFinalA,
        upperFinalB,
        lowerFinalB,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.get(
  "/api/events/:slug/playin-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const current = await getCurrentPlayinResults(pool, guildId, event.id);

      res.json(current);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/playin-results",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const teams = Array.isArray(req.body.teams)
        ? Array.from(new Set(req.body.teams.map(String)))
        : [];

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      // Limity wyniku z konfiguracji tego eventu (maksimum, bo wynik
      // wpisuje sie etapami - czesciowy tez musi sie zapisac).
      const limityWyniku = await getPhaseLimits(pool, guildId, event.id, "playin");

      const walidacjaWyniku = sprawdzWynik("playin", limityWyniku, { teams });

      if (!walidacjaWyniku.ok) {
        return res.status(400).json({ error: walidacjaWyniku.blad });
      }

      const activeTeams = await loadActiveTeams(pool, guildId);
      const invalid = teams.filter((t) => !activeTeams.includes(t));

      if (invalid.length) {
        return res
          .status(400)
          .json({ error: `Unknown or inactive teams: ${invalid.join(", ")}` });
      }

      await runInTransaction(pool, async (conn) => {
        await conn.query(
          "UPDATE playin_results SET active = 0 WHERE guild_id = ? AND event_id = ?",
          [guildId, event.id],
        );

        await conn.query(
          `INSERT INTO playin_results (guild_id, event_id, correct_teams, active)
                 VALUES (?, ?, ?, 1)`,
          [guildId, event.id, teams.join(", ")],
        );
      });

      res.json({ ok: true, teams });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// Lista zakończonych turniejów danej gildii (archiwum).
app.get(
  "/api/guilds/:guildId/archive",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const { guildId } = req.params;

      const [events] = await pool.query(
        `
            SELECT
                e.id,
                e.slug,
                e.name,
                e.status,
                e.is_archived,
                e.phase,
                e.created_at,
                (SELECT COUNT(*) FROM leaderboard l
                  WHERE l.event_id = e.id AND l.guild_id = ?) AS players,
                (SELECT COUNT(*) FROM matches m
                  WHERE m.event_id = e.id AND m.guild_id = ?) AS matches,
                (SELECT COALESCE(SUM(l.total_points), 0) FROM leaderboard l
                  WHERE l.event_id = e.id AND l.guild_id = ?) AS total_points
            FROM events e
            WHERE e.guild_id = ?
              AND (e.status IN ('CLOSED', 'FINISHED') OR e.is_archived = 1)
            ORDER BY e.id DESC
            `,
        // guild_id porównujemy z parametrem, a nie z e.guild_id: kolumny
        // guild_id w leaderboard/matches i events mają różne collation
        // (utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci), więc złączenie
        // kolumna-do-kolumny wywala ER_CANT_AGGREGATE_2COLLATIONS.
        [guildId, guildId, guildId, guildId],
      );

      // Pliki eksportu są przypisane do gildii, nie do eventu - dopasowujemy
      // po nazwie pliku, którą tworzy end-tournament (safeFileBase ze slug/nazwy).
      const [files] = await pool.query(
        "SELECT id, filename, created_at FROM archive_files WHERE guild_id = ? ORDER BY id DESC",
        [guildId],
      );

      res.json({
        guildId,
        events: events.map((e) => ({
          ...e,
          archive_file:
            files.find((f) =>
              f.filename.toLowerCase().includes(String(e.slug).toLowerCase()),
            ) || null,
        })),
        files,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

// Podgląd wyników jednego zarchiwizowanego turnieju.
//
// Klasyfikacja bierze się z tabeli `leaderboard`, bo tylko ona przeżywa
// "zakończ turniej" z opcją cleanup - tabele *_scores, match_points i matches
// są wtedy kasowane. Rozbicie na fazy i nazwy graczy doklejamy z *_scores
// tam, gdzie jeszcze istnieją, więc świeżo zamknięty turniej pokaże pełny
// szczegół, a dawno wyczyszczony - samą klasyfikację końcową.
app.get(
  "/api/events/:slug/archive",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        `SELECT id, guild_id, slug, name, status, is_archived, phase, created_at
             FROM events WHERE guild_id = ? AND slug = ? LIMIT 1`,
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const [base] = await pool.query(
        `SELECT user_id, total_points FROM leaderboard
             WHERE guild_id = ? AND event_id = ?`,
        [guildId, event.id],
      );

      const [detail] = await pool.query(
        `
            SELECT
                c.user_id,
                MAX(c.displayname)          AS displayname,
                SUM(c.swiss_points)         AS swiss_points,
                SUM(c.playoffs_points)      AS playoffs_points,
                SUM(c.playin_points)        AS playin_points,
                SUM(c.doubleelim_points)    AS doubleelim_points,
                SUM(c.match_points)         AS match_points
            FROM (
                SELECT user_id, displayname, COALESCE(points,0) AS swiss_points,
                       0 AS playoffs_points, 0 AS playin_points, 0 AS doubleelim_points, 0 AS match_points
                FROM swiss_scores WHERE guild_id = ? AND event_id = ?
                UNION ALL
                SELECT user_id, displayname, 0, COALESCE(points, score, 0), 0, 0, 0
                FROM playoffs_scores WHERE guild_id = ? AND event_id = ?
                UNION ALL
                SELECT user_id, displayname, 0, 0, COALESCE(points,0), 0, 0
                FROM playin_scores WHERE guild_id = ? AND event_id = ?
                UNION ALL
                SELECT user_id, displayname, 0, 0, 0, COALESCE(points,0), 0
                FROM doubleelim_scores WHERE guild_id = ? AND event_id = ?
                UNION ALL
                SELECT user_id, NULL, 0, 0, 0, 0, COALESCE(points,0)
                FROM match_points WHERE guild_id = ? AND event_id = ?
            ) c
            GROUP BY c.user_id
            `,
        Array(5).fill([guildId, event.id]).flat(),
      );

      const byUser = new Map(detail.map((d) => [d.user_id, d]));

      // Jeśli leaderboard jest pusty (turniej sprzed jego wprowadzenia),
      // opieramy klasyfikację na tym, co zostało w *_scores.
      const source = base.length
        ? base.map((b) => ({ ...b, ...(byUser.get(b.user_id) || {}) }))
        : detail.map((d) => ({
          ...d,
          total_points:
            Number(d.swiss_points || 0) +
            Number(d.playoffs_points || 0) +
            Number(d.playin_points || 0) +
            Number(d.doubleelim_points || 0) +
            Number(d.match_points || 0),
        }));

      const standings = source
        .map((r) => ({
          user_id: r.user_id,
          displayname: r.displayname || null,
          total_points: Number(r.total_points || 0),
          swiss_points: Number(r.swiss_points || 0),
          playoffs_points: Number(r.playoffs_points || 0),
          playin_points: Number(r.playin_points || 0),
          doubleelim_points: Number(r.doubleelim_points || 0),
          match_points: Number(r.match_points || 0),
        }))
        .sort((a, b) => b.total_points - a.total_points)
        .map((r, i) => ({ rank: i + 1, ...r }));

      const [matches] = await pool.query(
        `SELECT m.id, m.match_no, m.phase, m.team_a, m.team_b, m.best_of,
                    r.res_a, r.res_b
             FROM matches m
             LEFT JOIN match_results r ON r.match_id = m.id
             WHERE m.guild_id = ? AND m.event_id = ?
             ORDER BY m.phase, m.match_no`,
        [guildId, event.id],
      );

      const [swiss] = await pool.query(
        `SELECT stage, correct_3_0, correct_0_3, correct_advancing
             FROM swiss_results WHERE guild_id = ? AND event_id = ? AND active = 1
             ORDER BY stage`,
        [guildId, event.id],
      );

      const playoffs = await getCurrentPlayoffs(pool, guildId, event.id);
      const doubleelim = await getCurrentDoubleElimResults(
        pool,
        guildId,
        event.id,
      );
      const playin = await getCurrentPlayinResults(pool, guildId, event.id);

      const [[mvp]] = await pool.query(
        `SELECT c.nickname, c.team_name
             FROM mvp_results r
             JOIN mvp_candidates c ON c.id = r.candidate_id
             WHERE r.guild_id = ? AND r.event_id = ? AND r.active = 1
             LIMIT 1`,
        [guildId, event.id],
      );

      const [files] = await pool.query(
        "SELECT id, filename, created_at FROM archive_files WHERE guild_id = ? ORDER BY id DESC",
        [guildId],
      );

      res.json({
        event,
        standings,
        matches,
        phase_results: { swiss, playoffs, doubleelim, playin },
        mvp: mvp || null,
        archive_file:
          files.find((f) =>
            f.filename.toLowerCase().includes(String(event.slug).toLowerCase()),
          ) || null,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.get(
  "/api/events/:slug/mvp",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const [candidates] = await pool.query(
        `
            SELECT id, nickname, team_name, is_active
            FROM mvp_candidates
            WHERE guild_id = ? AND event_id = ?
            ORDER BY is_active DESC, nickname ASC
            `,
        [guildId, event.id],
      );

      const [[result]] = await pool.query(
        `
            SELECT candidate_id
            FROM mvp_results
            WHERE guild_id = ? AND event_id = ? AND active = 1
            LIMIT 1
            `,
        [guildId, event.id],
      );

      res.json({ candidates, result: result || null });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/mvp/candidates",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;
      const { entries } = req.body;

      if (!Array.isArray(entries) || !entries.length) {
        return res.status(400).json({
          error: "entries musi być niepustą tablicą { nickname, teamName }.",
        });
      }

      const clean = entries
        .map((e) => ({
          nickname: String(e.nickname || "").trim(),
          teamName: e.teamName ? String(e.teamName).trim() : null,
        }))
        .filter((e) => e.nickname);

      if (!clean.length) {
        return res.status(400).json({ error: "No valid candidates provided" });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      await runInTransaction(pool, async (conn) => {
        await conn.query(
          "UPDATE mvp_candidates SET is_active = 0 WHERE guild_id = ? AND event_id = ?",
          [guildId, event.id],
        );

        for (const c of clean) {
          await conn.query(
            `
                    INSERT INTO mvp_candidates (guild_id, event_id, nickname, team_name, is_active)
                    VALUES (?, ?, ?, ?, 1)
                    `,
            [guildId, event.id, c.nickname, c.teamName],
          );
        }
      });

      res.json({ ok: true, count: clean.length });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/mvp/result",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;
      const candidateId = Number(req.body.candidateId);

      if (!Number.isInteger(candidateId) || candidateId <= 0) {
        return res.status(400).json({ error: "Wymagany jest identyfikator kandydata." });
      }

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      await pool.query(
        `
            INSERT INTO mvp_results (guild_id, event_id, candidate_id, active)
            VALUES (?, ?, ?, 1)
            ON DUPLICATE KEY UPDATE
                candidate_id = VALUES(candidate_id),
                active = 1,
                updated_at = CURRENT_TIMESTAMP
            `,
        [guildId, event.id, candidateId],
      );

      res.json({ ok: true, candidateId });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// Start typowania spoza Discorda.
//
// Panel na Discordzie publikuje wyłącznie publishPickemPanel() - ta sama
// funkcja dla komendy, auto-startu i tego endpointu. API nie może wywołać jej
// wprost, bo bot i serwer to dwa osobne procesy PM2 dzielące tylko bazę:
// serwer nie ma klienta Discorda, więc nie ma czym wysłać wiadomości.
//
// Dlatego zapisujemy tu intencję w kolumnach auto_start_*, a bot podnosi ją
// w ciągu ~30 s swoim watcherem i publikuje panel. Intencja jest trwała, więc
// restart bota w złym momencie niczego nie gubi, a każdy kolejny klient
// (aplikacja mobilna) dostaje tę samą ścieżkę za darmo.
app.post(
  "/api/events/:slug/pickem/start",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      // Przyjmujemy oba zapisy fazy: panelowy ('swiss_stage1') i ten
      // z events.phase ('SWISS_STAGE_1'), żeby front mógł podać to, co ma.
      const surowa = String(req.body?.faza || req.body?.phase || "").trim();

      const faza = FAZY_PANELU_CONFIG[surowa]
        ? surowa
        : FAZA_PANELU[surowa.toUpperCase()];

      if (!faza) {
        return res.status(400).json({
          error: "Nieznana faza typowania.",
          dozwolone: Object.keys(FAZY_PANELU_CONFIG),
        });
      }

      const [[event]] = await pool.query(
        `SELECT id, name, status, is_open, is_active, is_archived,
                auto_started_at
           FROM events
          WHERE guild_id = ? AND slug = ?
          LIMIT 1`,
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      if (Number(event.is_archived) === 1 || event.status === "FINISHED") {
        return res.status(409).json({
          error: "Ten turniej jest już zakończony.",
        });
      }

      // Bot podnosi z kolejki tylko eventy w stanie UPCOMING / 0 / 0 - ten
      // warunek chroni trwający turniej przed przejęciem przez zaplanowany
      // start. Przełączanie faz w już otwartym evencie idzie inną ścieżką.
      const gotowy =
        event.status === "UPCOMING" &&
        Number(event.is_open) === 0 &&
        Number(event.is_active) === 0;

      if (!gotowy) {
        return res.status(409).json({
          error:
            "Typowanie tego turnieju zostało już uruchomione. " +
            "Zmiana fazy trwającego turnieju idzie przez panel na Discordzie.",
          stan: {
            status: event.status,
            is_open: Number(event.is_open),
            is_active: Number(event.is_active),
          },
        });
      }

      // Kanał: jawnie podany wygrywa, w przeciwnym razie PICKEM_CHANNEL_ID
      // z configu gildii. Na Discordzie kanał bierze się z tego, gdzie admin
      // wpisał komendę - z WWW nie ma takiego odpowiednika.
      const kanalZConfigu =
        guildRegistry.getGuildConfig(guildId)?.PICKEM_CHANNEL_ID;

      const channelId = String(req.body?.channelId || kanalZConfigu || "").trim();

      if (!channelId) {
        return res.status(400).json({
          error:
            "Nie wiadomo, na którym kanale opublikować panel. " +
            "Ustaw PICKEM_CHANNEL_ID w configu serwera albo podaj channelId.",
        });
      }

      const [wynik] = await pool.query(
        `UPDATE events
            SET auto_start_at = UTC_TIMESTAMP(),
                auto_start_phase = ?,
                auto_start_channel_id = ?,
                auto_started_at = NULL
          WHERE id = ? AND guild_id = ?
            AND status = 'UPCOMING' AND is_open = 0 AND is_active = 0
          LIMIT 1`,
        [faza, channelId, event.id, guildId],
      );

      if (wynik.affectedRows === 0) {
        return res.status(409).json({
          error: "Stan turnieju zmienił się w trakcie. Odśwież i spróbuj ponownie.",
        });
      }

      logInfo("pickem", "Pick'Em start queued from web", {
        guildId,
        eventId: event.id,
        by: req.session?.user?.id,
        extra: { faza, channelId },
      });

      emitDashboardRefresh({ slug, guildId, reason: "pickem_start_queued" });

      return res.json({
        ok: true,
        slug,
        faza,
        channelId,
        // Watcher bota tyka co 30 s - front ma co pokazać zamiast
        // sugerować, że panel jest już na Discordzie.
        opoznienieSekundy: 30,
      });
    } catch (err) {
      console.error("PICKEM START:", err);
      return res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.post(
  "/api/events/:slug/phase",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;
      const { phase } = req.body;

      const allowedPhases = [
        "NOT_STARTED",
        "PLAY_IN",
        "SWISS",
        "SWISS_STAGE_1",
        "SWISS_STAGE_2",
        "SWISS_STAGE_3",
        "DOUBLE_ELIM",
        "PLAYOFFS",
        "FINISHED",
      ];

      if (!allowedPhases.includes(phase)) {
        return res.status(400).json({
          error: "Invalid phase",
          allowedPhases,
        });
      }

      const [result] = await pool.query(
        `
        UPDATE events
        SET phase = ?
        WHERE guild_id = ?
          AND slug = ?
        LIMIT 1
        `,
        [phase, guildId, slug],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Nie znaleziono turnieju.",
        });
      }

      io.emit("dashboard:refresh", { slug });

      res.json({
        ok: true,
        slug,
        phase,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);


app.get(
  "/api/guilds/:guildId/backups",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      res.json({ backups: listGuildBackups(req.params.guildId) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not list backups" });
    }
  },
);

// Backup, którego nie da się zabrać z serwera, chroni tylko przed pomyłką
// admina - nie przed utratą samego hosta. Stąd pobieranie, tą samą bramką
// uprawnień co tworzenie i przywracanie.
app.get(
  "/api/guilds/:guildId/backups/:fileName/download",
  requireGuildAdmin((req) => req.params.guildId),
  (req, res) => {
    try {
      const guildId = req.params.guildId;
      const fileName = assertSafeBackupFileName(req.params.fileName);
      const { backupDir } = guildRegistry.getGuildPaths(guildId);
      const filePath = path.join(backupDir, fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Nie znaleziono pliku kopii zapasowej." });
      }

      logInfo("backup", "Guild backup downloaded from web panel", {
        guildId,
        fileName,
        by: req.session?.user?.id,
      });

      res.download(filePath, fileName);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Invalid backup file name" });
    }
  },
);

app.post(
  "/api/guilds/:guildId/backups",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const result = await createGuildBackup(req.params.guildId);

      logInfo("backup", "Guild backup created from web panel", {
        guildId: req.params.guildId,
        fileName: result.fileName,
        tablesCount: result.tablesCount,
        filteredTablesCount: result.filteredTablesCount,
        prunedFiles: result.prunedFiles,
        by: req.session?.user?.id,
      });

      res.json({
        ok: true,
        backup: result,
        backups: listGuildBackups(req.params.guildId),
      });
    } catch (err) {
      console.error(err);

      logError("backup", "Web backup failed", {
        guildId: req.params.guildId,
        message: err?.message,
        stack: err?.stack,
      });

      res.status(500).json({ error: "Backup failed" });
    }
  },
);

app.post(
  "/api/guilds/:guildId/backups/:fileName/restore",
  requireGuildAdmin((req) => req.params.guildId),
  async (req, res) => {
    try {
      const guildId = req.params.guildId;
      const fileName = assertSafeBackupFileName(req.params.fileName);
      const { backupDir } = guildRegistry.getGuildPaths(guildId);
      const filePath = path.join(backupDir, fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Nie znaleziono pliku kopii zapasowej." });
      }

      const summary = await restoreBackup(filePath, { guildId });

      logWarn("backup", "Guild backup restored from web panel", {
        guildId,
        fileName,
        clearedTables: summary?.clearedTables,
        statementsApplied: summary?.statementsApplied,
        skippedTables: summary?.skippedTables,
        by: req.session?.user?.id,
      });

      io.emit("dashboard:refresh", {});

      res.json({ ok: true, fileName, summary });
    } catch (err) {
      console.error(err);

      logError("backup", "Web restore failed", {
        guildId: req.params.guildId,
        fileName: req.params.fileName,
        message: err?.message,
        stack: err?.stack,
      });

      res.status(500).json({ error: "Restore failed" });
    }
  },
);

app.post(
  "/api/events/:slug/end-tournament",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { archiveName, cleanup = false } = req.body || {};
      const guildId = req.guildId;

      const [[event]] = await pool.query(
        "SELECT id, guild_id, name, slug FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      guildRegistry.ensureGuildDirs(guildId);

      const { archiveDir } = guildRegistry.getGuildPaths(guildId);
      const base = safeFileBase(
        archiveName || event.slug || event.name,
        "pickem_archive",
      );
      const filename = `${base}.xlsx`;
      const filePath = path.join(archiveDir, filename);

      await exportClassification({ guildId, outputPath: filePath });

      await pool.query(
        `INSERT INTO archive_files (guild_id, filename, path) VALUES (?, ?, ?)`,
        [guildId, filename, filePath],
      );

      await pool.query(
        `UPDATE active_panels SET closed = 1, closed_at = NOW(), active = 0 WHERE guild_id = ? AND closed = 0`,
        [guildId],
      );

      if (cleanup) {
        await runInTransaction(pool, async (conn) => {
          await conn.query(`DELETE FROM active_panels WHERE guild_id = ?`, [
            guildId,
          ]);
          await conn.query(
            `DELETE FROM swiss_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playoffs_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM doubleelim_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playin_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM swiss_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playoffs_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM doubleelim_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playin_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM match_points WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM match_map_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM match_map_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM match_predictions WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM match_results WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM matches WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM swiss_scores WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playoffs_scores WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM doubleelim_scores WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
          await conn.query(
            `DELETE FROM playin_scores WHERE guild_id = ? AND event_id = ?`,
            [guildId, event.id],
          );
        });
      }

      await pool.query(
        `UPDATE events SET status = 'FINISHED', is_archived = 1, is_open = 0, is_active = 0, phase = 'FINISHED' WHERE id = ? LIMIT 1`,
        [event.id],
      );

      logWarn("tournament", "Tournament ended from web panel", {
        guildId,
        eventId: event.id,
        slug,
        filename,
        cleanup: Boolean(cleanup),
        by: req.session?.user?.id,
      });

      io.emit("dashboard:refresh", { slug });
      io.emit("event:status_updated", { slug, status: "FINISHED" });

      res.json({
        ok: true,
        archive: { filename, path: filePath },
        cleanup: Boolean(cleanup),
      });
    } catch (err) {
      console.error(err);

      logError("tournament", "Web end tournament failed", {
        slug: req.params.slug,
        guildId: req.guildId,
        message: err?.message,
        stack: err?.stack,
      });

      res.status(500).json({ error: "End tournament failed" });
    }
  },
);

app.get(
  "/api/events/:slug/export/classification",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const buffer = await exportClassification({ guildId, eventId: event.id });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="klasyfikacja-${slug}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Failed to generate classification export",
      });
    }
  },
);

app.get(
  "/api/events/:slug/phases/:phase/clear-preview",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug, phase } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const [[points]] = await pool.query(
        `
            SELECT COUNT(*) AS count
            FROM match_points mp
            JOIN matches m ON m.id = mp.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
        [phase, guildId, event.id],
      );

      const [[predictions]] = await pool.query(
        `
            SELECT COUNT(*) AS count
            FROM match_predictions pr
            JOIN matches m ON m.id = pr.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
        [phase, guildId, event.id],
      );

      const [[results]] = await pool.query(
        `
            SELECT COUNT(*) AS count
            FROM match_results mr
            JOIN matches m ON m.id = mr.match_id
            WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
            `,
        [phase, guildId, event.id],
      );

      const [[matches]] = await pool.query(
        `
            SELECT COUNT(*) AS count
            FROM matches
            WHERE phase = ? AND guild_id = ? AND event_id = ?
            `,
        [phase, guildId, event.id],
      );

      res.json({
        matches: matches.count,
        predictions: predictions.count,
        results: results.count,
        points: points.count,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

app.post(
  "/api/events/:slug/phases/:phase/clear",
  requireGuildAdmin(guildIdFromEventSlug),
  async (req, res) => {
    try {
      const { slug, phase } = req.params;
      const { guildId } = req;

      const [[event]] = await pool.query(
        "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
        [guildId, slug],
      );

      if (!event) {
        return res.status(404).json({ error: "Nie znaleziono turnieju." });
      }

      const { r1, r2, r3, r4 } = await runInTransaction(pool, async (conn) => {
        const [r1] = await conn.query(
          `
                DELETE mp
                FROM match_points mp
                JOIN matches m ON m.id = mp.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
          [phase, guildId, event.id],
        );

        const [r2] = await conn.query(
          `
                DELETE pr
                FROM match_predictions pr
                JOIN matches m ON m.id = pr.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
          [phase, guildId, event.id],
        );

        const [r3] = await conn.query(
          `
                DELETE mr
                FROM match_results mr
                JOIN matches m ON m.id = mr.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
          [phase, guildId, event.id],
        );

        // Tabele per-mapa były tu pominięte, więc czyszczenie fazy
        // zostawiało wiersze wskazujące na skasowane mecze. Na produkcji
        // jest już po tym 2 osieroconych typów map i 3 wyników map.
        await conn.query(
          `
                DELETE mmp
                FROM match_map_predictions mmp
                JOIN matches m ON m.id = mmp.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
          [phase, guildId, event.id],
        );

        await conn.query(
          `
                DELETE mmr
                FROM match_map_results mmr
                JOIN matches m ON m.id = mmr.match_id
                WHERE m.phase = ? AND m.guild_id = ? AND m.event_id = ?
                `,
          [phase, guildId, event.id],
        );

        const [r4] = await conn.query(
          `
                DELETE FROM matches
                WHERE phase = ? AND guild_id = ? AND event_id = ?
                `,
          [phase, guildId, event.id],
        );

        return { r1, r2, r3, r4 };
      });

      logWarn("matches", "Cleared matches phase via web panel", {
        guildId,
        eventId: event.id,
        phase,
        deleted_points: r1?.affectedRows ?? 0,
        deleted_predictions: r2?.affectedRows ?? 0,
        deleted_results: r3?.affectedRows ?? 0,
        deleted_matches: r4?.affectedRows ?? 0,
        by: req.session?.user?.id,
      });

      io.emit("dashboard:refresh", { slug });

      res.json({
        ok: true,
        deleted: {
          matches: r4?.affectedRows ?? 0,
          predictions: r2?.affectedRows ?? 0,
          results: r3?.affectedRows ?? 0,
          points: r1?.affectedRows ?? 0,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// ============================================================
// Edycja i usuwanie POJEDYNCZEGO meczu
//
// Dotąd jedyną drogą do poprawienia literówki w nazwie drużyny było
// "Wyczyść fazę", które kasuje WSZYSTKIE mecze tej fazy razem z typami
// graczy i punktami. Nieproporcjonalne do pomyłki.
// ============================================================

// Co zniknie razem z meczem. Ten sam wzorzec co podgląd czyszczenia fazy:
// admin widzi liczby, zanim cokolwiek potwierdzi.
async function policzDaneMeczu(matchId) {
  const licz = async (tabela) => {
    const [[r]] = await pool.query(
      `SELECT COUNT(*) n FROM \`${tabela}\` WHERE match_id = ?`,
      [matchId],
    );
    return r.n;
  };

  return {
    typy: await licz("match_predictions"),
    typyMap: await licz("match_map_predictions"),
    wyniki: await licz("match_results"),
    wynikiMap: await licz("match_map_results"),
    punkty: await licz("match_points"),
  };
}

app.get(
  "/api/matches/:matchId/delete-preview",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const match = await matchesStore.getMatchById(
        pool,
        req.guildId,
        req.params.matchId,
      );
      if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

      res.json({
        match: {
          id: match.id,
          phase: match.phase,
          matchNo: match.match_no,
          teamA: match.team_a,
          teamB: match.team_b,
          bestOf: match.best_of,
        },
        usunie: await policzDaneMeczu(match.id),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Błąd bazy danych." });
    }
  },
);

app.delete(
  "/api/matches/:matchId",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { guildId } = req;
      const match = await matchesStore.getMatchById(
        pool,
        guildId,
        req.params.matchId,
      );

      if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

      const usunie = await policzDaneMeczu(match.id);

      // Kolejność jak przy czyszczeniu fazy, ale z tabelami per-mapa, których
      // tamten kod nie obejmował - bez nich zostawałyby wiersze wskazujące
      // na nieistniejący mecz.
      await runInTransaction(pool, async (conn) => {
        for (const tabela of [
          "match_points",
          "match_predictions",
          "match_map_predictions",
          "match_results",
          "match_map_results",
        ]) {
          await conn.query(`DELETE FROM \`${tabela}\` WHERE match_id = ?`, [
            match.id,
          ]);
        }

        await conn.query("DELETE FROM matches WHERE id = ? AND guild_id = ?", [
          match.id,
          guildId,
        ]);
      });

      logWarn("matches", "Match deleted from web panel", {
        guildId,
        matchId: match.id,
        phase: match.phase,
        teams: `${match.team_a} vs ${match.team_b}`,
        usunie,
        by: req.session?.user?.id,
      });

      const [[eventRow]] = await pool.query(
        "SELECT slug FROM events WHERE id = ? LIMIT 1",
        [match.event_id],
      );

      if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

      res.json({ ok: true, usunieto: usunie });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się usunąć meczu." });
    }
  },
);

app.patch(
  "/api/matches/:matchId",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { guildId } = req;
      const { teamA, teamB, bestOf, startTimeUtc } = req.body || {};

      const match = await matchesStore.getMatchById(
        pool,
        guildId,
        req.params.matchId,
      );
      if (!match) return res.status(404).json({ error: "Mecz nie istnieje" });

      const noweA = teamA ?? match.team_a;
      const noweB = teamB ?? match.team_b;
      const noweBo = bestOf === undefined ? match.best_of : Number(bestOf);

      if (noweA === noweB) {
        return res.status(400).json({ error: "Drużyny muszą być różne." });
      }

      if (![1, 3, 5].includes(Number(noweBo))) {
        return res.status(400).json({ error: "BO musi wynosić 1, 3 albo 5." });
      }

      // Ta sama walidacja co przy tworzeniu - matches.team_a to varchar, więc
      // literówka wjechałaby do bazy i rozjechała dopasowywanie wyników.
      if (teamA !== undefined || teamB !== undefined) {
        const [aktywne] = await pool.query(
          "SELECT name FROM teams WHERE guild_id = ? AND active = 1 AND name IN (?, ?)",
          [guildId, noweA, noweB],
        );

        const znane = new Set(aktywne.map((t) => t.name));

        if (!znane.has(noweA) || !znane.has(noweB)) {
          return res.status(400).json({
            error: "Obie drużyny muszą istnieć i być aktywne na tym serwerze.",
          });
        }
      }

      await pool.query(
        `UPDATE matches
                SET team_a = ?, team_b = ?, best_of = ?, start_time_utc = ?
              WHERE id = ? AND guild_id = ?`,
        [
          noweA,
          noweB,
          noweBo,
          startTimeUtc === undefined
            ? match.start_time_utc
            : startTimeUtc || null,
          match.id,
          guildId,
        ],
      );

      // Zmiana drużyn albo BO unieważnia dotychczasowe punkty tego meczu -
      // typy graczy zostają, ale liczą się teraz względem czego innego.
      // Przeliczamy od razu, żeby ranking nie został z punktami policzonymi
      // dla poprzedniego układu.
      const zmianaWplywajacaNaPunkty =
        noweA !== match.team_a ||
        noweB !== match.team_b ||
        Number(noweBo) !== Number(match.best_of);

      if (zmianaWplywajacaNaPunkty) {
        await recalculateMatchPoints(
          pool,
          guildId,
          match.event_id,
          match.id,
          noweBo,
        );
      }

      logInfo("matches", "Match edited from web panel", {
        guildId,
        matchId: match.id,
        przed: `${match.team_a} vs ${match.team_b} BO${match.best_of}`,
        po: `${noweA} vs ${noweB} BO${noweBo}`,
        przeliczono: zmianaWplywajacaNaPunkty,
        by: req.session?.user?.id,
      });

      const [[eventRow]] = await pool.query(
        "SELECT slug FROM events WHERE id = ? LIMIT 1",
        [match.event_id],
      );

      if (eventRow?.slug) io.emit("dashboard:refresh", { slug: eventRow.slug });

      res.json({
        ok: true,
        match: await matchesStore.getMatchById(pool, guildId, match.id),
        przeliczonoPunkty: zmianaWplywajacaNaPunkty,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się zapisać zmian w meczu." });
    }
  },
);

app.post(
  "/api/matches/:matchId/lock",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { mode } = req.body;

      if (!["auto", "lock", "unlock"].includes(mode)) {
        return res.status(400).json({
          error: "Nieprawidłowy tryb blokady.",
        });
      }

      const [[currentMatch]] = await pool.query(
        `
        SELECT
          id,
          start_time_utc,
          is_locked
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (!currentMatch) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
        });
      }

      let override = null;
      let isLocked = Number(currentMatch.is_locked) === 1;

      if (mode === "lock") {
        override = 1;
      }

      if (mode === "unlock") {
        override = 0;
      }

      if (mode === "auto") {
        override = null;

        isLocked = isMatchStarted(
          {
            start_time_utc: currentMatch.start_time_utc,
          },
          undefined,
          getLockBeforeSec(),
        );
      }

      await pool.query(
        `
        UPDATE matches
        SET
          lock_override = ?,
          is_locked = ?
        WHERE id = ?
        LIMIT 1
        `,
        [override, isLocked ? 1 : 0, matchId],
      );

      const [[match]] = await pool.query(
        `
        SELECT e.slug
        FROM matches m
        JOIN events e
          ON e.id = m.event_id
        WHERE m.id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (match?.slug) {
        io.emit("match:updated", {
          slug: match.slug,
          matchId,
          mode,
        });

        io.emit("dashboard:refresh", {
          slug: match.slug,
        });
      }

      res.json({
        ok: true,
        matchId,
        mode,
        lockOverride: override,
        isLocked,
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);


app.post(
  "/api/dev/matches/:matchId/score",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { score_a, score_b } = req.body;

      await pool.query(
        `
  INSERT INTO live_match_scores (match_id, score_a, score_b)
  VALUES (?, ?, ?)
  ON DUPLICATE KEY UPDATE
    score_a = VALUES(score_a),
    score_b = VALUES(score_b),
    updated_at = CURRENT_TIMESTAMP
  `,
        [matchId, score_a, score_b],
      );

      io.emit("match:score_updated", {
        matchId: Number(matchId),
        score_a: Number(score_a),
        score_b: Number(score_b),
        current_map: 1,
        live_status: "LIVE",
        ui_status: "LIVE",
      });

      res.json({
        ok: true,
        matchId: Number(matchId),
        score_a: Number(score_a),
        score_b: Number(score_b),
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Score update failed",
      });
    }
  },
);

app.post(
  "/api/dev/matches/:matchId/final",
  requireGuildAdmin(guildIdFromMatchId),
  async (req, res) => {
    try {
      const { matchId } = req.params;

      await pool.query(
        `
            UPDATE live_match_scores
            SET status = 'FINAL',
                updated_at = CURRENT_TIMESTAMP
            WHERE match_id = ?
            `,
        [matchId],
      );

      const [[liveScore]] = await pool.query(
        `
    SELECT score_a, score_b, current_map
    FROM live_match_scores
    WHERE match_id = ?
    LIMIT 1
    `,
        [matchId],
      );

      io.emit("match:score_updated", {
        matchId: Number(matchId),

        score_a: Number(liveScore?.score_a || 0),
        score_b: Number(liveScore?.score_b || 0),

        current_map: Number(liveScore?.current_map || 1),

        live_status: "FINAL",
        ui_status: "FINAL",
      });

      res.json({
        ok: true,
        matchId: Number(matchId),
        status: "FINAL",
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Final update failed",
      });
    }
  },
);


app.get("/api/public/events/:slug/my-stats", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    const guildId = event.guild_id;
    const eventId = event.id;

    // ============================================
    // LICZBA WSZYSTKICH TYPÓW
    // ============================================

    const [[predictionCount]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM match_predictions
      WHERE guild_id = ?
        AND event_id = ?
        AND user_id = ?
      `,
      [guildId, eventId, userId],
    );

    const totalPredictions = Number(predictionCount?.total || 0);

    if (!totalPredictions) {
      return res.json({
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
        },
        has_data: false,
      });
    }

    // ============================================
    // ROZLICZONE MECZE
    // ============================================

    const [settledRows] = await pool.query(
      `
      SELECT
        m.id AS match_id,
        m.match_no,
        m.team_a,
        m.team_b,
        m.best_of,

        mp.pred_a,
        mp.pred_b,
        mp.pred_exact_a,
        mp.pred_exact_b,

        mr.res_a,
        mr.res_b,
        mr.exact_a,
        mr.exact_b,
        mr.finished_at

      FROM match_predictions mp

      INNER JOIN matches m
        ON m.id = mp.match_id
       AND m.guild_id = mp.guild_id
       AND m.event_id = mp.event_id

      INNER JOIN match_results mr
        ON mr.match_id = mp.match_id
       AND mr.guild_id = mp.guild_id
       AND mr.event_id = mp.event_id

      WHERE mp.guild_id = ?
        AND mp.event_id = ?
        AND mp.user_id = ?

      ORDER BY
        mr.finished_at ASC,
        m.id ASC
      `,
      [guildId, eventId, userId],
    );

    const settledMatches = settledRows.length;

    const winnerHits = settledRows.filter(isWinnerCorrect).length;

    const seriesExacts = settledRows.filter(isSeriesExact).length;

    const { current: currentStreak, best: bestStreak } =
      calculateStreaks(settledRows);

    const bo1 = getBoStats(settledRows, 1);
    const bo3 = getBoStats(settledRows, 3);
    const bo5 = getBoStats(settledRows, 5);

    // ============================================
    // MAPY
    // ============================================

    const [mapRowsRaw] = await pool.query(
      `
      SELECT
        p.match_id,
        p.map_no,
        p.pred_exact_a,
        p.pred_exact_b,
        r.exact_a,
        r.exact_b

      FROM match_map_predictions p

      INNER JOIN match_map_results r
        ON r.guild_id = p.guild_id
       AND r.event_id = p.event_id
       AND r.match_id = p.match_id
       AND r.map_no = p.map_no

      WHERE p.guild_id = ?
        AND p.event_id = ?
        AND p.user_id = ?
      `,
      [guildId, eventId, userId],
    );

    const mapRows = [...mapRowsRaw];

    const existingMapKeys = new Set(
      mapRows.map((row) => `${row.match_id}:${row.map_no}`),
    );

    for (const row of settledRows) {
      if (Number(row.best_of) !== 1) {
        continue;
      }

      const key = `${row.match_id}:1`;

      if (existingMapKeys.has(key)) {
        continue;
      }

      if (
        row.pred_exact_a == null ||
        row.pred_exact_b == null ||
        row.exact_a == null ||
        row.exact_b == null
      ) {
        continue;
      }

      mapRows.push({
        match_id: row.match_id,
        map_no: 1,
        pred_exact_a: row.pred_exact_a,
        pred_exact_b: row.pred_exact_b,
        exact_a: row.exact_a,
        exact_b: row.exact_b,
      });

      existingMapKeys.add(key);
    }

    const settledMaps = mapRows.length;

    const mapWinnerHits = mapRows.filter(isMapWinnerCorrect).length;

    const exactMaps = mapRows.filter(isMapExact).length;

    const mapAccuracy = calculateMapAccuracy(mapRows);

    const teamStats = calculateTeamStats(settledRows);

    // ============================================
    // PUNKTY USERA
    // ============================================

    const [[points]] = await pool.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN source = 'series'
              THEN points
              ELSE 0
            END
          ),
          0
        ) AS series_points,

        COALESCE(
          SUM(
            CASE
              WHEN source = 'map'
              THEN points
              ELSE 0
            END
          ),
          0
        ) AS map_points,

        COALESCE(
          SUM(points),
          0
        ) AS total_points

      FROM match_points

      WHERE guild_id = ?
        AND event_id = ?
        AND user_id = ?
      `,
      [guildId, eventId, userId],
    );

    const totalPoints = Number(points?.total_points || 0);

    const seriesPoints = Number(points?.series_points || 0);

    const mapPoints = Number(points?.map_points || 0);

    const averagePoints = settledMatches ? totalPoints / settledMatches : 0;

    // ============================================
    // PUNKTY PER MECZ / TRENDY
    // ============================================

    const [pointsPerMatchRows] = await pool.query(
      `
      SELECT
        match_id,
        COALESCE(SUM(points), 0) AS total_points
      FROM match_points
      WHERE guild_id = ?
        AND event_id = ?
        AND user_id = ?
      GROUP BY match_id
      `,
      [guildId, eventId, userId],
    );

    const pointsByMatch = new Map(
      pointsPerMatchRows.map((row) => [
        String(row.match_id),
        Number(row.total_points || 0),
      ]),
    );

    const trends = calculateTrendStats({
      settledRows,
      mapRows,
      pointsByMatch,
    });

    // ============================================
    // SPOŁECZNOŚĆ
    // ============================================

    const [communityRows] = await pool.query(
      `
      SELECT
        mp.user_id,

        m.id AS match_id,
        m.match_no,
        m.team_a,
        m.team_b,
        m.best_of,

        mp.pred_a,
        mp.pred_b,
        mp.pred_exact_a,
        mp.pred_exact_b,

        mr.res_a,
        mr.res_b,
        mr.exact_a,
        mr.exact_b

      FROM match_predictions mp

      INNER JOIN matches m
        ON m.id = mp.match_id
       AND m.guild_id = mp.guild_id
       AND m.event_id = mp.event_id

      INNER JOIN match_results mr
        ON mr.match_id = mp.match_id
       AND mr.guild_id = mp.guild_id
       AND mr.event_id = mp.event_id

      WHERE mp.guild_id = ?
        AND mp.event_id = ?
      `,
      [guildId, eventId],
    );

    const communitySettledMatches = communityRows.length;

    const communityWinnerHits = communityRows.filter(isWinnerCorrect).length;

    const communitySeriesExacts = communityRows.filter(isSeriesExact).length;

    const contrarianStats = calculateContrarianStats(
      settledRows,
      communityRows,
    );

    const communityAnalysis = calculateCommunityAnalysis(communityRows);

    const style = calculatePlayerStyle({
      settledMatches,
      winnerHits,
      seriesExacts,

      settledMaps,
      mapWinnerHits,
      exactMaps,

      contrarianPicks: contrarianStats.contrarianPicks,

      contrarianHits: contrarianStats.contrarianHits,

      majorityPicks: contrarianStats.majorityPicks,

      majorityHits: contrarianStats.majorityHits,
    });

    // ============================================
    // UCZESTNICY / RANKING
    // ============================================

    // Miejsce w klasyfikacji bierzemy z tabeli `leaderboard` - tej samej, ktora
    // karmi strone "Ranking graczy", bota i eksport. Wczesniej liczylo sie to
    // tutaj po swojemu: z samych match_points i tylko wsrod typujacych mecze.
    // Przez to profil pokazywal "Miejsce #1" nawet wtedy, gdy ranking eventu
    // byl jeszcze pusty, i pomijal punkty ze Swiss, Playoffs, Play-In,
    // Double Elim oraz MVP.
    const participantCount = await policzUczestnikow(eventId);

    const [klasyfikacja] = await pool.query(
      `
      SELECT
        CAST(user_id AS CHAR CHARACTER SET utf8mb4)
          COLLATE utf8mb4_unicode_ci AS user_id,
        COALESCE(total_points, 0) AS total_points
      FROM leaderboard
      WHERE event_id = ?
      `,
      [eventId],
    );

    const mojWiersz = klasyfikacja.find(
      (row) => String(row.user_id) === String(userId),
    );

    // Brak wiersza znaczy, ze dla tego gracza nic jeszcze nie zostalo
    // rozliczone. Wtedy nie ma miejsca w klasyfikacji - front pokaze "-"
    // zamiast zmyslac pozycje.
    const rank = mojWiersz
      ? klasyfikacja.filter(
        (row) => Number(row.total_points) > Number(mojWiersz.total_points),
      ).length + 1
      : null;

    const topPercent =
      rank && klasyfikacja.length
        ? Math.max(0.1, (rank / klasyfikacja.length) * 100)
        : null;

    // Srednie spolecznosci zostaja na punktach meczowych, bo zestawiamy je
    // ze statystykami meczowymi gracza (skutecznosc, punkty na mecz).
    const [allPlayerPoints] = await pool.query(
      `
      SELECT
        user_id,
        COALESCE(SUM(points), 0) AS total_points
      FROM match_points
      WHERE guild_id = ?
        AND event_id = ?
      GROUP BY user_id
      `,
      [guildId, eventId],
    );

    const [[matchParticipants]] = await pool.query(
      `
      SELECT COUNT(DISTINCT user_id) AS ilu
      FROM match_predictions
      WHERE guild_id = ?
        AND event_id = ?
      `,
      [guildId, eventId],
    );

    const matchParticipantCount = Number(matchParticipants?.ilu || 0);

    const communityTotalPoints = allPlayerPoints.reduce(
      (sum, row) => sum + Number(row.total_points || 0),
      0,
    );

    const communityAverageTotalPoints = matchParticipantCount
      ? communityTotalPoints / matchParticipantCount
      : 0;

    const communityAveragePoints = communitySettledMatches
      ? communityTotalPoints / communitySettledMatches
      : 0;

    // ============================================
    // NAJLEPSZY MECZ
    // ============================================

    const [[bestMatch]] = await pool.query(
      `
      SELECT
        m.id AS match_id,
        m.match_no,
        m.team_a,
        m.team_b,
        SUM(mp.points) AS points

      FROM match_points mp

      INNER JOIN matches m
        ON m.id = mp.match_id
       AND m.guild_id = mp.guild_id
       AND m.event_id = mp.event_id

      WHERE mp.guild_id = ?
        AND mp.event_id = ?
        AND mp.user_id = ?

      GROUP BY
        m.id,
        m.match_no,
        m.team_a,
        m.team_b

      ORDER BY
        points DESC,
        m.match_no ASC,
        m.id ASC

      LIMIT 1
      `,
      [guildId, eventId, userId],
    );

    // ============================================
    // RESPONSE
    // ============================================

    const last5 = calculateRecentForm(settledRows, 5);

    const last10 = calculateRecentForm(settledRows, 10);

    const recentForm = settledRows
      .slice(-10)
      .map((row) => (isWinnerCorrect(row) ? "W" : "L"));

    res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
      },

      has_data: true,

      general: {
        total_predictions: totalPredictions,
        settled_matches: settledMatches,

        winner_hits: winnerHits,
        series_exacts: seriesExacts,

        settled_maps: settledMaps,
        map_winner_hits: mapWinnerHits,
        exact_maps: exactMaps,

        total_points: totalPoints,
        series_points: seriesPoints,
        map_points: mapPoints,
        average_points: Number(averagePoints.toFixed(2)),

        rank,
        participant_count: participantCount,
        top_percent:
          topPercent === null ? null : Number(topPercent.toFixed(1)),

        style,
        trends,
      },

      accuracy: {
        winner_hits: winnerHits,
        settled_matches: settledMatches,

        series_exacts: seriesExacts,

        map_winner_hits: mapWinnerHits,
        settled_maps: settledMaps,
        exact_maps: exactMaps,

        bo1,
        bo3,
        bo5,
      },

      form: {
        recent: recentForm,

        last5,
        last10,

        current_streak: currentStreak,
        best_streak: bestStreak,

        best_match: bestMatch
          ? {
            match_id: Number(bestMatch.match_id),
            match_no:
              bestMatch.match_no !== null ? Number(bestMatch.match_no) : null,
            team_a: bestMatch.team_a,
            team_b: bestMatch.team_b,
            points: Number(bestMatch.points || 0),
          }
          : null,
      },

      comparison: {
        rank,
        participant_count: participantCount,
        top_percent:
          topPercent === null ? null : Number(topPercent.toFixed(1)),

        user: {
          winner_accuracy: percentageNumber(winnerHits, settledMatches),

          exact_accuracy: percentageNumber(seriesExacts, settledMatches),

          average_points: Number(averagePoints.toFixed(2)),

          total_points: totalPoints,
        },

        community: {
          winner_accuracy: percentageNumber(
            communityWinnerHits,
            communitySettledMatches,
          ),

          exact_accuracy: percentageNumber(
            communitySeriesExacts,
            communitySettledMatches,
          ),

          average_points: Number(communityAveragePoints.toFixed(2)),

          average_total_points: Number(communityAverageTotalPoints.toFixed(2)),

          settled_predictions: communitySettledMatches,
        },
      },

      analysis: {
        team_stats: teamStats,
        map_accuracy: mapAccuracy,
        community: communityAnalysis,
      },

      style: {
        profile: style,
        contrarian: contrarianStats,
        settled_matches: settledMatches,
      },

      trends,
    });
  } catch (err) {
    console.error("MY STATS ERROR:", err);

    res.status(500).json({
      error: "My stats load failed",
    });
  }
});

app.post("/api/public/matches/:matchId/prediction", async (req, res) => {
  try {
    const { matchId } = req.params;
    const user_id = req.session?.user?.id;

    if (!user_id) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    // ============================================
    // MATCH
    // ============================================

    const [[match]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        event_id,
        phase,
        team_a,
        team_b,
        best_of,
        is_locked,
        lock_override,
        start_time_utc
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId],
    );

    if (!match) {
      return res.status(404).json({
        error: "Nie znaleziono meczu.",
      });
    }

    // ============================================
    // GUILD ACCESS
    // ============================================

    if (!isGuildMember(req.session.user, match.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    // ============================================
    // FINAL RESULT
    // ============================================

    const [[existingResult]] = await pool.query(
      `
      SELECT 1
      FROM match_results
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
      LIMIT 1
      `,
      [match.guild_id, match.event_id, match.id],
    );

    if (existingResult) {
      return res.status(403).json({
        error: "Mecz został już zakończony.",
      });
    }

    // ============================================
    // GLOBAL PREDICTION GATE
    // ============================================

    const gate = await assertPredictionsAllowed({
      guildId: match.guild_id,
      kind: "MATCHES",
    });

    if (!gate.allowed) {
      return res.status(403).json({
        error: komunikatNaWWW(gate.message, "Typowanie meczów jest aktualnie zamknięte."),
      });
    }

    // ============================================
    // MATCH LOCK
    // ============================================

    if (isMatchLocked(match)) {
      return res.status(403).json({
        error: "Typowanie tego meczu jest już zamknięte.",
      });
    }

    // ============================================
    // PHASE DEADLINE
    // ============================================

    const matchPanelPhase = matchPanelPhaseFor(match.phase);

    if (matchPanelPhase) {
      const { passed } = await isMatchDeadlinePassed(
        pool,
        match.guild_id,
        matchPanelPhase,
      );

      if (passed) {
        return res.status(403).json({
          error: "Deadline typowania wyników meczów dla tej fazy minął.",
        });
      }
    }

    // ============================================
    // BEST OF
    // ============================================

    const bestOf = Number(match.best_of || 1);

    if (![1, 3, 5].includes(bestOf)) {
      return res.status(400).json({
        error: `Nieobsługiwany format BO${bestOf}.`,
      });
    }

    const hasSeriesPayload = Boolean(req.body?.series);

    if (bestOf === 1 && hasSeriesPayload) {
      return res.status(400).json({
        error: "BO1 nie przyjmuje payloadu serii.",
      });
    }

    if (bestOf > 1 && !hasSeriesPayload) {
      return res.status(400).json({
        error: `BO${bestOf} wymaga payloadu serii.`,
      });
    }

    let predA = null;
    let predB = null;

    let bo1ExactA = null;
    let bo1ExactB = null;

    let mapPicks = [];

    // ============================================
    // BO3 / BO5
    // ============================================

    if (hasSeriesPayload) {
      predA = Number(req.body.series.pred_a);

      predB = Number(req.body.series.pred_b);

      if (
        !Number.isInteger(predA) ||
        !Number.isInteger(predB) ||
        predA < 0 ||
        predB < 0 ||
        predA === predB
      ) {
        return res.status(400).json({
          error: "Nieprawidłowy typ serii.",
        });
      }

      // ============================================
      // VALID SERIES SCORE
      // ============================================

      if (bestOf === 3) {
        const validBo3 =
          (predA === 2 && (predB === 0 || predB === 1)) ||
          (predB === 2 && (predA === 0 || predA === 1));

        if (!validBo3) {
          return res.status(400).json({
            error: "BO3 series must be 2:0 / 2:1 / 1:2 / 0:2",
          });
        }
      }

      if (bestOf === 5) {
        const validBo5 =
          (predA === 3 && [0, 1, 2].includes(predB)) ||
          (predB === 3 && [0, 1, 2].includes(predA));

        if (!validBo5) {
          return res.status(400).json({
            error: "BO5 series must be 3:x or x:3",
          });
        }
      }

      // ============================================
      // MAPS
      // ============================================

      mapPicks = Array.isArray(req.body.maps) ? req.body.maps : [];

      const requiredMaps = predA + predB;

      if (mapPicks.length !== requiredMaps) {
        return res.status(400).json({
          error:
            `Dla wyniku ${predA}:${predB} wymagane są ` +
            `${requiredMaps} mapy.`,
        });
      }

      // ============================================
      // UNIQUE MAP NUMBERS
      // ============================================

      const mapNumbers = mapPicks.map((map) => Number(map.map_no));

      const uniqueMapNumbers = new Set(mapNumbers);

      if (uniqueMapNumbers.size !== mapNumbers.length) {
        return res.status(400).json({
          error: "Numery map nie mogą się powtarzać.",
        });
      }

      // ============================================
      // MAP NUMBERS 1,2,3...
      // ============================================

      const expectedMapNumbers = Array.from(
        {
          length: mapPicks.length,
        },
        (_, index) => index + 1,
      );

      const actualMapNumbers = mapPicks
        .map((map) => Number(map.map_no))
        .sort((a, b) => a - b);

      const hasValidMapNumbers = expectedMapNumbers.every(
        (mapNo, index) => mapNo === actualMapNumbers[index],
      );

      if (!hasValidMapNumbers) {
        return res.status(400).json({
          error: "Numery map muszą być kolejne: 1, 2, 3...",
        });
      }

      // ============================================
      // MAP SCORE VALIDATION
      // ============================================

      for (const map of mapPicks) {
        const mapNo = Number(map.map_no);

        const exactA = Number(map.pred_exact_a);

        const exactB = Number(map.pred_exact_b);

        if (
          !Number.isInteger(mapNo) ||
          mapNo < 1 ||
          mapNo > bestOf ||
          !validateCs2Score(exactA, exactB)
        ) {
          return res.status(400).json({
            error: `Nieprawidłowy wynik mapy ` + `${mapNo || "?"}.`,
          });
        }
      }

      // ============================================
      // MAP WINNERS MUST MATCH SERIES
      // ============================================

      const winsA = mapPicks.filter(
        (map) => Number(map.pred_exact_a) > Number(map.pred_exact_b),
      ).length;

      const winsB = mapPicks.filter(
        (map) => Number(map.pred_exact_b) > Number(map.pred_exact_a),
      ).length;

      if (winsA !== predA || winsB !== predB) {
        return res.status(400).json({
          error: "Wyniki map nie zgadzają się z wynikiem serii.",
        });
      }

      // ============================================
      // SERIES CANNOT END TOO EARLY
      // ============================================

      if (!validateSeriesMapOrder(mapPicks, bestOf)) {
        return res.status(400).json({
          error: "Seria kończy się za wcześnie względem podanych map.",
        });
      }
    }

    // ============================================
    // BO1
    // ============================================
    else {
      const { winner, score_a, score_b } = req.body;

      if (!["team_a", "team_b"].includes(winner)) {
        return res.status(400).json({
          error: "Nieprawidłowy zwycięzca.",
        });
      }

      const scoreA = Number(score_a);
      const scoreB = Number(score_b);

      if (!validateCs2Score(scoreA, scoreB)) {
        return res.status(400).json({
          error: "Nieprawidłowy wynik CS2.",
        });
      }

      if (
        (winner === "team_a" && scoreA <= scoreB) ||
        (winner === "team_b" && scoreB <= scoreA)
      ) {
        return res.status(400).json({
          error: "Wybrany zwycięzca nie zgadza się z wynikiem.",
        });
      }

      predA = winner === "team_a" ? 1 : 0;

      predB = winner === "team_b" ? 1 : 0;

      bo1ExactA = scoreA;
      bo1ExactB = scoreB;
    }

    // ============================================
    // SAVE
    // ============================================

    await runInTransaction(pool, async (conn) => {
      await conn.query(
        `
          INSERT INTO match_predictions (
            match_id,
            guild_id,
            event_id,
            user_id,
            pred_a,
            pred_b,
            pred_exact_a,
            pred_exact_b
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)

          ON DUPLICATE KEY UPDATE
            pred_a = VALUES(pred_a),
            pred_b = VALUES(pred_b),
            pred_exact_a = VALUES(pred_exact_a),
            pred_exact_b = VALUES(pred_exact_b),
            updated_at = CURRENT_TIMESTAMP
          `,
        [
          match.id,
          match.guild_id,
          match.event_id,
          user_id,
          predA,
          predB,

          bestOf === 1 ? bo1ExactA : null,

          bestOf === 1 ? bo1ExactB : null,
        ],
      );

      // ============================================
      // BO3 / BO5 MAPS
      // ============================================

      if (bestOf > 1) {
        await conn.query(
          `
            DELETE FROM match_map_predictions
            WHERE guild_id = ?
              AND event_id = ?
              AND match_id = ?
              AND user_id = ?
            `,
          [match.guild_id, match.event_id, match.id, user_id],
        );

        const values = mapPicks.map((map) => [
          match.id,
          match.guild_id,
          match.event_id,
          user_id,
          Number(map.map_no),
          Number(map.pred_exact_a),
          Number(map.pred_exact_b),
        ]);

        if (values.length) {
          await conn.query(
            `
              INSERT INTO match_map_predictions (
                match_id,
                guild_id,
                event_id,
                user_id,
                map_no,
                pred_exact_a,
                pred_exact_b
              )
              VALUES ?
              `,
            [values],
          );
        }
      }

      // ============================================
      // BO1 CLEANUP
      // ============================================

      if (bestOf === 1) {
        await conn.query(
          `
            DELETE FROM match_map_predictions
            WHERE guild_id = ?
              AND event_id = ?
              AND match_id = ?
              AND user_id = ?
            `,
          [match.guild_id, match.event_id, match.id, user_id],
        );
      }
    });

    // ============================================
    // RESPONSE
    // ============================================

    return res.json({
      ok: true,

      prediction: {
        match_id: Number(match.id),

        user_id,

        series: {
          pred_a: predA,
          pred_b: predB,
        },

        maps:
          bestOf === 1
            ? [
              {
                map_no: 1,
                pred_exact_a: bo1ExactA,
                pred_exact_b: bo1ExactB,
              },
            ]
            : mapPicks.map((map) => ({
              map_no: Number(map.map_no),

              pred_exact_a: Number(map.pred_exact_a),

              pred_exact_b: Number(map.pred_exact_b),
            })),
      },
    });
  } catch (err) {
    console.error("MATCH PREDICTION SAVE ERROR:", err);

    return res.status(500).json({
      error: "Nie udało się zapisać typu.",
    });
  }
});

app.get("/api/public/matches/:matchId/prediction", async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.session?.user?.id;

    // ============================================
    // AUTH
    // ============================================

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    // ============================================
    // MATCH
    // ============================================

    const [[match]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        event_id,
        best_of
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId],
    );

    if (!match) {
      return res.status(404).json({
        error: "Nie znaleziono meczu.",
      });
    }

    // ============================================
    // GUILD ACCESS
    // ============================================

    if (!isGuildMember(req.session.user, match.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    // ============================================
    // SERIES PREDICTION
    // ============================================

    const [[prediction]] = await pool.query(
      `
      SELECT
        match_id,
        user_id,
        pred_a,
        pred_b,
        pred_exact_a,
        pred_exact_b
      FROM match_predictions
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [match.guild_id, match.event_id, match.id, userId],
    );

    if (!prediction) {
      return res.json({
        prediction: null,
      });
    }

    // ============================================
    // MAPS
    // ============================================

    let maps = [];

    if (Number(match.best_of) === 1) {
      maps = [
        {
          map_no: 1,
          pred_exact_a: prediction.pred_exact_a,
          pred_exact_b: prediction.pred_exact_b,
        },
      ];
    } else {
      const [mapRows] = await pool.query(
        `
        SELECT
          map_no,
          pred_exact_a,
          pred_exact_b
        FROM match_map_predictions
        WHERE guild_id = ?
          AND event_id = ?
          AND match_id = ?
          AND user_id = ?
        ORDER BY map_no ASC
        `,
        [match.guild_id, match.event_id, match.id, userId],
      );

      maps = mapRows.map((row) => ({
        map_no: Number(row.map_no),
        pred_exact_a: row.pred_exact_a,
        pred_exact_b: row.pred_exact_b,
      }));
    }

    // ============================================
    // RESPONSE
    // ============================================

    return res.json({
      prediction: {
        match_id: Number(prediction.match_id),

        user_id: prediction.user_id,

        winner:
          Number(prediction.pred_a) > Number(prediction.pred_b)
            ? "team_a"
            : "team_b",

        score_a: prediction.pred_exact_a,

        score_b: prediction.pred_exact_b,

        series: {
          pred_a: Number(prediction.pred_a),

          pred_b: Number(prediction.pred_b),
        },

        maps,
      },
    });
  } catch (err) {
    console.error("MATCH PREDICTION LOAD ERROR:", err);

    return res.status(500).json({
      error: "Nie udało się wczytać typu.",
    });
  }
});

app.get("/api/public/events/:eventId/predictions/:userId", async (req, res) => {
  try {
    const { eventId, userId } = req.params;

    const [rows] = await pool.query(
      `
            SELECT
                mp.match_id,
                mp.user_id,
                mp.pred_a,
                mp.pred_b,
                mp.pred_exact_a,
                mp.pred_exact_b,
                m.best_of
            FROM match_predictions mp
            JOIN matches m
              ON m.id = mp.match_id
            WHERE mp.event_id = ?
              AND mp.user_id = ?
            `,
      [eventId, userId],
    );

    const [mapRows] = await pool.query(
      `
            SELECT
                match_id,
                map_no,
                pred_exact_a,
                pred_exact_b
            FROM match_map_predictions
            WHERE event_id = ?
              AND user_id = ?
            ORDER BY match_id ASC, map_no ASC
            `,
      [eventId, userId],
    );

    const mapsByMatch = new Map();

    for (const row of mapRows) {
      const matchId = Number(row.match_id);

      if (!mapsByMatch.has(matchId)) {
        mapsByMatch.set(matchId, []);
      }

      mapsByMatch.get(matchId).push({
        map_no: Number(row.map_no),
        pred_exact_a: row.pred_exact_a,
        pred_exact_b: row.pred_exact_b,
      });
    }

    res.json({
      predictions: rows.map((row) => {
        const bestOf = Number(row.best_of || 1);

        const maps =
          bestOf === 1
            ? [
              {
                map_no: 1,
                pred_exact_a: row.pred_exact_a,
                pred_exact_b: row.pred_exact_b,
              },
            ]
            : mapsByMatch.get(Number(row.match_id)) || [];

        return {
          match_id: row.match_id,
          user_id: row.user_id,

          winner: Number(row.pred_a) > Number(row.pred_b) ? "team_a" : "team_b",

          score_a: row.pred_exact_a,
          score_b: row.pred_exact_b,

          series: {
            pred_a: Number(row.pred_a),
            pred_b: Number(row.pred_b),
          },

          maps,
        };
      }),
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Predictions load failed",
    });
  }
});


app.post("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug, stage } = req.params;

    if (!["stage1", "stage2", "stage3"].includes(stage)) {
      return res.status(400).json({
        error: "Nieprawidłowy etap Swiss.",
      });
    }

    const { three_zero, zero_three, advancing } = req.body;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    /*
     * Discord działa wyłącznie z poziomu gildii,
     * więc WWW również wymaga członkostwa.
     */
    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    /*
     * Ten sam gate co Discord + webowy odpowiednik deadline.
     */
    const gate = await pickemGate(event.guild_id, "SWISS", stage);

    if (!gate.allowed) {
      return res.status(403).json({
        error: komunikatNaWWW(gate.message, "Typowanie tej fazy jest zamknięte."),
      });
    }

    /*
     * AKTUALNY EVENT - Discord robi to przez getOpenEventId().
     *
     * Bez tego zapis szedł na event_id odczytany ze sluga w URL-u, a gate
     * sprawdzał fazę BIEŻĄCEGO eventu. Przy otwartym Swiss 1 dawało się więc
     * wejść pod slugiem starego turnieju i zapisać typ do cudzego event_id.
     * Playoffs, Play-In i Double Elim mają ten sam check; Swiss był jedynym
     * bez niego.
     */
    const currentEventId = await getOpenEventId(pool, event.guild_id);

    if (!currentEventId) {
      return res.status(403).json({
        error: "Nie znaleziono aktywnego eventu.",
      });
    }

    if (Number(currentEventId) !== Number(event.id)) {
      return res.status(409).json({
        error:
          "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Swiss.",
      });
    }

    const threeZero = Array.isArray(three_zero) ? three_zero.map(String) : [];

    const zeroThree = Array.isArray(zero_three) ? zero_three.map(String) : [];

    const advancingTeams = Array.isArray(advancing)
      ? advancing.map(String)
      : [];

    /*
     * Liczby drużyn biorą się z konfiguracji TEGO eventu, a nie z liczb
     * wpisanych na sztywno. Event bez konfiguracji dostaje wartości
     * domyślne (2/2/6), czyli zachowanie sprzed tej zmiany.
     */
    const limity = await getPhaseLimits(
      pool,
      event.guild_id,
      currentEventId,
      stage,
    );

    const walidacja = sprawdzTyp(stage, limity, {
      x3_0: threeZero,
      x0_3: zeroThree,
      advancing: advancingTeams,
    });

    if (!walidacja.ok) {
      return res.status(400).json({ error: walidacja.blad });
    }

    const allPicked = [...threeZero, ...zeroThree, ...advancingTeams];

    /*
     * Tak samo jak Discord:
     * jeszcze raz sprawdzamy aktywne drużyny
     * tuż przed zapisem.
     */
    const validTeams = await loadActiveTeams(pool, event.guild_id);

    const invalidTeams = allPicked.filter((team) => !validTeams.includes(team));

    if (invalidTeams.length) {
      return res.status(400).json({
        error: `Unknown or inactive teams: ${invalidTeams.join(", ")}`,
      });
    }

    /*
     * Finalny zapis.
     * WAŻNE: stage musi być zapisany.
     */
    await pool.query(
      `
      INSERT INTO swiss_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        stage,
        pick_3_0,
        pick_0_3,
        advancing,
        active,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

      ON DUPLICATE KEY UPDATE
        event_id = VALUES(event_id),
        username = VALUES(username),
        displayname = VALUES(displayname),
        pick_3_0 = VALUES(pick_3_0),
        pick_0_3 = VALUES(pick_0_3),
        advancing = VALUES(advancing),
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        event.guild_id,
        currentEventId,
        userId,
        req.session.user?.username || userId,
        req.session.user?.global_name || req.session.user?.username || userId,
        stage,
        threeZero.join(", "),
        zeroThree.join(", "),
        advancingTeams.join(", "),
      ],
    );

    res.json({
      ok: true,

      prediction: {
        three_zero: threeZero,
        zero_three: zeroThree,
        advancing: advancingTeams,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się zapisać typów Swiss.",
    });
  }
});

// Lista drużyn do formularza fazy uzupełniona o drużyny z zapisanego typu.
//
// Formularze faz budowały listę wyboru wyłącznie z loadActiveTeams()
// (active = 1), a typy trzymane są jako nazwy tekstowe. Drużyna wyłączona
// albo przemianowana PO turnieju znikała z listy, więc historyczny typ nie
// podświetlał się jako wybrany - gracz oglądał własny typ jako pusty.
//
// Dokładamy brakujące nazwy na koniec, oznaczone active: false, żeby widok
// historyczny pokazywał to, co faktycznie zostało zapisane.
function uzupelnijDruzynyOTypy(teams, ...listyNazw) {
  const znane = new Set((teams || []).map((team) => team.name));
  const brakujace = [];

  for (const lista of listyNazw) {
    for (const nazwa of lista || []) {
      if (nazwa && !znane.has(nazwa)) {
        znane.add(nazwa);
        brakujace.push(nazwa);
      }
    }
  }

  return [
    ...(teams || []).map((team) => ({ ...team, active: true })),
    // ujemne id, żeby nie kolidowały z prawdziwymi (front używa ich jako key)
    ...brakujace.map((name, index) => ({
      id: -(index + 1),
      name,
      active: false,
    })),
  ];
}

app.get("/api/public/events/:slug/swiss-pickem/:stage", async (req, res) => {
  try {
    const { slug, stage } = req.params;
    const userId = req.session?.user?.id || null;

    if (!["stage1", "stage2", "stage3"].includes(stage)) {
      return res.status(400).json({
        error: "Nieprawidłowy etap Swiss.",
      });
    }

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug,
        phase,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    let prediction = null;

    if (userId) {
      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[row]] = await pool.query(
        `
        SELECT
          pick_3_0,
          pick_0_3,
          advancing
        FROM swiss_predictions
        WHERE guild_id = ?
          AND event_id = ?
          AND user_id = ?
          AND stage = ?
          AND active = 1
        LIMIT 1
        `,
        [
          event.guild_id,
          event.id,
          userId,
          stage,
        ],
      );

      if (row) {
        prediction = {
          three_zero: parseCsvPick(row.pick_3_0),
          zero_three: parseCsvPick(row.pick_0_3),
          advancing: parseCsvPick(row.advancing),
        };
      }
    }

    const teamNames = await loadActiveTeams(
      pool,
      event.guild_id,
    );

    const teams = uzupelnijDruzynyOTypy(
      teamNames.map((name, index) => ({ id: index + 1, name })),
      prediction?.three_zero,
      prediction?.zero_three,
      prediction?.advancing,
    );

    const gate = await pickemGate(
      event.guild_id,
      "SWISS",
      stage,
    );

    return res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
      },

      stage,

      teams,

      // Limity z konfiguracji TEGO eventu - front nie ma ich już zaszytych.
      limity: await getPhaseLimits(pool, event.guild_id, event.id, stage),

      prediction,

      lock: {
        allowed: Boolean(gate.allowed),
        message: gate.allowed
          ? null
          : komunikatNaWWW(gate.message, "Typowanie tej fazy jest zamknięte."),
      },
    });
  } catch (err) {
    console.error("SWISS PICKEM LOAD ERROR:", err);

    return res.status(500).json({
      error: "Nie udało się wczytać typów Swiss.",
    });
  }
});


app.get("/api/public/events/:slug/swiss-stats/:stage", async (req, res) => {
  try {
    const { slug, stage } = req.params;

    if (!["stage1", "stage2", "stage3"].includes(stage)) {
      return res.status(400).json({
        error: "Nieprawidłowy etap Swiss.",
      });
    }

    const [[event]] = await pool.query(
      `
            SELECT id, guild_id, name, slug
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const [rows] = await pool.query(
      `
            SELECT pick_3_0, pick_0_3, advancing
            FROM swiss_predictions
            WHERE event_id = ?
              AND stage = ?
              AND active = 1
            `,
      [event.id, stage],
    );

    function countCsvValues(values) {
      const counts = new Map();

      values.forEach((value) => {
        if (!value) return;

        String(value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((team) => {
            counts.set(team, (counts.get(team) || 0) + 1);
          });
      });

      return [...counts.entries()]
        .map(([team, count]) => ({
          team,
          count,
          percentage:
            rows.length > 0 ? Math.round((count / rows.length) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
    }

    res.json({
      event,
      stage,
      total_predictions: rows.length,
      stats: {
        three_zero: countCsvValues(rows.map((row) => row.pick_3_0)),
        zero_three: countCsvValues(rows.map((row) => row.pick_0_3)),
        advancing: countCsvValues(rows.map((row) => row.advancing)),
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się wczytać statystyk Swiss.",
    });
  }
});


app.get("/api/public/events/:slug/playin-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id || null;
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
            SELECT id, guild_id, name, slug, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const gate = await pickemGate(event.guild_id, "PLAYIN");

    const [teams] = await pool.query(
      `
            SELECT id, name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            ORDER BY name ASC
            `,
      [event.guild_id],
    );

    let prediction = null;

    if (userId) {
      // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
      // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
      // endpointy jako jedyne pozwalały odpytać event obcego serwera.
      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[row]] = await pool.query(
        `
                SELECT teams
                FROM playin_predictions
                WHERE guild_id = ?
                AND event_id = ?
                  AND user_id = ?
                  AND active = 1
                LIMIT 1
                `,
        [event.guild_id, event.id, userId],
      );

      if (row) {
        prediction = {
          teams: parseCsvPick(row.teams),
        };
      }
    }

    res.json({
      event,
      teams: uzupelnijDruzynyOTypy(teams, prediction?.teams),
      limity: await getPhaseLimits(pool, event.guild_id, event.id, "playin"),

      prediction,
      lock: {
        allowed: gate.allowed,
        message: komunikatNaWWW(gate.message, null),
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się wczytać typów Play-In.",
    });
  }
});

app.post("/api/public/events/:slug/playin-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug } = req.params;
    const { teams } = req.body;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    const gate = await pickemGate(event.guild_id, "PLAYIN");

    if (!gate.allowed) {
      return res.status(403).json({
        error: komunikatNaWWW(gate.message, "Typowanie Play-In jest zamknięte."),
      });
    }

    // ============================================
    // AKTUALNY EVENT - zgodność z Discordem 1:1
    // ============================================

    const currentEventId = await getOpenEventId(pool, event.guild_id);

    if (!currentEventId) {
      return res.status(403).json({
        error: "Nie znaleziono aktywnego eventu.",
      });
    }

    if (Number(currentEventId) !== Number(event.id)) {
      return res.status(409).json({
        error:
          "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Play-In.",
      });
    }

    // ============================================
    // WYBÓR DRUŻYN
    // ============================================

    const selectedTeams = Array.isArray(teams)
      ? teams
        .map((team) => String(team).trim())
        .filter(Boolean)
      : [];

    // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
    // czyli zachowanie sprzed tej zmiany).
    const limity = await getPhaseLimits(
      pool,
      event.guild_id,
      currentEventId,
      "playin",
    );

    const walidacja = sprawdzTyp(limity && "playin", limity, { teams: selectedTeams });

    if (!walidacja.ok) {
      return res.status(400).json({ error: walidacja.blad });
    }

    // ============================================
    // AKTYWNE DRUŻYNY
    // ============================================

    const validTeamNames = await loadActiveTeams(pool, event.guild_id);

    const validTeams = new Set(validTeamNames);

    const invalidTeams = selectedTeams.filter((team) => !validTeams.has(team));

    if (invalidTeams.length > 0) {
      return res.status(400).json({
        error: `Invalid teams: ${invalidTeams.join(", ")}`,
      });
    }

    // ============================================
    // ZAPIS
    // ============================================

    await pool.query(
      `
      INSERT INTO playin_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        teams,
        active,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

      ON DUPLICATE KEY UPDATE
        event_id = VALUES(event_id),
        username = VALUES(username),
        displayname = VALUES(displayname),
        teams = VALUES(teams),
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        event.guild_id,
        currentEventId,
        userId,
        req.session.user?.username || userId,
        req.session.user?.global_name || req.session.user?.username || userId,
        selectedTeams.join(", "),
      ],
    );

    res.json({
      ok: true,

      prediction: {
        teams: selectedTeams,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się zapisać typów Play-In.",
    });
  }
});

app.get("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id || null;
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
            SELECT id, guild_id, name, slug, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({ error: "Nie znaleziono turnieju." });
    }

    const gate = await pickemGate(event.guild_id, "PLAYOFFS");

    const [teams] = await pool.query(
      `
            SELECT id, name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            ORDER BY name ASC
            `,
      [event.guild_id],
    );

    let prediction = null;

    if (userId) {
      // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
      // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
      // endpointy jako jedyne pozwalały odpytać event obcego serwera.
      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[row]] = await pool.query(
        `
                SELECT semifinalists, finalists, winner, third_place_winner
                FROM playoffs_predictions
                WHERE event_id = ?
                  AND user_id = ?
                  AND active = 1
                LIMIT 1
                `,
        [event.id, userId],
      );

      if (row) {
        prediction = {
          semifinalists: parseCsvPick(row.semifinalists),
          finalists: parseCsvPick(row.finalists),
          winner: row.winner || null,
          third_place_winner: row.third_place_winner || null,
        };
      }
    }

    res.json({
      event,
      teams: uzupelnijDruzynyOTypy(
        teams,
        prediction?.semifinalists,
        prediction?.finalists,
        prediction?.winner ? [prediction.winner] : [],
        prediction?.third_place_winner ? [prediction.third_place_winner] : [],
      ),
      limity: await getPhaseLimits(pool, event.guild_id, event.id, "playoffs"),

      prediction,
      lock: {
        allowed: gate.allowed,
        message: komunikatNaWWW(gate.message, null),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Nie udało się wczytać typów Playoffs." });
  }
});

app.post("/api/public/events/:slug/playoffs-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug } = req.params;

    const { semifinalists, finalists, winner, third_place_winner } = req.body;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        name,
        slug,
        status
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    // ============================================
    // GATE
    // ============================================

    const gate = await pickemGate(event.guild_id, "PLAYOFFS");

    if (!gate.allowed) {
      return res.status(403).json({
        error: komunikatNaWWW(gate.message, "Typowanie Playoffs jest zamknięte."),
      });
    }

    // ============================================
    // AKTUALNY EVENT
    // Discord robi to przez getOpenEventId()
    // ============================================

    const currentEventId = await getOpenEventId(pool, event.guild_id);

    if (!currentEventId) {
      return res.status(403).json({
        error: "Nie znaleziono aktywnego eventu.",
      });
    }

    if (Number(currentEventId) !== Number(event.id)) {
      return res.status(409).json({
        error:
          "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny Playoffs.",
      });
    }

    // ============================================
    // NORMALIZACJA
    // ============================================

    const normalizeTeams = (value) =>
      Array.isArray(value)
        ? value.map((team) => String(team).trim()).filter(Boolean)
        : [];

    const semifinalistsPick = normalizeTeams(semifinalists);
    const finalistsPick = normalizeTeams(finalists);

    const winnerPick = winner ? String(winner).trim() : null;

    // 3. miejsce jest OPCJONALNE
    const thirdPick = third_place_winner
      ? String(third_place_winner).trim()
      : null;
    // ============================================
    // LICZBA WYBORÓW I DUPLIKATY
    // ============================================
    //
    // Limity z konfiguracji TEGO eventu. sprawdzTyp celowo NIE wymusza tu
    // unikalności między grupami - Playoffs to hierarchia, więc finaliści
    // powtarzają się w półfinalistach, a zwycięzca w finalistach. Zależności
    // drabinki sprawdzamy niżej, bo to reguła formatu, nie liczba drużyn.

    const limity = await getPhaseLimits(
      pool,
      event.guild_id,
      currentEventId,
      "playoffs",
    );

    const walidacja = sprawdzTyp("playoffs", limity, {
      semifinalists: semifinalistsPick,
      finalists: finalistsPick,
      winner: winnerPick ? [winnerPick] : [],
      third: thirdPick ? [thirdPick] : [],
    });

    if (!walidacja.ok) {
      return res.status(400).json({ error: walidacja.blad });
    }

    // ============================================
    // LOGIKA DRABINKI 1:1 Z DISCORDEM
    // ============================================

    if (!finalistsPick.includes(winnerPick)) {
      return res.status(400).json({
        error: "Zwycięzca musi być jednym z finalistów.",
      });
    }

    for (const finalist of finalistsPick) {
      if (!semifinalistsPick.includes(finalist)) {
        return res.status(400).json({
          error: "Finaliści muszą pochodzić z półfinalistów.",
        });
      }
    }

    if (thirdPick && [winnerPick, ...finalistsPick].includes(thirdPick)) {
      return res.status(400).json({
        error: "3. miejsce nie może być finalistą ani zwycięzcą.",
      });
    }

    if (thirdPick && !semifinalistsPick.includes(thirdPick)) {
      return res.status(400).json({
        error: "3. miejsce musi być jednym z półfinalistów.",
      });
    }

    // ============================================
    // AKTYWNE DRUŻYNY
    // ============================================

    const teamNames = await loadActiveTeams(pool, event.guild_id);

    const allowed = new Set(teamNames);

    const allPicked = [
      ...semifinalistsPick,
      ...finalistsPick,
      winnerPick,
      ...(thirdPick ? [thirdPick] : []),
    ];

    const invalid = [
      ...new Set(allPicked.filter((team) => !allowed.has(team))),
    ];

    if (invalid.length) {
      return res.status(400).json({
        error: `Unknown or inactive teams: ${invalid.join(", ")}`,
      });
    }

    // ============================================
    // SAVE
    // ============================================

    await pool.query(
      `
      INSERT INTO playoffs_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        semifinalists,
        finalists,
        winner,
        third_place_winner,
        active,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

      ON DUPLICATE KEY UPDATE
        event_id = VALUES(event_id),
        username = VALUES(username),
        displayname = VALUES(displayname),
        semifinalists = VALUES(semifinalists),
        finalists = VALUES(finalists),
        winner = VALUES(winner),
        third_place_winner = VALUES(third_place_winner),
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        event.guild_id,
        currentEventId,
        userId,
        req.session.user?.username || userId,
        req.session.user?.global_name || req.session.user?.username || userId,
        semifinalistsPick.join(", "),
        finalistsPick.join(", "),
        winnerPick,
        thirdPick,
      ],
    );

    res.json({
      ok: true,

      prediction: {
        semifinalists: semifinalistsPick,
        finalists: finalistsPick,
        winner: winnerPick,
        third_place_winner: thirdPick,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się zapisać typów Playoffs.",
    });
  }
});

app.get("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id || null;
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
            SELECT id, guild_id, name, slug, status
            FROM events
            WHERE slug = ?
            LIMIT 1
            `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const gate = await pickemGate(event.guild_id, "DOUBLEELIM");

    const [teams] = await pool.query(
      `
            SELECT id, name
            FROM teams
            WHERE guild_id = ?
              AND active = 1
            ORDER BY name ASC
            `,
      [event.guild_id],
    );

    let prediction = null;

    if (userId) {
      // Członkostwo sprawdzamy także przy odczycie - tak jak robi to Swiss.
      // Discord w ogóle nie ma jak pokazać panelu spoza gildii, a te trzy
      // endpointy jako jedyne pozwalały odpytać event obcego serwera.
      if (!isGuildMember(req.session.user, event.guild_id)) {
        return res.status(403).json({
          error: "Nie należysz do tego serwera.",
        });
      }

      const [[row]] = await pool.query(
        `
                SELECT
                    upper_final_a,
                    lower_final_a,
                    upper_final_b,
                    lower_final_b
                FROM doubleelim_predictions
                WHERE guild_id = ?
  AND event_id = ?
  AND user_id = ?
  AND active = 1
                LIMIT 1
                `,
        [event.guild_id, event.id, userId],
      );

      if (row) {
        prediction = {
          upper_final_a: parseCsvPick(row.upper_final_a),
          lower_final_a: parseCsvPick(row.lower_final_a),
          upper_final_b: parseCsvPick(row.upper_final_b),
          lower_final_b: parseCsvPick(row.lower_final_b),
        };
      }
    }

    res.json({
      event,
      teams: uzupelnijDruzynyOTypy(
        teams,
        prediction?.upper_final_a,
        prediction?.lower_final_a,
        prediction?.upper_final_b,
        prediction?.lower_final_b,
      ),
      limity: await getPhaseLimits(pool, event.guild_id, event.id, "doubleelim"),

      prediction,
      lock: {
        allowed: gate.allowed,
        message: komunikatNaWWW(gate.message, null),
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się wczytać typów Double Elimination.",
    });
  }
});

app.post("/api/public/events/:slug/doubleelim-pickem", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug } = req.params;

    const { upper_final_a, lower_final_a, upper_final_b, lower_final_b } =
      req.body;

    const [[event]] = await pool.query(
      `
      SELECT
        id,
        guild_id
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    // ============================================
    // GATE
    // ============================================

    const gate = await pickemGate(event.guild_id, "DOUBLEELIM");

    if (!gate.allowed) {
      return res.status(403).json({
        error: komunikatNaWWW(gate.message, "Typowanie Double Elimination jest zamknięte."),
      });
    }

    // ============================================
    // AKTUALNY EVENT
    // ============================================

    const currentEventId = await getOpenEventId(pool, event.guild_id);

    if (!currentEventId) {
      return res.status(403).json({
        error: "Nie znaleziono aktywnego eventu.",
      });
    }

    if (Number(currentEventId) !== Number(event.id)) {
      return res.status(409).json({
        error:
          "Ten formularz dotyczy poprzedniego eventu. " +
          "Otwórz aktualny panel Double Elimination.",
      });
    }

    // ============================================
    // NORMALIZACJA
    // ============================================

    const normalizeTeams = (value) =>
      Array.isArray(value)
        ? value.map((team) => String(team).trim()).filter(Boolean)
        : [];

    const ufa = normalizeTeams(upper_final_a);
    const lfa = normalizeTeams(lower_final_a);
    const ufb = normalizeTeams(upper_final_b);
    const lfb = normalizeTeams(lower_final_b);

    // ============================================
    // KAŻDY SLOT = DOKŁADNIE 2 DRUŻYNY
    // ============================================

    // Limity z konfiguracji TEGO eventu (brak konfiguracji = domyślne,
    // czyli zachowanie sprzed tej zmiany).
    const limity = await getPhaseLimits(
      pool,
      event.guild_id,
      currentEventId,
      "doubleelim",
    );

    const walidacja = sprawdzTyp(limity && "doubleelim", limity, {
      upperFinalA: ufa,
      lowerFinalA: lfa,
      upperFinalB: ufb,
      lowerFinalB: lfb,
    });

    if (!walidacja.ok) {
      return res.status(400).json({ error: walidacja.blad });
    }

    const allTeams = [...ufa, ...lfa, ...ufb, ...lfb];

    // ============================================
    // TYLKO AKTYWNE DRUŻYNY
    // ============================================

    const teamNames = await loadActiveTeams(pool, event.guild_id);

    const validTeams = new Set(teamNames);

    const invalidTeams = [
      ...new Set(allTeams.filter((team) => !validTeams.has(team))),
    ];

    if (invalidTeams.length > 0) {
      return res.status(400).json({
        error: `Invalid teams: ${invalidTeams.join(", ")}`,
      });
    }

    // ============================================
    // SAVE
    // ============================================

    await pool.query(
      `
      INSERT INTO doubleelim_predictions (
        guild_id,
        event_id,
        user_id,
        username,
        displayname,
        upper_final_a,
        lower_final_a,
        upper_final_b,
        lower_final_b,
        active,
        submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)

      ON DUPLICATE KEY UPDATE
        event_id = VALUES(event_id),
        username = VALUES(username),
        displayname = VALUES(displayname),
        upper_final_a = VALUES(upper_final_a),
        lower_final_a = VALUES(lower_final_a),
        upper_final_b = VALUES(upper_final_b),
        lower_final_b = VALUES(lower_final_b),
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        event.guild_id,
        currentEventId,
        userId,
        req.session.user?.username || userId,
        req.session.user?.global_name || req.session.user?.username || userId,
        ufa.join(", "),
        lfa.join(", "),
        ufb.join(", "),
        lfb.join(", "),
      ],
    );

    res.json({
      ok: true,

      prediction: {
        upper_final_a: ufa,
        lower_final_a: lfa,
        upper_final_b: ufb,
        lower_final_b: lfb,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Nie udało się zapisać typów Double Elimination.",
    });
  }
});

app.get("/api/public/archives/:id/download", async (req, res) => {
  try {
    const { id } = req.params;

    const [[archive]] = await pool.query(
      `
            SELECT *
            FROM archive_files
            WHERE id = ?
            LIMIT 1
            `,
      [id],
    );

    if (!archive) {
      return res.status(404).json({
        error: "Archive not found",
      });
    }

    const dbPath = archive.path;

    const rebuiltPath = path.join(
      process.cwd(),
      "archiwum",
      String(archive.guild_id),
      archive.filename,
    );

    const finalPath = fs.existsSync(dbPath) ? dbPath : rebuiltPath;

    if (!fs.existsSync(finalPath)) {
      return res.status(404).json({
        error: "Archive file missing",
      });
    }

    return res.download(finalPath, archive.filename);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Download failed",
    });
  }
});

app.post(
  "/api/matches/:matchId/start",
  requireGuildAdmin(async (req) => {
    const { matchId } = req.params;

    const [[match]] = await pool.query(
      `
      SELECT guild_id
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId],
    );

    return match?.guild_id || null;
  }),
  async (req, res) => {
    try {
      const { matchId } = req.params;
      const { startTimeUtc } = req.body;

      const [[match]] = await pool.query(
        `
        SELECT id, guild_id, team_a, team_b
        FROM matches
        WHERE id = ?
        LIMIT 1
        `,
        [matchId],
      );

      if (!match) {
        return res.status(404).json({
          error: "Nie znaleziono meczu.",
        });
      }

      const startDate = startTimeUtc ? new Date(startTimeUtc) : null;

      if (startDate && Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          error: "Invalid start time",
        });
      }

      const lockBeforeSec = getLockBeforeSec();

      const shouldLock =
        startDate !== null &&
        isMatchStarted({ start_time_utc: startDate }, undefined, lockBeforeSec);

      await pool.query(
        `
  UPDATE matches
  SET
    start_time_utc = ?,
    is_locked = ?
  WHERE id = ?
  `,
        [startDate, shouldLock ? 1 : 0, matchId],
      );

      res.json({
        ok: true,
        match: {
          id: match.id,
          start_time_utc: startTimeUtc || null,
        },
      });
    } catch (err) {
      console.error(err);

      res.status(500).json({
        error: "Błąd bazy danych.",
      });
    }
  },
);

// Serve the built web/ frontend (npm run build -> web/dist) as static files
// in production, so one process/port handles both the API and the SPA -
// no separate web host, no second exposed port, no cross-origin cookies.
// Registered last so it never shadows an /api/* route above. The wildcard
// only needs to exclude /api and /socket.io - everything else is a client
// side route handled by React Router, so it always falls back to index.html.
if (IS_PRODUCTION) {
  const webDist = path.join(__dirname, "../web/dist");
  const indexHtmlPath = path.join(webDist, "index.html");

  const escapeHtml = (s) =>
    String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  // index: false so "/" also goes through the wildcard below - one code
  // path for every HTML response, static only serves real asset files.
  app.use(express.static(webDist, { index: false }));

  app.get(/^(?!\/api|\/socket\.io).*/, async (req, res) => {
    // Discord/messengers build link previews from the raw HTML without
    // running JS, so event pages get their og:title/description injected
    // server-side; every other route falls back to the default tags.
    try {
      const eventMatch = req.path.match(/^\/public\/event\/([^/]+)/);

      if (eventMatch) {
        const [[event]] = await pool.query(
          "SELECT name FROM events WHERE slug = ? LIMIT 1",
          [decodeURIComponent(eventMatch[1])],
        );

        if (event) {
          const title = escapeHtml(`${event.name} — Pick'Em`);
          const description = escapeHtml(
            `Typuj mecze i śledź ranking eventu ${event.name}.`,
          );

          const html = fs
            .readFileSync(indexHtmlPath, "utf8")
            .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
            .replace(
              /(<meta property="og:title" content=")[^"]*(")/,
              `$1${title}$2`,
            )
            .replace(
              /(<meta name="description" content=")[^"]*(")/,
              `$1${description}$2`,
            )
            .replace(
              /(<meta property="og:description" content=")[^"]*(")/,
              `$1${description}$2`,
            );

          return res.send(html);
        }
      }
    } catch (err) {
      console.error(err);
    }

    res.sendFile(indexHtmlPath);
  });
}

const PORT = Number(process.env.PORT || 3301);

httpServer.listen(PORT, () => {
  console.log(`WEB SERWER DZIAŁA NA http://localhost:${PORT}`);
});

startCs2LogReceiver({
  port: Number(process.env.CS2_LOG_PORT || 27500),
  onLine(raw) {
    const parsed = parseCs2LogLine(raw);

    if (!parsed) return;

    console.log("[CS2 PARSED]", parsed);
  },
});

app.get("/api/public/events/:slug/players/:userId", async (req, res) => {
  try {
    const { slug, userId } = req.params;

    const [[event]] = await pool.query(
      `
        SELECT
          id,
          guild_id,
          name,
          slug
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const [[userProfile]] = await pool.query(
      `
        SELECT
          user_id,
          displayname,
          username,
          avatar
        FROM user_profiles
        WHERE user_id = ?
        LIMIT 1
        `,
      [userId],
    );

    /*
     * Punkty dla tego eventu.
     * match_points może mieć kilka rekordów dla jednego meczu,
     * np. source = series i source = map.
     */
    const [[pointsStats]] = await pool.query(
      `
        SELECT
          COALESCE(SUM(points), 0) AS total_points,

          COALESCE(
            SUM(
              CASE
                WHEN source = 'series'
                THEN points
                ELSE 0
              END
            ),
            0
          ) AS series_points,

          COALESCE(
            SUM(
              CASE
                WHEN source = 'map'
                THEN points
                ELSE 0
              END
            ),
            0
          ) AS map_points

        FROM match_points
        WHERE event_id = ?
          AND user_id = ?
        `,
      [event.id, userId],
    );

    /*
     * Statystyki typów serii.
     */
    const [[predictionStats]] = await pool.query(
      `
        SELECT
          COUNT(*) AS total_predictions,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
              THEN 1
              ELSE 0
            END
          ) AS finished_predictions,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND (
                 (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
                 OR
                 (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
               )
              THEN 1
              ELSE 0
            END
          ) AS correct_winners,

          SUM(
            CASE
              WHEN mr.match_id IS NOT NULL
               AND mp.pred_a = mr.res_a
               AND mp.pred_b = mr.res_b
              THEN 1
              ELSE 0
            END
          ) AS exact_series

        FROM match_predictions mp

        LEFT JOIN match_results mr
          ON mr.event_id = mp.event_id
         AND mr.match_id = mp.match_id

        WHERE mp.event_id = ?
          AND mp.user_id = ?
        `,
      [event.id, userId],
    );

    /*
     * Statystyki map.
     */
    const [[mapStats]] = await pool.query(
      `
        SELECT
          COUNT(*) AS predicted_maps,

          SUM(
            CASE
              WHEN mmr.match_id IS NOT NULL
               AND (
                 (
                   mmp.pred_exact_a > mmp.pred_exact_b
                   AND mmr.exact_a > mmr.exact_b
                 )
                 OR
                 (
                   mmp.pred_exact_b > mmp.pred_exact_a
                   AND mmr.exact_b > mmr.exact_a
                 )
               )
              THEN 1
              ELSE 0
            END
          ) AS correct_maps,

          SUM(
            CASE
              WHEN mmr.match_id IS NOT NULL
               AND mmp.pred_exact_a = mmr.exact_a
               AND mmp.pred_exact_b = mmr.exact_b
              THEN 1
              ELSE 0
            END
          ) AS exact_maps

        FROM match_map_predictions mmp

        LEFT JOIN match_map_results mmr
          ON mmr.event_id = mmp.event_id
         AND mmr.match_id = mmp.match_id
         AND mmr.map_no = mmp.map_no

        WHERE mmp.event_id = ?
          AND mmp.user_id = ?
        `,
      [event.id, userId],
    );

    /*
     * Pozycja gracza w samym tym evencie.
     *
     * Klasyfikacja idzie z tabeli `leaderboard` - tej samej, ktora karmi
     * strone "Ranking graczy", bota i eksport. Wczesniej bylo tu osobne
     * ROW_NUMBER() liczone z samych match_points i tylko wsrod typujacych
     * mecze. Przez to profil pokazywal miejsce nawet wtedy, gdy w rankingu
     * eventu nie bylo jeszcze nikogo, i pomijal punkty ze Swiss, Playoffs,
     * Play-In, Double Elim oraz MVP.
     */
    const [[rankRow]] = await pool.query(
      `
  SELECT ranked.rank_position
  FROM (
    SELECT
      CAST(user_id AS CHAR CHARACTER SET utf8mb4)
        COLLATE utf8mb4_unicode_ci AS user_id,

      ROW_NUMBER() OVER (
        ORDER BY
          COALESCE(total_points, 0) DESC,
          user_id ASC
      ) AS rank_position

    FROM leaderboard
    WHERE event_id = ?
  ) ranked

  WHERE ranked.user_id = ?

  LIMIT 1
  `,
      [event.id, userId],
    );

    const totalPredictions = Number(predictionStats?.finished_predictions || 0);

    const correctWinners = Number(predictionStats?.correct_winners || 0);

    const [recentPredictions] = await pool.query(
      `
  SELECT
    mp.match_id,
    mp.pred_a,
    mp.pred_b,

    mr.res_a,
    mr.res_b,

    m.team_a,
    m.team_b,

    COALESCE(SUM(pts.points), 0) AS points

  FROM match_predictions mp

  INNER JOIN matches m
    ON m.id = mp.match_id
   AND m.event_id = mp.event_id

  LEFT JOIN match_results mr
    ON mr.match_id = mp.match_id
   AND mr.event_id = mp.event_id

  LEFT JOIN match_points pts
    ON pts.match_id = mp.match_id
   AND pts.event_id = mp.event_id
   AND pts.user_id = mp.user_id

  WHERE mp.event_id = ?
    AND mp.user_id = ?

  GROUP BY
    mp.match_id,
    mp.pred_a,
    mp.pred_b,
    mr.res_a,
    mr.res_b,
    m.team_a,
    m.team_b

  ORDER BY mp.match_id DESC
  LIMIT 10
  `,
      [event.id, userId],
    );

    const [recentMapPredictions] = await pool.query(
      `
  SELECT
    mmp.match_id,
    mmp.map_no,

    mmp.pred_exact_a,
    mmp.pred_exact_b,

    mmr.exact_a AS res_exact_a,
    mmr.exact_b AS res_exact_b

  FROM match_map_predictions mmp

  LEFT JOIN match_map_results mmr
    ON mmr.event_id = mmp.event_id
   AND mmr.match_id = mmp.match_id
   AND mmr.map_no = mmp.map_no

  WHERE mmp.event_id = ?
    AND mmp.user_id = ?

  ORDER BY
    mmp.match_id DESC,
    mmp.map_no ASC
  `,
      [event.id, userId],
    );

    const [[bestMatch]] = await pool.query(
      `
  SELECT
    match_id,
    SUM(points) AS points

  FROM match_points

  WHERE event_id = ?
    AND user_id = ?

  GROUP BY match_id

  ORDER BY
    points DESC,
    match_id ASC

  LIMIT 1
  `,
      [event.id, userId],
    );

    const [streakRows] = await pool.query(
      `
  SELECT
    mp.match_id,
    mp.pred_a,
    mp.pred_b,
    mr.res_a,
    mr.res_b,
    COALESCE(m.match_no, m.id) AS sort_order

  FROM match_predictions mp

  INNER JOIN match_results mr
    ON mr.event_id = mp.event_id
   AND mr.match_id = mp.match_id

  INNER JOIN matches m
    ON m.id = mp.match_id
   AND m.event_id = mp.event_id

  WHERE mp.event_id = ?
    AND mp.user_id = ?

  ORDER BY
    sort_order ASC,
    mp.match_id ASC
  `,
      [event.id, userId],
    );

    let currentCorrectStreak = 0;
    let bestCorrectStreak = 0;

    for (const row of streakRows) {
      const correct =
        (Number(row.pred_a) > Number(row.pred_b) &&
          Number(row.res_a) > Number(row.res_b)) ||
        (Number(row.pred_b) > Number(row.pred_a) &&
          Number(row.res_b) > Number(row.res_a));

      if (correct) {
        currentCorrectStreak += 1;

        if (currentCorrectStreak > bestCorrectStreak) {
          bestCorrectStreak = currentCorrectStreak;
        }
      } else {
        currentCorrectStreak = 0;
      }
    }

    const [perfectMatchRows] = await pool.query(
      `
  SELECT
    mp.match_id,
    mp.pred_a,
    mp.pred_b,
    mr.res_a,
    mr.res_b,

    COUNT(mmp.map_no) AS predicted_maps,

    SUM(
      CASE
        WHEN mmr.match_id IS NOT NULL
         AND mmp.pred_exact_a = mmr.exact_a
         AND mmp.pred_exact_b = mmr.exact_b
        THEN 1
        ELSE 0
      END
    ) AS exact_maps

  FROM match_predictions mp

  INNER JOIN match_results mr
    ON mr.event_id = mp.event_id
   AND mr.match_id = mp.match_id

  LEFT JOIN match_map_predictions mmp
    ON mmp.event_id = mp.event_id
   AND mmp.match_id = mp.match_id
   AND mmp.user_id = mp.user_id

  LEFT JOIN match_map_results mmr
    ON mmr.event_id = mmp.event_id
   AND mmr.match_id = mmp.match_id
   AND mmr.map_no = mmp.map_no

  WHERE mp.event_id = ?
    AND mp.user_id = ?

  GROUP BY
    mp.match_id,
    mp.pred_a,
    mp.pred_b,
    mr.res_a,
    mr.res_b
  `,
      [event.id, userId],
    );

    let perfectMatches = 0;

    for (const row of perfectMatchRows) {
      const exactSeries =
        Number(row.pred_a) === Number(row.res_a) &&
        Number(row.pred_b) === Number(row.res_b);

      const predictedMaps = Number(row.predicted_maps || 0);
      const exactMaps = Number(row.exact_maps || 0);

      const allMapsExact = predictedMaps > 0 && predictedMaps === exactMaps;

      if (exactSeries && allMapsExact) {
        perfectMatches += 1;
      }
    }

    const [[bestMapMatch]] = await pool.query(
      `
  SELECT
    match_id,
    SUM(points) AS points

  FROM match_points

  WHERE event_id = ?
    AND user_id = ?
    AND source = 'map'

  GROUP BY match_id

  ORDER BY
    points DESC,
    match_id ASC

  LIMIT 1
  `,
      [event.id, userId],
    );

    const [[correctMatchPointsStats]] = await pool.query(
      `
  SELECT
    COALESCE(AVG(match_total_points), 0) AS average_points

  FROM (
    SELECT
      mp.match_id,
      COALESCE(SUM(mpts.points), 0) AS match_total_points

    FROM match_predictions mp

    INNER JOIN match_results mr
      ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    LEFT JOIN match_points mpts
      ON mpts.event_id = mp.event_id
     AND mpts.match_id = mp.match_id
     AND mpts.user_id = mp.user_id

    WHERE mp.event_id = ?
      AND mp.user_id = ?

      AND (
        (
          mp.pred_a > mp.pred_b
          AND mr.res_a > mr.res_b
        )
        OR
        (
          mp.pred_b > mp.pred_a
          AND mr.res_b > mr.res_a
        )
      )

    GROUP BY mp.match_id
  ) correct_matches
  `,
      [event.id, userId],
    );

    const [eventComparisonRows] = await pool.query(
      `
  SELECT
    users.user_id,

    COALESCE(points.total_points, 0) AS total_points,

    COALESCE(preds.correct_winners, 0) AS correct_winners,
    COALESCE(preds.finished_predictions, 0) AS finished_predictions,

    COALESCE(maps.correct_maps, 0) AS correct_maps,
    COALESCE(maps.exact_maps, 0) AS exact_maps

  FROM (
    SELECT DISTINCT user_id
    FROM match_predictions
    WHERE event_id = ?
  ) users

  LEFT JOIN (
    SELECT
      user_id,
      SUM(points) AS total_points
    FROM match_points
    WHERE event_id = ?
    GROUP BY user_id
  ) points
    ON points.user_id = users.user_id

  LEFT JOIN (
    SELECT
      mp.user_id,

      COUNT(DISTINCT mp.match_id) AS finished_predictions,

      COUNT(
        DISTINCT CASE
          WHEN (
            (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
            OR
            (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
          )
          THEN mp.match_id
          ELSE NULL
        END
      ) AS correct_winners

    FROM match_predictions mp

    INNER JOIN match_results mr
      ON mr.event_id = mp.event_id
     AND mr.match_id = mp.match_id

    WHERE mp.event_id = ?

    GROUP BY mp.user_id
  ) preds
    ON preds.user_id = users.user_id

  LEFT JOIN (
    SELECT
      mmp.user_id,

      SUM(
        CASE
          WHEN (
            (mmp.pred_exact_a > mmp.pred_exact_b AND mmr.exact_a > mmr.exact_b)
            OR
            (mmp.pred_exact_b > mmp.pred_exact_a AND mmr.exact_b > mmr.exact_a)
          )
          THEN 1
          ELSE 0
        END
      ) AS correct_maps,

      SUM(
        CASE
          WHEN mmp.pred_exact_a = mmr.exact_a
           AND mmp.pred_exact_b = mmr.exact_b
          THEN 1
          ELSE 0
        END
      ) AS exact_maps

    FROM match_map_predictions mmp

    INNER JOIN match_map_results mmr
      ON mmr.event_id = mmp.event_id
     AND mmr.match_id = mmp.match_id
     AND mmr.map_no = mmp.map_no

    WHERE mmp.event_id = ?

    GROUP BY mmp.user_id
  ) maps
    ON maps.user_id = users.user_id
  `,
      [event.id, event.id, event.id, event.id],
    );

    const comparisonPlayers = eventComparisonRows.map((row) => {
      const finished = Number(row.finished_predictions || 0);
      const correct = Number(row.correct_winners || 0);

      return {
        user_id: String(row.user_id),

        points: Number(row.total_points || 0),

        accuracy: finished > 0 ? (correct / finished) * 100 : 0,

        exact_maps: Number(row.exact_maps || 0),
        correct_maps: Number(row.correct_maps || 0),
      };
    });

    function getComparison(metric, value) {
      const total = comparisonPlayers.length;

      if (total === 0) {
        return {
          rank: 0,
          total: 0,
          top_percent: 0,
        };
      }

      const better = comparisonPlayers.filter(
        (player) => player[metric] > value,
      ).length;

      const rank = better + 1;

      return {
        rank,
        total,

        top_percent: Math.max(1, Math.ceil((rank / total) * 100)),
      };
    }

    const playerComparison = comparisonPlayers.find(
      (row) => row.user_id === String(userId),
    );

    const eventComparison = playerComparison
      ? {
        points: getComparison("points", playerComparison.points),

        accuracy: getComparison("accuracy", playerComparison.accuracy),

        exact_maps: getComparison("exact_maps", playerComparison.exact_maps),

        correct_maps: getComparison(
          "correct_maps",
          playerComparison.correct_maps,
        ),
      }
      : null;

    const [balancedMatchRows] = await pool.query(
      `
  SELECT
    m.id AS match_id,
    m.team_a,
    m.team_b,
    m.phase,
    m.best_of,
    m.is_locked,
    m.lock_override,

    COUNT(mp.user_id) AS total_picks,

    SUM(
      CASE
        WHEN mp.pred_a > mp.pred_b THEN 1
        ELSE 0
      END
    ) AS team_a_picks,

    SUM(
      CASE
        WHEN mp.pred_b > mp.pred_a THEN 1
        ELSE 0
      END
    ) AS team_b_picks,

    CASE
      WHEN mr.match_id IS NOT NULL THEN 1
      ELSE 0
    END AS finished

  FROM matches m

  INNER JOIN match_predictions mp
    ON mp.event_id = m.event_id
   AND mp.match_id = m.id

  LEFT JOIN match_results mr
    ON mr.event_id = m.event_id
   AND mr.match_id = m.id

  WHERE m.event_id = ?

  GROUP BY
    m.id,
    m.team_a,
    m.team_b,
    m.phase,
    m.best_of,
    m.is_locked,
    m.lock_override,
    mr.match_id
  `,
      [event.id],
    );

    const balancedCandidates = [];

    for (const row of balancedMatchRows) {
      let locked = Number(row.finished) === 1;
      let forceOpen = false;

      if (!locked) {
        const gate = await assertPredictionsAllowed({
          guildId: event.guild_id,
          kind: "MATCHES",
        });

        if (!gate.allowed) {
          locked = true;
        }
      }

      if (!locked && Number(row.lock_override) === 1) {
        locked = true;
      }

      if (
        !locked &&
        row.lock_override !== null &&
        Number(row.lock_override) === 0
      ) {
        forceOpen = true;
      }

      if (!locked && !forceOpen && Number(row.is_locked) === 1) {
        locked = true;
      }

      if (!locked && !forceOpen) {
        const matchPanelPhase = matchPanelPhaseFor(row.phase);

        if (matchPanelPhase) {
          const { passed } = await isMatchDeadlinePassed(
            pool,
            event.guild_id,
            matchPanelPhase,
          );

          if (passed) {
            locked = true;
          }
        }
      }

      if (!locked) {
        continue;
      }

      const total = Number(row.total_picks || 0);

      if (total === 0) {
        continue;
      }

      const teamA = Number(row.team_a_picks || 0);
      const teamB = Number(row.team_b_picks || 0);

      const teamAPercentage = Math.round((teamA / total) * 100);

      const teamBPercentage = 100 - teamAPercentage;

      balancedCandidates.push({
        match_id: Number(row.match_id),
        team_a: row.team_a,
        team_b: row.team_b,
        best_of: Number(row.best_of || 0),

        total_picks: total,

        team_a_picks: teamA,
        team_b_picks: teamB,

        team_a_percentage: teamAPercentage,
        team_b_percentage: teamBPercentage,

        difference: Math.abs(teamAPercentage - teamBPercentage),
      });
    }

    balancedCandidates.sort((a, b) => {
      if (a.difference !== b.difference) {
        return a.difference - b.difference;
      }

      if (b.total_picks !== a.total_picks) {
        return b.total_picks - a.total_picks;
      }

      return a.match_id - b.match_id;
    });

    const closestMatch = balancedCandidates[0] || null;

    res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
      },

      profile: {
        best_match_points: Number(bestMatch?.points || 0),
        best_correct_streak: bestCorrectStreak,
        current_correct_streak: currentCorrectStreak,
        perfect_matches: perfectMatches,
        best_map_match_points: Number(bestMapMatch?.points || 0),
        average_points_correct_match: Number(
          Number(correctMatchPointsStats?.average_points || 0).toFixed(1),
        ),
        event_comparison: eventComparison,
        user_id: userId,

        recent_predictions: recentPredictions.map((row) => {
          const maps = recentMapPredictions
            .filter((map) => Number(map.match_id) === Number(row.match_id))
            .map((map) => {
              const predA = Number(map.pred_exact_a);
              const predB = Number(map.pred_exact_b);

              const resultA =
                map.res_exact_a !== null ? Number(map.res_exact_a) : null;

              const resultB =
                map.res_exact_b !== null ? Number(map.res_exact_b) : null;

              const finished = resultA !== null && resultB !== null;

              const exact = finished && predA === resultA && predB === resultB;

              const correctWinner =
                finished &&
                ((predA > predB && resultA > resultB) ||
                  (predB > predA && resultB > resultA));

              return {
                map_no: Number(map.map_no),

                pred_a: predA,
                pred_b: predB,

                res_a: resultA,
                res_b: resultB,

                finished,
                exact,
                correct_winner: correctWinner,
              };
            });

          return {
            match_id: row.match_id,

            team_a: row.team_a,
            team_b: row.team_b,

            pred_a: Number(row.pred_a),
            pred_b: Number(row.pred_b),

            res_a: row.res_a !== null ? Number(row.res_a) : null,

            res_b: row.res_b !== null ? Number(row.res_b) : null,

            points: Number(row.points || 0),

            maps,
          };
        }),

        displayname:
          userProfile?.displayname || userProfile?.username || userId,

        avatar: userProfile?.avatar || null,

        // null, a nie 0 - brak wiersza znaczy "jeszcze nie sklasyfikowany",
        // co front pokazuje jako "-", zamiast zmyslac pozycje.
        rank: rankRow ? Number(rankRow.rank_position) : null,

        total_points: Number(pointsStats?.total_points || 0),

        series_points: Number(pointsStats?.series_points || 0),

        map_points: Number(pointsStats?.map_points || 0),

        total_predictions: Number(predictionStats?.total_predictions || 0),

        finished_predictions: totalPredictions,

        correct_winners: correctWinners,

        exact_series: Number(predictionStats?.exact_series || 0),

        predicted_maps: Number(mapStats?.predicted_maps || 0),

        correct_maps: Number(mapStats?.correct_maps || 0),

        exact_maps: Number(mapStats?.exact_maps || 0),

        accuracy:
          totalPredictions > 0
            ? Math.round((correctWinners / totalPredictions) * 100)
            : 0,
      },
    });
  } catch (err) {
    console.error("EVENT PLAYER PROFILE ERROR:", err);

    res.status(500).json({
      error: "Event player profile load failed",
    });
  }
});

app.get("/api/events/:slug/stats", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[event]] = await pool.query(
      `
      SELECT id
      FROM events
      WHERE slug = ?
      LIMIT 1
      `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    /*
     * Uczestnicy + liczba typów meczów
     */
    const [[predictionStats]] = await pool.query(
      `
      SELECT
        COUNT(DISTINCT user_id) AS participants,
        COUNT(*) AS total_predictions
      FROM match_predictions
      WHERE event_id = ?
      `,
      [event.id],
    );

    /*
     * Typy map
     */
    const [[mapPredictionStats]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_map_predictions
      FROM match_map_predictions
      WHERE event_id = ?
      `,
      [event.id],
    );

    /*
     * Średnia punktów i najlepszy wynik.
     */
    const [[pointsStats]] = await pool.query(
      `
      SELECT
        COALESCE(AVG(player_points), 0) AS average_points,
        COALESCE(MAX(player_points), 0) AS best_score
      FROM (
        SELECT
          user_id,
          SUM(points) AS player_points
        FROM match_points
        WHERE event_id = ?
        GROUP BY user_id
      ) scores
      `,
      [event.id],
    );

    /*
     * Najlepszy gracz punktowo.
     */
    const [[bestPlayer]] = await pool.query(
      `
      SELECT
        mp.user_id,

        COALESCE(
          up.displayname,
          up.username,
          mp.user_id
        ) AS displayname,

        SUM(mp.points) AS total_points

      FROM match_points mp

      LEFT JOIN user_profiles up
        ON up.user_id COLLATE utf8mb4_unicode_ci
         = mp.user_id COLLATE utf8mb4_unicode_ci

      WHERE mp.event_id = ?

      GROUP BY
        mp.user_id,
        up.displayname,
        up.username

      ORDER BY
        total_points DESC,
        mp.user_id ASC

      LIMIT 1
      `,
      [event.id],
    );

    /*
     * Łączna liczba exactów map.
     */
    const [[exactStats]] = await pool.query(
      `
      SELECT
        COUNT(*) AS exact_maps
      FROM match_map_predictions mmp

      INNER JOIN match_map_results mmr
        ON mmr.event_id = mmp.event_id
       AND mmr.match_id = mmp.match_id
       AND mmr.map_no = mmp.map_no

      WHERE mmp.event_id = ?
        AND mmp.pred_exact_a = mmr.exact_a
        AND mmp.pred_exact_b = mmr.exact_b
      `,
      [event.id],
    );

    /*
     * Gracz z największą liczbą exactów map.
     */
    const [[bestExactPlayer]] = await pool.query(
      `
      SELECT
        mmp.user_id,

        COALESCE(
          up.displayname,
          up.username,
          mmp.user_id
        ) AS displayname,

        COUNT(*) AS exact_maps

      FROM match_map_predictions mmp

      INNER JOIN match_map_results mmr
        ON mmr.event_id = mmp.event_id
       AND mmr.match_id = mmp.match_id
       AND mmr.map_no = mmp.map_no

      LEFT JOIN user_profiles up
        ON up.user_id COLLATE utf8mb4_unicode_ci
         = mmp.user_id COLLATE utf8mb4_unicode_ci

      WHERE mmp.event_id = ?
        AND mmp.pred_exact_a = mmr.exact_a
        AND mmp.pred_exact_b = mmr.exact_b

      GROUP BY
        mmp.user_id,
        up.displayname,
        up.username

      ORDER BY
        exact_maps DESC,
        mmp.user_id ASC

      LIMIT 1
      `,
      [event.id],
    );

    const [[bestAccuracyPlayer]] = await pool.query(
      `
  SELECT
    mp.user_id,

    COALESCE(
      up.displayname,
      up.username,
      mp.user_id
    ) AS displayname,

    COUNT(DISTINCT mp.match_id) AS finished_predictions,

    COUNT(
      DISTINCT CASE
        WHEN (
          (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
          OR
          (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
        )
        THEN mp.match_id
        ELSE NULL
      END
    ) AS correct_winners,

    ROUND(
      COUNT(
        DISTINCT CASE
          WHEN (
            (mp.pred_a > mp.pred_b AND mr.res_a > mr.res_b)
            OR
            (mp.pred_b > mp.pred_a AND mr.res_b > mr.res_a)
          )
          THEN mp.match_id
          ELSE NULL
        END
      )
      / COUNT(DISTINCT mp.match_id) * 100,
      1
    ) AS accuracy

  FROM match_predictions mp

  INNER JOIN match_results mr
    ON mr.event_id = mp.event_id
   AND mr.match_id = mp.match_id

  LEFT JOIN user_profiles up
    ON up.user_id COLLATE utf8mb4_unicode_ci
     = mp.user_id COLLATE utf8mb4_unicode_ci

  WHERE mp.event_id = ?

  GROUP BY
    mp.user_id,
    up.displayname,
    up.username

  HAVING finished_predictions >= GREATEST(
    1,
    CEIL(
      (
        SELECT COUNT(DISTINCT mr2.match_id)
        FROM match_results mr2
        WHERE mr2.event_id = ?
      ) * 0.5
    )
  )

  ORDER BY
    accuracy DESC,
    correct_winners DESC,
    finished_predictions DESC,
    mp.user_id ASC

  LIMIT 1
  `,
      [event.id, event.id],
    );

    const [[favoriteTeam]] = await pool.query(
      `
  SELECT
    picked_team AS team,
    COUNT(*) AS picks
  FROM (
    SELECT
      CASE
        WHEN pred_a > pred_b THEN m.team_a
        WHEN pred_b > pred_a THEN m.team_b
        ELSE NULL
      END AS picked_team

    FROM match_predictions mp

    INNER JOIN matches m
      ON m.id = mp.match_id
     AND m.event_id = mp.event_id

    WHERE mp.event_id = ?
  ) picks

  WHERE picked_team IS NOT NULL

  GROUP BY picked_team

  ORDER BY
    picks DESC,
    picked_team ASC

  LIMIT 1
  `,
      [event.id],
    );

    const [balancedMatchRows] = await pool.query(
      `
  SELECT
    m.id AS match_id,
    m.team_a,
    m.team_b,
    m.phase,
    m.best_of,
    m.is_locked,
    m.lock_override,

    COUNT(mp.user_id) AS total_picks,

    SUM(
      CASE
        WHEN mp.pred_a > mp.pred_b THEN 1
        ELSE 0
      END
    ) AS team_a_picks,

    SUM(
      CASE
        WHEN mp.pred_b > mp.pred_a THEN 1
        ELSE 0
      END
    ) AS team_b_picks,

    CASE
      WHEN mr.match_id IS NOT NULL THEN 1
      ELSE 0
    END AS finished

  FROM matches m

  INNER JOIN match_predictions mp
    ON mp.event_id = m.event_id
   AND mp.match_id = m.id

  LEFT JOIN match_results mr
    ON mr.event_id = m.event_id
   AND mr.match_id = m.id

  WHERE m.event_id = ?

  GROUP BY
    m.id,
    m.team_a,
    m.team_b,
    m.phase,
    m.best_of,
    m.is_locked,
    m.lock_override,
    mr.match_id
  `,
      [event.id],
    );

    const balancedCandidates = [];

    for (const row of balancedMatchRows) {
      let locked = Number(row.finished) === 1;
      let forceOpen = false;

      if (!locked) {
        const gate = await assertPredictionsAllowed({
          guildId: event.guild_id,
          kind: "MATCHES",
        });

        if (!gate.allowed) {
          locked = true;
        }
      }

      if (!locked && Number(row.lock_override) === 1) {
        locked = true;
      }

      if (
        !locked &&
        row.lock_override !== null &&
        Number(row.lock_override) === 0
      ) {
        forceOpen = true;
      }

      if (!locked && !forceOpen && Number(row.is_locked) === 1) {
        locked = true;
      }

      if (!locked && !forceOpen) {
        const matchPanelPhase = matchPanelPhaseFor(row.phase);

        if (matchPanelPhase) {
          const { passed } = await isMatchDeadlinePassed(
            pool,
            event.guild_id,
            matchPanelPhase,
          );

          if (passed) {
            locked = true;
          }
        }
      }

      if (!locked) {
        continue;
      }

      const total = Number(row.total_picks || 0);

      if (total === 0) {
        continue;
      }

      const teamA = Number(row.team_a_picks || 0);
      const teamB = Number(row.team_b_picks || 0);

      const teamAPercentage = Math.round((teamA / total) * 100);

      const teamBPercentage = 100 - teamAPercentage;

      balancedCandidates.push({
        match_id: Number(row.match_id),
        team_a: row.team_a,
        team_b: row.team_b,
        best_of: Number(row.best_of || 0),

        total_picks: total,

        team_a_picks: teamA,
        team_b_picks: teamB,

        team_a_percentage: teamAPercentage,
        team_b_percentage: teamBPercentage,

        difference: Math.abs(teamAPercentage - teamBPercentage),
      });
    }

    balancedCandidates.sort((a, b) => {
      if (a.difference !== b.difference) {
        return a.difference - b.difference;
      }

      if (b.total_picks !== a.total_picks) {
        return b.total_picks - a.total_picks;
      }

      return a.match_id - b.match_id;
    });

    const closestMatch = balancedCandidates[0] || null;

    const [upsetRows] = await pool.query(
      `
  SELECT
    m.id AS match_id,
    m.team_a,
    m.team_b,
    m.best_of,

    mr.res_a,
    mr.res_b,

    COUNT(mp.user_id) AS total_picks,

    SUM(
      CASE
        WHEN mp.pred_a > mp.pred_b THEN 1
        ELSE 0
      END
    ) AS team_a_picks,

    SUM(
      CASE
        WHEN mp.pred_b > mp.pred_a THEN 1
        ELSE 0
      END
    ) AS team_b_picks

  FROM matches m

  INNER JOIN match_results mr
    ON mr.event_id = m.event_id
   AND mr.match_id = m.id

  INNER JOIN match_predictions mp
    ON mp.event_id = m.event_id
   AND mp.match_id = m.id

  WHERE m.event_id = ?

  GROUP BY
    m.id,
    m.team_a,
    m.team_b,
    m.best_of,
    mr.res_a,
    mr.res_b
  `,
      [event.id],
    );

    const upsetCandidates = upsetRows
      .map((row) => {
        const total = Number(row.total_picks || 0);

        if (total === 0) {
          return null;
        }

        const teamAPicks = Number(row.team_a_picks || 0);
        const teamBPicks = Number(row.team_b_picks || 0);

        const teamAWon = Number(row.res_a) > Number(row.res_b);

        const winnerPicks = teamAWon ? teamAPicks : teamBPicks;

        const winnerPercentage = Math.round((winnerPicks / total) * 100);

        return {
          match_id: Number(row.match_id),

          team_a: row.team_a,
          team_b: row.team_b,

          best_of: Number(row.best_of || 0),

          res_a: Number(row.res_a),
          res_b: Number(row.res_b),

          winner: teamAWon ? row.team_a : row.team_b,

          total_picks: total,

          team_a_picks: teamAPicks,
          team_b_picks: teamBPicks,

          team_a_percentage: Math.round((teamAPicks / total) * 100),

          team_b_percentage: Math.round((teamBPicks / total) * 100),

          winner_percentage: winnerPercentage,
        };
      })
      .filter(Boolean);

    upsetCandidates.sort((a, b) => {
      if (a.winner_percentage !== b.winner_percentage) {
        return a.winner_percentage - b.winner_percentage;
      }

      return b.total_picks - a.total_picks;
    });

    const biggestUpset = upsetCandidates[0] || null;

    res.json({
      stats: {
        participants: Number(predictionStats?.participants || 0),

        closest_match: closestMatch,
        biggest_upset: biggestUpset,

        total_predictions: Number(predictionStats?.total_predictions || 0),

        total_map_predictions: Number(
          mapPredictionStats?.total_map_predictions || 0,
        ),

        average_points: Number(
          Number(pointsStats?.average_points || 0).toFixed(1),
        ),

        exact_maps: Number(exactStats?.exact_maps || 0),

        best_score: Number(pointsStats?.best_score || 0),
        favorite_team: favoriteTeam
          ? {
            team: favoriteTeam.team,
            picks: Number(favoriteTeam.picks || 0),
          }
          : null,

        best_player: bestPlayer
          ? {
            user_id: bestPlayer.user_id,
            displayname: bestPlayer.displayname,
            points: Number(bestPlayer.total_points || 0),
          }
          : null,

        best_exact_player: bestExactPlayer
          ? {
            user_id: bestExactPlayer.user_id,
            displayname: bestExactPlayer.displayname,
            exact_maps: Number(bestExactPlayer.exact_maps || 0),
          }
          : null,

        best_accuracy_player: bestAccuracyPlayer
          ? {
            user_id: bestAccuracyPlayer.user_id,
            displayname: bestAccuracyPlayer.displayname,
            accuracy: Number(bestAccuracyPlayer.accuracy || 0),
            correct_winners: Number(bestAccuracyPlayer.correct_winners || 0),
            finished_predictions: Number(
              bestAccuracyPlayer.finished_predictions || 0,
            ),
          }
          : null,
      },
    });
  } catch (err) {
    console.error("EVENT STATS ERROR:", err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/events/:slug/matches/:matchId/pick-stats", async (req, res) => {
  try {
    const { slug, matchId } = req.params;

    const [[event]] = await pool.query(
      `
  SELECT
    id,
    guild_id
  FROM events
  WHERE slug = ?
  LIMIT 1
  `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    const [[match]] = await pool.query(
      `
  SELECT
    id,
    phase,
    team_a,
    team_b,
    best_of,
    is_locked,
    lock_override
  FROM matches
  WHERE id = ?
    AND event_id = ?
  LIMIT 1
  `,
      [matchId, event.id],
    );

    if (!match) {
      return res.status(404).json({
        error: "Nie znaleziono meczu.",
      });
    }

    let locked = false;

    const [[resultRow]] = await pool.query(
      `
  SELECT match_id
  FROM match_results
  WHERE event_id = ?
    AND match_id = ?
  LIMIT 1
  `,
      [event.id, match.id],
    );

    // Wynik oficjalny = mecz zamknięty
    if (resultRow) {
      locked = true;
    }

    // Globalny gate
    if (!locked) {
      const gate = await assertPredictionsAllowed({
        guildId: event.guild_id,
        kind: "MATCHES",
      });

      if (!gate.allowed) {
        locked = true;
      }
    }

    // Wspólna logika locka z Discordem
    if (!locked && isMatchLocked(match)) {
      locked = true;
    }

    // Deadline fazy
    if (!locked) {
      const matchPanelPhase = matchPanelPhaseFor(match.phase);

      if (matchPanelPhase) {
        const { passed } = await isMatchDeadlinePassed(
          pool,
          event.guild_id,
          matchPanelPhase,
        );

        if (passed) {
          locked = true;
        }
      }
    }

    // Przed lockiem nie pokazujemy community stats
    if (!locked) {
      return res.json({
        locked: false,
      });
    }

    /*
     * Rozkład zwycięzców.
     */
    const [[winnerStats]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total_picks,

        SUM(
          CASE
            WHEN pred_a > pred_b THEN 1
            ELSE 0
          END
        ) AS team_a_picks,

        SUM(
          CASE
            WHEN pred_b > pred_a THEN 1
            ELSE 0
          END
        ) AS team_b_picks

      FROM match_predictions

      WHERE event_id = ?
        AND match_id = ?
      `,
      [event.id, match.id],
    );

    const totalPicks = Number(winnerStats?.total_picks || 0);

    const teamAPicks = Number(winnerStats?.team_a_picks || 0);

    const teamBPicks = Number(winnerStats?.team_b_picks || 0);

    /*
     * Najczęściej typowany dokładny wynik serii.
     */
    const [[popularScore]] = await pool.query(
      `
      SELECT
        pred_a,
        pred_b,
        COUNT(*) AS picks

      FROM match_predictions

      WHERE event_id = ?
        AND match_id = ?

      GROUP BY
        pred_a,
        pred_b

      ORDER BY
        picks DESC,
        pred_a DESC,
        pred_b DESC

      LIMIT 1
      `,
      [event.id, match.id],
    );

    const [mapPickRows] = await pool.query(
      `
  SELECT
    mmp.map_no,

    COUNT(*) AS total_picks,

    SUM(
      CASE
        WHEN mmp.pred_exact_a > mmp.pred_exact_b
        THEN 1
        ELSE 0
      END
    ) AS team_a_picks,

    SUM(
      CASE
        WHEN mmp.pred_exact_b > mmp.pred_exact_a
        THEN 1
        ELSE 0
      END
    ) AS team_b_picks

  FROM match_map_predictions mmp

  WHERE mmp.event_id = ?
    AND mmp.match_id = ?

  GROUP BY mmp.map_no

  ORDER BY mmp.map_no ASC
  `,
      [event.id, match.id],
    );

    const mapStats = mapPickRows.map((row) => {
      const total = Number(row.total_picks || 0);
      const teamA = Number(row.team_a_picks || 0);
      const teamB = Number(row.team_b_picks || 0);

      return {
        map_no: Number(row.map_no),

        total_picks: total,

        team_a: {
          picks: teamA,
          percentage: total > 0 ? Math.round((teamA / total) * 100) : 0,
        },

        team_b: {
          picks: teamB,
          percentage: total > 0 ? Math.round((teamB / total) * 100) : 0,
        },
      };
    });

    res.json({
      locked: true,

      maps: mapStats,

      match: {
        id: match.id,
        team_a: match.team_a,
        team_b: match.team_b,
        best_of: Number(match.best_of || 0),
      },

      picks: {
        total: totalPicks,

        team_a: {
          picks: teamAPicks,
          percentage:
            totalPicks > 0 ? Math.round((teamAPicks / totalPicks) * 100) : 0,
        },

        team_b: {
          picks: teamBPicks,
          percentage:
            totalPicks > 0 ? Math.round((teamBPicks / totalPicks) * 100) : 0,
        },
      },

      popular_score: popularScore
        ? {
          score_a: Number(popularScore.pred_a),
          score_b: Number(popularScore.pred_b),
          picks: Number(popularScore.picks),
        }
        : null,
    });
  } catch (err) {
    console.error("MATCH PICK STATS ERROR:", err);

    res.status(500).json({
      error: "Błąd bazy danych.",
    });
  }
});

app.get("/api/public/events/:slug/my-predictions/:phase", async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const { slug, phase } = req.params;

    const page = Math.max(0, Number(req.query.page) || 0);

    const PAGE_SIZE = 5;

    const [[event]] = await pool.query(
      `
        SELECT
          id,
          guild_id,
          name,
          slug
        FROM events
        WHERE slug = ?
        LIMIT 1
        `,
      [slug],
    );

    if (!event) {
      return res.status(404).json({
        error: "Nie znaleziono turnieju.",
      });
    }

    if (!isGuildMember(req.session.user, event.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    const [[countRow]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM matches
        WHERE guild_id = ?
          AND event_id = ?
          AND phase = ?
        `,
      [event.guild_id, event.id, phase],
    );

    const totalMatches = Number(countRow?.total || 0);

    const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

    const safePage = Math.min(page, totalPages - 1);

    const offset = safePage * PAGE_SIZE;

    const [matches] = await pool.query(
      `
        SELECT
          m.id,
          m.match_no,
          m.team_a,
          m.team_b,
          m.best_of,

          mp.pred_a,
          mp.pred_b,
          mp.pred_exact_a,
          mp.pred_exact_b,

          mr.res_a,
          mr.res_b,

          COALESCE(points.series_points, 0) AS series_points,
          COALESCE(points.map_points, 0) AS map_points,
          COALESCE(points.total_points, 0) AS earned_points,

          CASE
            WHEN mr.match_id IS NOT NULL THEN 1
            ELSE 0
          END AS has_result

        FROM matches m

        LEFT JOIN match_predictions mp
          ON mp.guild_id = m.guild_id
         AND mp.event_id = m.event_id
         AND mp.match_id = m.id
         AND mp.user_id = ?

        LEFT JOIN match_results mr
          ON mr.guild_id = m.guild_id
         AND mr.event_id = m.event_id
         AND mr.match_id = m.id

        LEFT JOIN (
          SELECT
            guild_id,
            event_id,
            match_id,
            user_id,

            SUM(
              CASE
                WHEN source = 'series' THEN points
                ELSE 0
              END
            ) AS series_points,

            SUM(
              CASE
                WHEN source = 'map' THEN points
                ELSE 0
              END
            ) AS map_points,

            SUM(points) AS total_points

          FROM match_points

          GROUP BY
            guild_id,
            event_id,
            match_id,
            user_id
        ) points
          ON points.guild_id = m.guild_id
         AND points.event_id = m.event_id
         AND points.match_id = m.id
         AND points.user_id = ?

        WHERE m.guild_id = ?
          AND m.event_id = ?
          AND m.phase = ?

        ORDER BY
          COALESCE(m.match_no, 999999),
          m.id

        LIMIT ? OFFSET ?
        `,
      [userId, userId, event.guild_id, event.id, phase, PAGE_SIZE, offset],
    );

    const matchIds = matches.map((match) => Number(match.id));

    let maps = [];

    if (matchIds.length) {
      const placeholders = matchIds.map(() => "?").join(", ");

      const [mapRows] = await pool.query(
        `
          SELECT
            p.match_id,
            p.map_no,
            p.pred_exact_a,
            p.pred_exact_b,

            r.exact_a AS res_exact_a,
            r.exact_b AS res_exact_b

          FROM match_map_predictions p

          LEFT JOIN match_map_results r
            ON r.guild_id = p.guild_id
           AND r.event_id = p.event_id
           AND r.match_id = p.match_id
           AND r.map_no = p.map_no

          WHERE p.guild_id = ?
            AND p.event_id = ?
            AND p.user_id = ?
            AND p.match_id IN (${placeholders})

          ORDER BY
            p.match_id,
            p.map_no
          `,
        [event.guild_id, event.id, userId, ...matchIds],
      );

      maps = mapRows;
    }

    const mapsByMatch = new Map();

    for (const map of maps) {
      const key = Number(map.match_id);

      if (!mapsByMatch.has(key)) {
        mapsByMatch.set(key, []);
      }

      mapsByMatch.get(key).push({
        map_no: Number(map.map_no),

        pred_exact_a:
          map.pred_exact_a !== null ? Number(map.pred_exact_a) : null,

        pred_exact_b:
          map.pred_exact_b !== null ? Number(map.pred_exact_b) : null,

        res_exact_a: map.res_exact_a !== null ? Number(map.res_exact_a) : null,

        res_exact_b: map.res_exact_b !== null ? Number(map.res_exact_b) : null,
      });
    }

    res.json({
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
      },

      phase,

      pagination: {
        page: safePage,
        page_size: PAGE_SIZE,
        total_matches: totalMatches,
        total_pages: totalPages,
      },

      matches: matches.map((match) => ({
        id: Number(match.id),
        match_no: match.match_no !== null ? Number(match.match_no) : null,

        team_a: match.team_a,
        team_b: match.team_b,

        best_of: Number(match.best_of),

        prediction:
          match.pred_a !== null && match.pred_b !== null
            ? {
              pred_a: Number(match.pred_a),
              pred_b: Number(match.pred_b),

              pred_exact_a:
                match.pred_exact_a !== null
                  ? Number(match.pred_exact_a)
                  : null,

              pred_exact_b:
                match.pred_exact_b !== null
                  ? Number(match.pred_exact_b)
                  : null,
            }
            : null,

        result:
          Number(match.has_result) === 1
            ? {
              res_a: Number(match.res_a),
              res_b: Number(match.res_b),
            }
            : null,

        points: {
          series: Number(match.series_points || 0),

          maps: Number(match.map_points || 0),

          total: Number(match.earned_points || 0),
        },

        maps: mapsByMatch.get(Number(match.id)) || [],
      })),
    });
  } catch (err) {
    console.error("MY PREDICTIONS ERROR:", err);

    res.status(500).json({
      error: "Nie udało się wczytać Twoich typów.",
    });
  }
});


app.get("/api/public/matches/:matchId/my-points", async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
      });
    }

    const [[match]] = await pool.query(
      `
      SELECT
        id,
        guild_id,
        event_id
      FROM matches
      WHERE id = ?
      LIMIT 1
      `,
      [matchId],
    );

    if (!match) {
      return res.status(404).json({
        error: "Nie znaleziono meczu.",
      });
    }

    if (!isGuildMember(req.session.user, match.guild_id)) {
      return res.status(403).json({
        error: "Nie należysz do tego serwera.",
      });
    }

    const [[row]] = await pool.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN source = 'series' THEN points
              ELSE 0
            END
          ),
          0
        ) AS series_points,

        COALESCE(
          SUM(
            CASE
              WHEN source = 'map' THEN points
              ELSE 0
            END
          ),
          0
        ) AS map_points,

        COALESCE(
          SUM(points),
          0
        ) AS total_points

      FROM match_points
      WHERE guild_id = ?
        AND event_id = ?
        AND match_id = ?
        AND user_id = ?
      `,
      [
        match.guild_id,
        match.event_id,
        match.id,
        userId,
      ],
    );

    return res.json({
      points: {
        series: Number(row?.series_points || 0),
        maps: Number(row?.map_points || 0),
        total: Number(row?.total_points || 0),
      },
    });
  } catch (err) {
    console.error("MY MATCH POINTS ERROR:", err);

    return res.status(500).json({
      error: "Nie udało się wczytać punktów.",
    });
  }
});