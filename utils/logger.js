const { log } = require('console');
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const logsDir = path.join(process.cwd(), "logs");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const jsonFormat = format.printf((info) => {
  return JSON.stringify({
    timestamp: info.timestamp,
    level: info.level,
    message: info.message,
    guildId: info.guildId || null,
    userId: info.userId || null,
    username: info.username || null,
    command: info.command || null,
    customId: info.customId || null,
    eventId: info.eventId || null,
    phase: info.phase || null,
    stack: info.stack || null,
    extra: info.extra || null,
  });
});

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    jsonFormat
  ),
  transports: [
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
      level: "info",
      format: format.combine(
        format.colorize(),
        format.simple()
      ),
    }),
  ],
});

function logInfo(message, meta = {}) {
  logger.info(message, meta);
}

function logWarn(message, meta = {}) {
  logger.warn(message, meta);
}

function logError(message, error = null, meta = {}) {
  logger.error(message, {
    ...meta,
    stack: error?.stack || null,
    extra: error && !error.stack ? String(error) : meta.extra || null,
  });
}

function logInteraction(interaction, message, extra = {}) {
  logger.info(message, {
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
  logInfo,
  logWarn,
  logError,
  logInteraction,
  logCommandStart,
  logCommandSuccess,
  logCommandError,
};