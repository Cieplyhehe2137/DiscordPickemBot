const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const { getAllGuildIds } = require('./utils/guildRegistry');
const { version } = require('os');

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
      throw new Error('Brakuje DISCORD_TOKEN/CLIENT_ID w root .env');
    }

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    // Jeśli podamy w GUILD_ID w root .env - zarejestruje tylko tam (debug/awaryjnie).
    // W przeciwnym wypadku rejestrujemy po wszystkich guildach z config/*.env.
    const guildIds = (GUILD_ID && String(GUILD_ID).trim())
      ? [String(GUILD_ID).trim()]
      : getAllGuildIds();

    if (!guildIds.length) {
      throw new Error('Nie znaleziono żadnych guildy do rejestracji (brak GUILD_ID w .env i brak config/*.env).');
    }

    console.log(`🚀 Rejestruję komendy dla ${guildIds.length} guild(y) : ${guildIds.join(', ')}`);

    for (const gid of guildIds) {
      await rest.put(
        Routes.applicationGuildCommands(GUILD_ID, gid),
        { body: commands }
      );
      console.log(`✅ Komendy zarejestrowane dla guildId=${gid}`);
    }

    console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Rejestracja komendy nieudana.', error);
    process.exitCode = 1;
  }
})();