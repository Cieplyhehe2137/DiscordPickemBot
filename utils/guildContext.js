const pool = require('../db');

async function withGuild(interaction, fn) {
  const guildId = interaction.guildId;
  if (!guildId) {
    throw new Error('Brak guildId (DM albo błąd interakcji)');
  }

  return fn(pool, guildId);
}

module.exports = { withGuild };
