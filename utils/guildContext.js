const db = require('../db');

async function withGuild(source, fn) {
  let guildId = null;

  if (typeof source === 'string') {
    guildId = source;
  } else if (source?.guildId) {
    guildId = source.guildId;
  }

  if (!guildId) {
    throw new Error(
      `[withGuild] Brak guildId (DM / nieprawidłowe źródło): ${JSON.stringify(
        source
      )}`
    );
  }

  guildId = String(guildId);

  const pool = db.getPoolForGuild(guildId);
  if (!pool) {
    throw new Error(`[withGuild] Brak poola DB dla guildId=${guildId}`);
  }

  // 🔥 HARD ASSERT — zabija bug raz na zawsze
  const test = pool.query('SELECT 1');
  if (!test || typeof test.then !== 'function') {
    throw new Error('[withGuild] Pool is NOT mysql2/promise pool');
  }

  // ✅ JEDEN, STAŁY KONTRAKT
  return fn({ guildId, pool });
}

module.exports = {
  withGuild,
};
