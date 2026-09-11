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
      const zamrozone = await getFrozenPhases(event.id);

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
      const zamrozone = await getFrozenPhases(event.id);
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

      const poZapisie = await getFrozenPhases(event.id);

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

// Przeniesione do server/routes/publicOverview.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerPublicOverviewRoutes(app, {
  buildPublicMatch,
  guildRegistry,
  pool,
});

// Przeniesione do server/routes/guildEvents.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerGuildEventRoutes(app, {
  getOpenEventId,
  io,
  logInfo,
  parseMatchList,
  pool,
  requireGuildAdmin,
  runInTransaction,
});

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
// Przeniesione do server/routes/publicMatches.js. Wywolanie stoi tam, gdzie byly trasy -
// kolejnosc rejestracji jest zachowaniem, bo Express bierze pierwsza.
registerPublicMatchRoutes(app, {
  FAZA_PANELU,
  FAZY_PANELU_CONFIG,
  assertPredictionsAllowed,
  assertSafeBackupFileName,
  calculateScores,
  createGuildBackup,
  emitDashboardRefresh,
  exportClassification,
  fs,
  getCurrentDoubleElimResults,
  getCurrentPlayinResults,
  getCurrentPlayoffs,
  getCurrentSwissResults,
  getLockBeforeSec,
  getPhaseLimits,
  guildIdFromEventSlug,
  guildIdFromMatchId,
  guildRegistry,
  io,
  isMatchStarted,
  listGuildBackups,
  loadActiveTeams,
  logError,
  logInfo,
  logWarn,
  matchesStore,
  maxMapsFromBo,
  path,
  pool,
  recalculateMatchPoints,
  registerBackupRoutes,
  registerEventAdminRoutes,
  registerEventCleanupRoutes,
  registerMatchExactRoutes,
  registerMatchRoutes,
  registerPhaseResultRoutes,
  requireGuildAdmin,
  restoreBackup,
  runInTransaction,
  safeFileBase,
  sprawdzWynik,
  buildMatchesWithPickSql,
  resolveMatchPredictionState,
  validateCs2Score,
});


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


// Publiczne trasy typowania siedza w server/routes/publicPickem.js.
// Wywolanie stoi tam, gdzie byly - kolejnosc rejestracji jest zachowaniem.
registerPublicPickemRoutes(app, {
  assertPredictionsAllowed,
  calculateCommunityAnalysis,
  calculateContrarianStats,
  calculateMapAccuracy,
  calculatePlayerStyle,
  calculateRecentForm,
  calculateStreaks,
  calculateTeamStats,
  calculateTrendStats,
  fs,
  getBoStats,
  getOpenEventId,
  getPhaseLimits,
  isGuildMember,
  isMapExact,
  isMapWinnerCorrect,
  isMatchDeadlinePassed,
  isMatchLocked,
  isSeriesExact,
  isWinnerCorrect,
  toWebMessage,
  loadActiveTeams,
  matchPanelPhaseFor,
  parseCsvPick,
  path,
  percentageNumber,
  checkPickemGate,
  countParticipants,
  pool,
  runInTransaction,
  sprawdzTyp,
  validateCs2Score,
  validateSeriesMapOrder,
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

// Aplikacja jest budowana tutaj, ale NIE uruchamiana - nasluchiwanie, odbiornik
// logow CS2 i obsluga sygnalow siedza w index.js. Dzieki temu ten modul da sie
// zaimportowac bez zajmowania portow, co jest jedynym sposobem, zeby test mogl
// sprawdzic tablice tras przy dalszym rozbijaniu pliku.
export { app, io, httpServer, sessionStore };
