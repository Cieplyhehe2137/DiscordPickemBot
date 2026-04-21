// db.js
const mysql = require("mysql2/promise");
const guildRegistry = require("./utils/guildRegistry");

const pools = new Map();

function getGuildConfig(guildId) {
  if (!guildId) {
    throw new Error("getGuildConfig called without guildId");
  }

  if (typeof guildRegistry.getGuildConfig === "function") {
    return guildRegistry.getGuildConfig(guildId);
  }

  if (typeof guildRegistry.getAllGuildConfigs === "function") {
    const all = guildRegistry.getAllGuildConfigs() || {};
    return all[guildId];
  }

  if (typeof guildRegistry.getAllGuildConfig === "function") {
    const all = guildRegistry.getAllGuildConfig() || {};
    return all[guildId];
  }

  throw new Error(
    "guildRegistry does not expose getGuildConfig / getAllGuildConfigs / getAllGuildConfig"
  );
}

function getPoolForGuild(guildId) {
  if (!guildId) {
    throw new Error("db.getPoolForGuild called without guildId");
  }

  if (!pools.has(guildId)) {
    const cfg = getGuildConfig(guildId);

    if (!cfg) {
      throw new Error(`No guild config found for guildId=${guildId}`);
    }

    const host = cfg.DB_HOST || cfg.db_host || cfg.host;
    const user = cfg.DB_USER || cfg.db_user || cfg.user;
    const password =
      cfg.DB_PASS || cfg.DB_PASSWORD || cfg.db_pass || cfg.password;
    const database = cfg.DB_NAME || cfg.db_name || cfg.database;
    const port = Number(cfg.DB_PORT || cfg.db_port || 3306);

    console.log("DB CONFIG CHECK", {
      guildId,
      host,
      user,
      password: password ? "SET" : "MISSING",
      database,
      port,
    });

    if (!host || !user || !database) {
      throw new Error(
        `Incomplete DB config for guildId=${guildId} (host/user/database missing)`
      );
    }

    pools.set(
      guildId,
      mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        namedPlaceholders: true,
      })
    );
  }

  return pools.get(guildId);
}

module.exports = {
  getPoolForGuild,
};