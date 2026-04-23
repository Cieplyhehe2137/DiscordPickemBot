// registerCommands.js
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

/* =======================
   LOAD ENV FROM /config
======================= */

// Wybór ENV:
// ENV_NAME=hyperland  -> config/hyperland.env
// ENV_NAME=luffastream -> config/luffastream.env
const envName = process.env.ENV_NAME || 'hyperland';
const envPath = path.join(__dirname, 'config', `${envName}.env`);

if (!fs.existsSync(envPath)) {
  console.error(`❌ Nie znaleziono pliku ENV: ${envPath}`);
  process.exit(1);
}

dotenv.config({ path: envPath });
// console.log(`🌍 Załadowano ENV: config/${envName}.env`);

/* =======================
   LOAD COMMANDS
======================= */

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsDir)
  .filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));
  if (!command?.data) {
    console.warn(`⚠️ Plik ${file} nie zawiera 'data' i zostanie pominięty.`);
    continue;
  }
  commands.push(command.data.toJSON());
}

/* =======================
   REGISTER
======================= */

(async () => {
  try {
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

    if (!DISCORD_TOKEN || !CLIENT_ID) {
      throw new Error('Brakuje DISCORD_TOKEN lub CLIENT_ID w ENV');
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    if (GUILD_ID && String(GUILD_ID).trim()) {
      // 🧪 DEV – rejestracja na jednej guildzie
      const gid = String(GUILD_ID).trim();

      // console.log(`🧪 TRYB DEV`);
      // console.log(`➡️ Rejestruję komendy TYLKO dla guildId=${gid}`);

      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, gid),
        { body: commands }
      );

      // console.log('✅ Komendy zarejestrowane (DEV)');
    } else {
      // 🌍 PROD – globalne komendy
      // console.log(`🌍 TRYB PROD`);
      // console.log('➡️ Rejestruję GLOBALNE komendy aplikacji');

      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );

      // console.log('✅ Globalne komendy zarejestrowane');
      // console.log('⏳ Uwaga: propagacja może potrwać 5–60 minut');
    }

    // console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Rejestracja komend nieudana:', error);
    process.exitCode = 1;
  }
})();
