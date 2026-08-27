// onReady.js
const { logInfo, logWarn, logError } = require("./utils/logger");
const { getAllGuildIds, ensureGuildDirs } = require("./utils/guildRegistry");

const sendArchivePanel = require("./utils/sendArchivePanel");
const startExportPanel = require("./utils/startExportPanel");

const ensureTournamentTables = require("./utils/ensureTournamentTables");
const { getPoolForGuild } = require("./db");

const {
  startMatchLockWatcher,
} = require("./handlers/matches/matchLockWatcher");

const {
  startDeadlineReminder,
} = require("./handlers/matches/deadlineReminder");

const {
  startPickemAutoStartWatcher,
} = require("./handlers/admin/pickemAutoStartWatcher");

// ======================================================
// BEZPIECZNY START POJEDYNCZEGO ELEMENTU
// ======================================================

async function safeStart(name, guildId, fn) {
  try {
    await fn();

    logInfo("ready", `${name} started`, {
      guildId,
    });

    return true;
  } catch (err) {
    logError("ready", `${name} failed to start`, {
      guildId,
      message: err?.message,
      stack: err?.stack,
    });

    return false;
  }
}

// ======================================================
// READY
// ======================================================

module.exports = async function onReady(client) {
  const guildIds = getAllGuildIds();

  logInfo("ready", "Booting multi-guild", {
    guildCount: guildIds.length,
    guildIds,
  });

  // ====================================================
  // KAŻDY GUILD STARTUJE NIEZALEŻNIE
  // ====================================================

  for (const guildId of guildIds) {
    // ==================================================
    // KATALOGI GUILDA
    // ==================================================

    try {
      ensureGuildDirs(guildId);
    } catch (err) {
      logError("ready", "ensureGuildDirs failed", {
        guildId,
        message: err?.message,
        stack: err?.stack,
      });
    }

    // ==================================================
    // SELF-HEAL TABEL
    // ==================================================

    const databaseSchemaOk = await safeStart(
      "Tournament tables",
      guildId,
      async () => {
        const pool = getPoolForGuild(guildId);

        if (!pool) {
          throw new Error(`Missing database pool for guild ${guildId}`);
        }

        await ensureTournamentTables(pool);
      },
    );

    // ==================================================
    // PANELE ADMINA
    // ==================================================

    const archivePanelOk = await safeStart(
      "Archive panel",
      guildId,
      async () => {
        await sendArchivePanel(client, guildId);
      },
    );

    const exportPanelOk = await safeStart("Export panel", guildId, async () => {
      await startExportPanel(client, guildId);
    });

    // ==================================================
    // WATCHERY KRYTYCZNE
    // ==================================================

    const deadlineWatcherOk = await safeStart(
      "Deadline reminder",
      guildId,
      async () => {
        startDeadlineReminder(client, guildId);
      },
    );

    const matchLockWatcherOk = await safeStart(
      "Match lock watcher",
      guildId,
      async () => {
        startMatchLockWatcher(client, guildId);
      },
    );

    const autoStartWatcherOk = await safeStart(
      "PickEm auto-start watcher",
      guildId,
      async () => {
        startPickemAutoStartWatcher(client, guildId);
      },
    );

    // ==================================================
    // PODSUMOWANIE STARTU GUILDA
    // ==================================================

    const services = {
      databaseSchema: databaseSchemaOk,
      archivePanel: archivePanelOk,
      exportPanel: exportPanelOk,
      deadlineReminder: deadlineWatcherOk,
      matchLockWatcher: matchLockWatcherOk,
      pickemAutoStartWatcher: autoStartWatcherOk,
    };

    const failedServices = Object.entries(services)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);

    if (failedServices.length === 0) {
      logInfo("ready", "Guild boot OK", {
        guildId,
      });
    } else {
      logWarn("ready", "Guild boot completed with warnings", {
        guildId,
        failedServices,
      });
    }
  }

  // ======================================================
  // BOT GOTOWY
  // ======================================================

  logInfo("ready", `✅ Logged in as ${client.user.tag}`);
};
