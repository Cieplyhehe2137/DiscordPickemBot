// validateConfig.js
const fs = require('fs');
const path = require('path');
require('dotenv').config();

module.exports = function validateConfig() {
  const requiredVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error(`❌ Brakujące zmienne środowiskowe: ${missing.join(', ')}`);
    process.exit(1);
  }

  const teamsPath = path.join(__dirname, 'teams.json');
  if (!fs.existsSync(teamsPath)) {
    console.error('❌ Brak pliku teams.json w katalogu głównym!');
    process.exit(1);
  }

  console.log('✅ Konfiguracja poprawna – wszystkie wymagane pliki i zmienne istnieją.');
};
