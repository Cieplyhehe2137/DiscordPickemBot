// db.js
const mysql = require('mysql2/promise');
const logger = require('./utils/logger');
const { getGuildId } = require('./utils/guildContext');
const { getGuildConfig } = require('./utils/guildRegistry');

const pools = new Map();
let defaultPool = null;
let closing = false;

function buildPoolFromCfg(cfg) {
  return mysql.createPool({
    host: cfg.DB_HOST,
    port: Number(cfg.DB_PORT || 3306),
    user: cfg.DB_USER,
    password: cfg.DB_PASS || cfg.DB_PASSWORD,
    database: cfg.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(cfg.DB_POOL_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

function buildPoolFromEnv() {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('Brak DB_* w root .env i brak config/*.env — nie mam jak zbudować poola');
  }
  return buildPoolFromCfg({
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT || '3306',
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS || process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_POOL_LIMIT: process.env.DB_POOL_LIMIT || 10,
  });
}

function resolveConfigFromContext() {
  const gid = getGuildId();
  if (gid) {
    const cfg = getGuildConfig(gid);
    if (cfg) return cfg;
  }

  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('Brak DB_* w root .env i brak config/*.env — nie mam jak zbudować połączenia');
  }

  return {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT || '3306',
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS || process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_POOL_LIMIT: process.env.DB_POOL_LIMIT || 10,
  };
}

function getPoolForGuild(guildId) {
  const gid = String(guildId);
  if (pools.has(gid)) return pools.get(gid);

  const cfg = getGuildConfig(gid);
  if (!cfg) throw new Error(`Brak configu dla guildId=${gid} (config/*.env)`);

  const pool = buildPoolFromCfg(cfg);
  pools.set(gid, pool);

  logger.info('db', 'Created MySQL pool for guild', { guildId: gid, db: cfg.DB_NAME });
  return pool;
}

function getPoolFromContext() {
  const gid = getGuildId();
  if (gid) {
    try {
      return getPoolForGuild(gid);
    } catch (e) {
      logger.warn('db', 'No guild pool for context, falling back', { guildId: gid, message: e.message });
    }
  }

  if (!defaultPool) defaultPool = buildPoolFromEnv();
  return defaultPool;
}

function getAdminConnection() {
  const cfg = resolveConfigFromContext();
  return mysql.createConnection({
    host: cfg.DB_HOST,
    port: Number(cfg.DB_PORT || 3306),
    user: cfg.DB_USER,
    password: cfg.DB_PASS || cfg.DB_PASSWORD,
    database: cfg.DB_NAME,
    multipleStatements: true,
  });
}

async function closeAllPools() {
  if (closing) return;
  closing = true;

  const tasks = [];
  for (const pool of pools.values()) {
    tasks.push(pool.end().catch(() => {}));
  }
  pools.clear();

  if (defaultPool) {
    tasks.push(defaultPool.end().catch(() => {}));
    defaultPool = null;
  }

  await Promise.all(tasks);
  closing = false;
}

const proxy = new Proxy({}, {
  get(_t, prop) {
    const pool = getPoolFromContext();
    const value = pool[prop];
    return typeof value === 'function' ? value.bind(pool) : value;
  }
});

proxy.getPoolForGuild = getPoolForGuild;
proxy.getAdminConnection = getAdminConnection;
proxy.closeAllPools = closeAllPools;

module.exports = proxy;
