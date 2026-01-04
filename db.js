// db.js
const mysql = require('mysql2/promise');
const path = require('path');

const { loadGuildConfigsOnce, getGuildConfig } = require('./utils/guildRegistry');
const { getCurrentGuildId, getGuildId } = require('./utils/guildContext');

let _pools = {};

function createPoolFromCfg(cfg) {
  return mysql.createPool({
    host: cfg.DB_HOST,
    port: Number(cfg.DB_PORT || 3306),
    user: cfg.DB_USER,
    password: cfg.DB_PASS,
    database: cfg.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(cfg.DB_POOL_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false,
  })
}

function buildPoolFromEnv() {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('Brak DB_* w root .env i brak config/*.env - nie mam jak zbudować poola.');
  }

  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    multipleStatements: false,
  });
}

function getPoolForGuild(guildId) {
  const gid = String(guildId || '').trim();
  if (!gid) throw new Error('getPoolForGuild: guildId jest wymagane');

  if (_pools[gid]) return _pools[gid];

  // upewniamy się, że configi są załadowane (rzuci błędem jeśli są braki)
  loadGuildConfigsOnce();

  const cfg = getGuildConfig(gid);
  const pool = createPoolFromCfg(cfg);
  _pools[gid] = pool;
  return pool;
}

// Proxy pool: bierzemy guild z kontekstu withGuild(...)
const poolProxy = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'getPoolForGuild') return getPoolForGuild;

    // legacy fallback: jeśli ktoś zawoła bez withGuild(...) i bez multi-configów
    const gid = getCurrentGuildId();
    if (gid) return getPoolForGuild(gid)[prop].bind(getPoolForGuild(gid));

    // jeśli nie ma kontekstu - spróbujemy zbudować z root env (legacy)
    const legacy = buildPoolFromEnv();
    return legacy[prop].bind(legacy);
  }
});

module.exports = poolProxy;
module.exports.getPoolForGuild = getPoolForGuild;