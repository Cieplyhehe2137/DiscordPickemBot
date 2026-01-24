// registerCommands.js
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));
  if (!command?.data) {
    console.warn(`⚠️ Plik ${file} nie zawiera 'data' i zostanie pominięty.`);
    continue;
  }
  commands.push(command.data.toJSON());
}

(async () => {
  try {
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

    if (!DISCORD_TOKEN || !CLIENT_ID) {
      throw new Error('Brakuje DISCORD_TOKEN / CLIENT_ID w .env');
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    if (GUILD_ID && String(GUILD_ID).trim()) {
      // 🧪 TRYB DEV – tylko jedna guilda
      const gid = String(GUILD_ID).trim();
      console.log(`🧪 Rejestruję komendy TYLKO dla guildId=${gid}`);

      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, gid),
        { body: commands }
      );

      console.log('✅ Komendy zarejestrowane (DEV)');
    } else {
      // 🌍 TRYB PROD – GLOBALNE
      console.log('🌍 Rejestruję GLOBALNE komendy aplikacji');

      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );

      console.log('✅ Globalne komendy zarejestrowane');
      console.log('⏳ Uwaga: propagacja może potrwać do ~1h');
    }

    console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Rejestracja komend nieudana.', error);
    process.exitCode = 1;
  }
})();
