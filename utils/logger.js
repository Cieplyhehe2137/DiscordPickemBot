const fs = require("fs");
const path = require("path");

const { createLogger, format, transports } = require("winston");

// Czy proces chodzi pod uruchamiaczem testów.
//
// Bez tego `npm test` dopisywał się do PRAWDZIWYCH logów bota: 2130 z 11237
// linii bot.log miało guildId "111", czyli identyfikator z atrap w test/.
// Jeden przebieg testów to ponad osiem kilobajtów wpisów, a szuka się w tym
// pliku prawdziwych awarii.
//
// Trzy sposoby wykrycia, bo uruchamiacz Node'a zachowuje się różnie:
// NODE_TEST_CONTEXT ustawia sam Node w procesach potomnych (tak działa
// domyślna izolacja), --test w execArgv zostaje przy izolacji wyłączonej,
// a NODE_ENV to furtka dla kogoś, kto odpala testy inaczej. Żaden z nich
// nie wymaga zmiany w package.json ani paczki od zmiennych środowiskowych,
// co na Windowsie ma znaczenie - `NODE_ENV=test node ...` tam nie działa.
const RUNNING_TESTS =
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.env.NODE_ENV === "test" ||
  process.execArgv.includes("--test");

const logsDir = path.join(process.cwd(), "logs");

// Katalog powstaje tylko wtedy, gdy naprawdę będzie do czego pisać. Samo
// zaimportowanie loggera w teście nie ma tworzyć niczego na dysku.
if (!RUNNING_TESTS && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, {
    recursive: true,
  });
}

// ======================================================
// HELPERY
// ======================================================

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function normalizeMeta(value) {
  return isPlainObject(value) ? value : {};
}

function normalizeLogArgs(first, second, third) {
  // =========================================
  // STARY FORMAT:
  //
  // logInfo(
  //   "matches",
  //   "Match edited",
  //   { guildId }
  // )
  // =========================================

  if (typeof second === "string") {
    return {
      scope: String(first),
      message: second,
      meta: normalizeMeta(third),
    };
  }

  // =========================================
  // NOWY FORMAT:
  //
  // logInfo(
  //   "Match edited",
  //   { guildId }
  // )
  // =========================================

  return {
    scope: null,
    message: String(first),
    meta: normalizeMeta(second),
  };
}

function normalizeErrorArgs(args) {
  const [first, second, third, fourth] = args;

  // =========================================
  // STARY FORMAT:
  //
  // logError(
  //   "matches",
  //   "Match edit failed",
  //   {
  //     guildId,
  //     message: err.message,
  //     stack: err.stack
  //   }
  // )
  // =========================================

  if (typeof second === "string") {
    let error = null;
    let meta = {};

    if (third instanceof Error) {
      error = third;
      meta = normalizeMeta(fourth);
    } else {
      meta = normalizeMeta(third);
    }

    return {
      scope: String(first),
      message: second,
      error,
      meta,
    };
  }

  // =========================================
  // NOWY FORMAT:
  //
  // logError(
  //   "COMMAND_ERROR",
  //   err,
  //   { guildId }
  // )
  // =========================================

  return {
    scope: null,
    message: String(first),
    error: second instanceof Error ? second : null,

    meta: normalizeMeta(third),
  };
}

// ======================================================
// EXTRA METADATA
// ======================================================

function buildExtra(info) {
  const reservedKeys = new Set([
    "timestamp",
    "level",
    "message",
    "scope",

    "guildId",
    "userId",
    "username",

    "command",
    "customId",

    "eventId",
    "phase",

    "stack",
    "errorMessage",

    "extra",
  ]);

  const extra = {};

  // =========================================
  // EXISTING EXTRA
  // =========================================

  if (isPlainObject(info.extra)) {
    Object.assign(extra, info.extra);
  } else if (info.extra !== null && info.extra !== undefined) {
    extra.value = info.extra;
  }

  // =========================================
  // NIEZNANE POLA
  //
  // np.
  // matchId
  // before
  // after
  // affectedRows
  // channelId
  // =========================================

  for (const [key, value] of Object.entries(info)) {
    if (reservedKeys.has(key)) {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    extra[key] = value;
  }

  return Object.keys(extra).length ? extra : null;
}

// ======================================================
// JSON FORMAT
// ======================================================

const jsonFormat = format.printf((info) => {
  return JSON.stringify({
    timestamp: info.timestamp,

    level: info.level,

    scope: info.scope || null,

    message: info.message,

    guildId: info.guildId || null,

    userId: info.userId || null,

    username: info.username || null,

    command: info.command || null,

    customId: info.customId || null,

    eventId: info.eventId || null,

    phase: info.phase || null,

    errorMessage: info.errorMessage || null,

    stack: info.stack || null,

    extra: buildExtra(info),
  });
});

// ======================================================
// WINSTON
// ======================================================

const logger = createLogger({
  level: "info",

  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),

    format.errors({
      stack: true,
    }),

    jsonFormat,
  ),

  // W testach jeden transport, który nic nie robi. Zero transportów nie
  // wchodzi w grę - winston wypisuje wtedy ostrzeżenie przy każdym wpisie,
  // czyli hałas zamiast ciszy.
  //
  // Konsola milknie razem z plikami, bo logi szły też tam: jeden plik testów
  // wypluwał pięć linii "No ... data, skipping phase" pomiędzy nazwy testów.
  transports: RUNNING_TESTS
    ? [new transports.Console({ silent: true })]
    : [
        new transports.File({
          filename: path.join(logsDir, "bot.log"),

          level: "info",
        }),

        new transports.File({
          filename: path.join(logsDir, "errors.log"),

          level: "error",
        }),

        new transports.File({
          filename: path.join(logsDir, "warnings.log"),

          level: "warn",
        }),

        new transports.Console({
          level: process.env.NODE_ENV === "production" ? "warn" : "info",

          format: format.combine(format.colorize(), format.simple()),
        }),
      ],
});

// ======================================================
// INFO
// ======================================================

function logInfo(first, second = {}, third = {}) {
  const { scope, message, meta } = normalizeLogArgs(first, second, third);

  logger.info(message, {
    ...meta,
    ...(scope ? { scope } : {}),
  });
}

// ======================================================
// WARN
// ======================================================

function logWarn(first, second = {}, third = {}) {
  const { scope, message, meta } = normalizeLogArgs(first, second, third);

  logger.warn(message, {
    ...meta,
    ...(scope ? { scope } : {}),
  });
}

// ======================================================
// ERROR
// ======================================================

function logError(...args) {
  const { scope, message, error, meta } = normalizeErrorArgs(args);

  const {
    message: metaErrorMessage,

    stack: metaStack,

    ...cleanMeta
  } = meta;

  logger.error(message, {
    ...cleanMeta,

    ...(scope ? { scope } : {}),

    errorMessage: error?.message || metaErrorMessage || null,

    stack: error?.stack || metaStack || null,
  });
}

// ======================================================
// INTERACTION HELPERS
// ======================================================

function logInteraction(interaction, message, extra = {}) {
  logInfo(message, {
    guildId: interaction.guildId || null,

    userId: interaction.user?.id || null,

    username: interaction.user?.tag || interaction.user?.username || null,

    command: interaction.commandName || null,

    customId: interaction.customId || null,

    extra,
  });
}

function logCommandStart(interaction) {
  logInteraction(interaction, "COMMAND_START");
}

function logCommandSuccess(interaction) {
  logInteraction(interaction, "COMMAND_SUCCESS");
}

function logCommandError(interaction, error) {
  logError("COMMAND_ERROR", error, {
    guildId: interaction.guildId || null,

    userId: interaction.user?.id || null,

    username: interaction.user?.tag || interaction.user?.username || null,

    command: interaction.commandName || null,

    customId: interaction.customId || null,
  });
}

module.exports = {
  logger,
  RUNNING_TESTS,

  logInfo,
  logWarn,
  logError,

  logInteraction,

  logCommandStart,
  logCommandSuccess,
  logCommandError,
};
