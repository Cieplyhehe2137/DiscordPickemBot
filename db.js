// db.js
const mysql = require('mysql2/promise');

const { loadGuildConfigsOnce, getGuildConfig } = require('./utils/guildRegistry');
const { getCurrentGuildId } = require('./utils/guildContext');

let _pools = {}; // guildId => mysql pool
let _legacyPool = null;

function _num(val, fallback) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function _connectTimeoutMs(cfg) {
  return _num(cfg?.DB_CONNECT_TIMEOUT_MS || process.env.DB_CONNECT_TIMEOUT_MS, 15000);
}

function createPoolFromCfg(cfg) {
  return mysql.createPool({
    host: cfg.DB_HOST,
    port: _num(cfg.DB_PORT, 3306),
    user: cfg.DB_USER,
    password: cfg.DB_PASS,
    database: cfg.DB_NAME,

    waitForConnections: true,
    connectionLimit: _num(cfg.DB_POOL_LIMIT, _num(process.env.DB_POOL_LIMIT, 10)),
    queueLimit: 0,

    // ważne przy hostingach/ptero — stabilniejsze sockety
    connectTimeout: _connectTimeoutMs(cfg),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    multipleStatements: false,
  });
}

function getLegacyPoolFromEnv() {
  if (_legacyPool) return _legacyPool;

  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('Brak DB_* w root .env i brak config/*.env - nie mam jak zbudować poola.');
  }

  _legacyPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: _num(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: _num(process.env.DB_POOL_LIMIT, 10),
    queueLimit: 0,

    connectTimeout: _connectTimeoutMs(process.env),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    multipleStatements: false,
  });

  return _legacyPool;
}

function getPoolForGuild(guildId) {
  const gid = String(guildId || '').trim();
  if (!gid) throw new Error('getPoolForGuild: guildId jest wymagane');

  if (_pools[gid]) return _pools[gid];

  // upewniamy się, że configi są załadowane (rzuci błędem jeśli są braki)
  loadGuildConfigsOnce();

  const cfg = getGuildConfig(gid);
  if (!cfg) {
    throw new Error(`Brak configu dla guildId=${gid} (sprawdź config/*.env)`);
  }

  const pool = createPoolFromCfg(cfg);
  _pools[gid] = pool;
  return pool;
}

// Proxy pool: bierzemy guild z kontekstu withGuild(...)
const poolProxy = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'getPoolForGuild') return getPoolForGuild;

    // symbole (np. util.inspect) – nie bindujemy
    if (typeof prop === 'symbol') return undefined;

    const gid = getCurrentGuildId();
    const activePool = gid ? getPoolForGuild(gid) : getLegacyPoolFromEnv();

    const val = activePool[prop];
    return typeof val === 'function' ? val.bind(activePool) : val;
  }
});

module.exports = poolProxy;
module.exports.getPoolForGuild = getPoolForGuild;
