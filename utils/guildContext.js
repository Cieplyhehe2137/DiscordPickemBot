const db = require('../db');

async function withGuild(source, fn) {
  let guildId = null;

  if (typeof source === 'string') {
    guildId = source;
  } else if (source?.guildId) {
    guildId = source.guildId;
  }

  if (!guildId) {
    throw new Error('[withGuild] Brak guildId (DM / nieprawidłowe źródło).');
  }

  guildId = String(guildId);

  const pool = db.getPoolForGuild(guildId);
  if (!pool) {
    throw new Error(`[withGuild] Brak poola DB dla guildId=${guildId}`);
  }

  return fn(pool, guildId);
}

module.exports = {
  withGuild,
};
