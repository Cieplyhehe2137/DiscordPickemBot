// db.js

const mysql = require('mysql2/promise');
const { getCurrentGuildId } = require('./utils/guildContext');
const { getAllGuildConfigs } = require('./utils/guildRegistry');

const poolsByGuild = {};
let defaultGuildId = null;

function initPoolsOnce() {
  const configs = getAllGuildConfigs();
  const guildIds = Object.keys(configs);

  if (!guildIds.length) throw new Error('Brak konfiguracji guild do inicjalizacji DB pooli');

  defaultGuildId = guildIds[0];

  for (const gid of guildIds) {
    const cfg = configs[gid];
    poolsByGuild[gid] = mysql.createPool({
      host: cfg.DB_HOST,
      port: Number(cfg.DB_PORT || 3306),
      user: cfg.DB_USER,
      password: cfg.DB_PASS,
      database: cfg.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    poolsByGuild[gid].getConnection()
      .then(conn => conn.query('SELECT 1').finally(() => conn.release()))
      .catch(err => console.error(`❌ Nie udało się połączyć z bazą dla guild ${gid}:`, err.message));
  }
}

initPoolsOnce();

function pickPool() {
  const gid = getCurrentGuildId();
  if (gid && poolsByGuild[gid]) return poolsByGuild[gid];
  return poolsByGuild[defaultGuildId];
}

const poolProxy = new Proxy({}, {
  get(_target, prop) {
    const pool = pickPool();
    const value = pool[prop];
    return typeof value === 'function' ? value.bind(pool) : value;
  },
});

poolProxy.getPool = (guildId) => poolsByGuild[String(guildId)];
poolProxy.poolsByGuild = poolsByGuild

module.exports = poolProxy