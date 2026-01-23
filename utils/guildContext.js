// utils/guildContext.js
const db = require('../db');

async function withGuild(source, fn) {
  // source może być: interaction ALBO string guildId
  const guildId =
    typeof source === 'string'
      ? source
      : source?.guildId;

  if (!guildId) {
    throw new Error('Brak guildId (DM albo błąd interakcji)');
  }

  const pool = db.getPoolForGuild(guildId);
  return fn(pool, guildId);
}

module.exports = {
  withGuild,
};
