require('dotenv').config();

const { getAllGuildConfig } = require('./utils/guildRegistry');

module.exports = function validateConfig() {
  const requiredRoot = ['DISCORD_TOKEN', 'CLIENT_ID'];
  const missingRoot = requiredRoot.filter(k => !process.env[k] || !String(process.env[k]).trim());

  if (missingRoot.length) {
    console.error(`❌ Brakujące zmienne w root .env: ${missingRoot.join(', ')}`);
    process.exit(1);
  }

  // Walidacja per-guild robi się w guildRegistry (czyta config/*env i sprawdza wymagane klucze).
  try {
    const cfgs = getAllGuildConfig();
    if (!cfgs || !Object.keys(cfgs).length) {
      console.error('❌ Brak konfiguracji guild (config/*.env) i brak legacy root GUILD_ID/DB_*');
      process.exit(1);
    }
  } catch (e) {
    console.error(`❌ Błąd konfiguracji guild: ${e.message}`);
    process.exit(1);
  }
};