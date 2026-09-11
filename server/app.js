import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import { buildAllowedOrigins, createOriginCheck } from "./lib/origin.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerGuildRoutes } from "./routes/guilds.js";
import { registerPublicPickemRoutes } from "./routes/publicPickem.js";
import { registerPhaseResultRoutes } from "./routes/phaseResults.js";
import { registerEventAdminRoutes } from "./routes/eventAdmin.js";
import { registerPublicOverviewRoutes } from "./routes/publicOverview.js";
import { createGuildInfo } from "./lib/guildInfo.js";
import { createParticipantQueries } from "./lib/participants.js";
import { buildPublicMatch } from "./lib/publicMatch.js";
import { toWebMessage } from "./lib/messages.js";
import { parseCsvPick } from "./lib/picks.js";
import { buildMatchesWithPickSql } from "./lib/matchQueries.js";
import { createFrozenPhases } from "./lib/frozenPhases.js";
import { createPredictionGate } from "./lib/predictionGate.js";
import { createBackupFiles } from "./lib/backupFiles.js";
import { createGuildBackupTools } from "./lib/guildBackup.js";
import { registerPickemConfigRoutes } from "./routes/pickemConfig.js";
import { registerResultProposalRoutes } from "./routes/resultProposals.js";
import { registerMatchOpsRoutes } from "./routes/matchOps.js";
import {
  ADMINISTRATOR_PERMISSION,
  hasAdminPermission,
  isGuildMember,
  requireGuildAdmin,
} from "./lib/permissions.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerPublicEventRoutes } from "./routes/publicEvents.js";
import { registerPublicMatchRoutes } from "./routes/publicMatches.js";
import { registerMyPicksRoutes } from "./routes/myPicks.js";
import { registerMatchExactRoutes } from "./routes/matchExact.js";
import { registerPlayerProfileRoutes } from "./routes/playerProfile.js";
import { registerEventStatsRoutes } from "./routes/eventStats.js";
import { registerGuildEventRoutes } from "./routes/guildEvents.js";
import { registerBackupRoutes } from "./routes/backups.js";
import { registerEventCleanupRoutes } from "./routes/eventCleanup.js";
import { registerMatchRoutes } from "./routes/matches.js";
import {
  assertSafeBackupFileName,
  safeFileBase,
  sqlEscape,
  validateCs2Score,
  validateSeriesMapOrder,
} from "./lib/validation.js";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();
console.log("[ENV] DISCORD_CLIENT_ID:", process.env.DISCORD_CLIENT_ID);
console.log("[ENV] DISCORD_REDIRECT_URI:", process.env.DISCORD_REDIRECT_URI);
import http from "http";
import { Server } from "socket.io";
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
  // sprawdzWynik bylo wolane w czterech trasach zapisu wynikow fazy, ale nigdy
  // nie zostalo zaimportowane - kazdy taki zapis konczyl sie ReferenceError.
  sprawdzWynik,
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

// Front na osobnym hoście (np. Cloudflare Pages).
//
// Domyślne wdrożenie jest jednoprocesowe: Express serwuje web/dist pod tym
// samym adresem co /api, więc ciasteczko sesji jest same-site i CORS nie jest
// potrzebny. Rozdzielenie hostów wymaga trzech rzeczy naraz, bo przeglądarka
// odrzuci ciasteczko, jeśli którejkolwiek zabraknie:
//   - dopuszczenia originu frontu w CORS z credentials
//   - SameSite=None; Secure na ciasteczku
//   - HTTPS po stronie API
//
// SameSite=None zdejmuje ochronę, którą Lax daje przy CSRF, więc włączamy to
// wyłącznie jawną flagą, a nie przy okazji ustawienia WEB_ORIGIN.
const CROSS_ORIGIN_WEB = process.env.CROSS_ORIGIN_WEB === "1";

// WEB_ORIGIN przyjmuje listę po przecinku. Cloudflare Pages daje każdemu
// podglądowi własny adres <hash>.<projekt>.pages.dev, więc pojedynczy wpis
// nie wystarcza - WEB_ORIGIN_SUFFIX dopuszcza całą domenę projektu.
const ALLOWED_ORIGINS = buildAllowedOrigins(WEB_ORIGIN);

// getKnownGuildInfo jest uzywane i tutaj, i w routes/publicOverview.js
const { getKnownGuildInfo } = createGuildInfo(guildRegistry);

// Uzywane i w trasach eventu, i w profilu gracza
const { findNameFromPicks, countParticipants } =
  createParticipantQueries(pool);

const { getFrozenPhases } = createFrozenPhases({
  pool,
  phases: FAZY_PICKEM,
  normalizePhase,
});

const isAllowedOrigin = createOriginCheck({
  allowed: ALLOWED_ORIGINS,
  suffix: process.env.WEB_ORIGIN_SUFFIX,
});

// Pierwszy wpis zostaje adresem, na który wraca logowanie przez Discorda -
// podglądy Pages nie mogą tu trafić, bo redirect URI jest jeden i stały.
const PRIMARY_WEB_ORIGIN = ALLOWED_ORIGINS[0] || "http://localhost:5173";

// Ile backupów trzymamy na gildię. Zrzut to ~40 KB, więc 10 sztuk to
// pół megabajta - limit istnieje po to, żeby katalog nie rósł w nieskończoność
// przy adminie klikającym "Utwórz backup" przed każdą zmianą, a nie po to,
// żeby oszczędzać miejsce.
const BACKUP_RETENTION = Number(process.env.BACKUP_RETENTION) || 10;

const { listGuildBackups, pruneGuildBackups } = createBackupFiles({
  fs,
  path,
  guildRegistry,
  retention: BACKUP_RETENTION,
  logWarn,
});

// getDatabaseTablesAndColumns zostaje wewnatrz modulu - uzywa jej tylko
// createGuildBackup, a fabryka oddaje ja na potrzeby testu.
const { createGuildBackup } = createGuildBackupTools({
    mysql2,
    mysqldump,
    guildRegistry,
    path,
    sqlEscape,
    pruneGuildBackups,
  });

const app = express();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) =>
      callback(
        isAllowedOrigin(origin) ? null : new Error("Origin niedozwolony"),
        isAllowedOrigin(origin),
      ),
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
    origin: (origin, callback) =>
      isAllowedOrigin(origin)
        ? callback(null, true)
        : callback(new Error(`Origin niedozwolony: ${origin}`)),
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
      // SameSite=None wymaga Secure - przeglądarka odrzuci ciasteczko bez
      // niego, więc front na osobnym hoście działa tylko przy HTTPS na API.
      secure: IS_PRODUCTION || CROSS_ORIGIN_WEB,
      httpOnly: true,
      sameSite: CROSS_ORIGIN_WEB ? "none" : "lax",
    },
  }),
);

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

// Za definicjami map faz i matchPanelPhaseFor - fabryka czyta je od razu,
// wiec wczesniej byloby to siegniecie po const przed inicjalizacja.
const { resolveMatchPredictionState, checkPickemGate } = createPredictionGate({
  pool,
  assertPredictionsAllowed,
  isPickDeadlinePassed,
  isMatchDeadlinePassed,
  isMatchLocked,
  matchPanelPhaseFor,
  toWebMessage,
  pickemPanelPhase: PICKEM_PANEL_PHASE,
});
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

// Trasy logowania siedza w server/routes/auth.js. Wywolanie stoi dokladnie
// tam, gdzie wczesniej byly te trasy - kolejnosc rejestracji jest czescia
// zachowania, bo Express bierze pierwsza pasujaca.
registerAuthRoutes(app, {
  pool,
  guildRegistry,
  isProduction: IS_PRODUCTION,
  webOrigin: PRIMARY_WEB_ORIGIN,
  administratorPermission: ADMINISTRATOR_PERMISSION,
});

// Przeniesione do server/routes/events.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerEventRoutes(app, {
  countParticipants,
  VALID_PHASES,
  assertPredictionsAllowed,
  emitDashboardRefresh,
  findPanelForDeadline,
  findPanelForMatchDeadline,
  getEventPickemConfig,
  getOpenEventId,
  guildIdFromEventSlug,
  guildRegistry,
  hasAdminPermission,
  io,
  normalizePhase,
  parseDeadlineInput,
  checkPickemGate,
  pool,
  registerGuildRoutes,
  requireGuildAdmin,
  buildMatchesWithPickSql,
  resolveMatchPredictionState,
  teamsStore,
});


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
// Przeniesione do server/routes/publicEvents.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerPublicEventRoutes(app, {
  getKnownGuildInfo,
  calculateScores,
  isGuildMember,
  pool,
  requireGuildAdmin,
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
// Przeniesione do server/routes/pickemConfig.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerPickemConfigRoutes(app, {
  getFrozenPhases,
  FAZY_PICKEM,
  buildPublicMatch,
  emitDashboardRefresh,
  getEventPickemConfig,
  getOpenEventId,
  guildIdFromEventSlug,
  guildRegistry,
  io,
  logInfo,
  parseMatchList,
  pool,
  registerGuildEventRoutes,
  registerPublicOverviewRoutes,
  requireGuildAdmin,
  runInTransaction,
  setEventPickemConfig,
});

// Przeniesione do server/routes/resultProposals.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerResultProposalRoutes(app, {
  applyMatchResult,
  getResultProvider,
  guildIdFromEventSlug,
  guildIdFromMatchId,
  guildIdFromProposalId,
  io,
  logError,
  logInfo,
  logWarn,
  matchesStore,
  pool,
  requireGuildAdmin,
  resultProposalsStore,
});

// Przeniesione do server/routes/matchOps.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerMatchOpsRoutes(app, {
  checkPickemGate,
  countParticipants,
  createGuildBackup,
  listGuildBackups,
  resolveMatchPredictionState,
  FAZA_PANELU,
  FAZY_PANELU_CONFIG,
  assertPredictionsAllowed,
  assertSafeBackupFileName,
  buildMatchesWithPickSql,
  calculateCommunityAnalysis,
  calculateContrarianStats,
  calculateMapAccuracy,
  calculatePlayerStyle,
  calculateRecentForm,
  calculateScores,
  calculateStreaks,
  calculateTeamStats,
  calculateTrendStats,
  emitDashboardRefresh,
  exportClassification,
  fs,
  getBoStats,
  getCurrentDoubleElimResults,
  getCurrentPlayinResults,
  getCurrentPlayoffs,
  getCurrentSwissResults,
  getLockBeforeSec,
  getOpenEventId,
  getPhaseLimits,
  guildIdFromEventSlug,
  guildIdFromMatchId,
  guildRegistry,
  io,
  isGuildMember,
  isMapExact,
  isMapWinnerCorrect,
  isMatchDeadlinePassed,
  isMatchLocked,
  isMatchStarted,
  isSeriesExact,
  isWinnerCorrect,
  loadActiveTeams,
  logError,
  logInfo,
  logWarn,
  matchPanelPhaseFor,
  matchesStore,
  maxMapsFromBo,
  parseCsvPick,
  path,
  percentageNumber,
  pool,
  recalculateMatchPoints,
  registerBackupRoutes,
  registerEventAdminRoutes,
  registerEventCleanupRoutes,
  registerMatchExactRoutes,
  registerMatchRoutes,
  registerPhaseResultRoutes,
  registerPublicMatchRoutes,
  registerPublicPickemRoutes,
  requireGuildAdmin,
  restoreBackup,
  runInTransaction,
  safeFileBase,
  sprawdzTyp,
  sprawdzWynik,
  toWebMessage,
  validateCs2Score,
  validateSeriesMapOrder,
});

// Te trzy rejestracje stały PO bloku produkcyjnym, mimo że komentarz nad nim
// mówi, że jest rejestrowany jako ostatni. Nie szkodziło to dziś, bo wzorzec
// fallbacku wyklucza /api, ale całe bezpieczeństwo wisiało na tym jednym
// wyrażeniu - a express.static i tak biegł przed nimi. Wszystkie ich trasy to
// /api/*, więc przestawienie niczego nie zmienia poza usunięciem tej pułapki.

// Przeniesione do server/routes/playerProfile.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerPlayerProfileRoutes(app, {
  assertPredictionsAllowed,
  isMatchDeadlinePassed,
  matchPanelPhaseFor,
  findNameFromPicks,
  pool,
});

// Przeniesione do server/routes/eventStats.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerEventStatsRoutes(app, {
  assertPredictionsAllowed,
  isMatchDeadlinePassed,
  isMatchLocked,
  matchPanelPhaseFor,
  pool,
});

// Przeniesione do server/routes/myPicks.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerMyPicksRoutes(app, {
  isGuildMember,
  pool,
});

// Serve the built web/ frontend (npm run build -> web/dist) as static files
// in production, so one process/port handles both the API and the SPA -
// no separate web host, no second exposed port, no cross-origin cookies.
// Rejestrowany jako ostatni, żeby nigdy nie przesłonił trasy /api/*. Wzorzec
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


// Aplikacja jest budowana tutaj, ale NIE uruchamiana - nasluchiwanie, odbiornik
// logow CS2 i obsluga sygnalow siedza w index.js. Dzieki temu ten modul da sie
// zaimportowac bez zajmowania portow, co jest jedynym sposobem, zeby test mogl
// sprawdzic tablice tras przy dalszym rozbijaniu pliku.
export { app, io, httpServer, sessionStore };
