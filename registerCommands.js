const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsDir, file));
  if (!command.data) {
    console.warn(`⚠️ Plik ${file} nie zawiera 'data' i zostanie pominięty.`);
    continue;
  }
  commands.push(command.data.toJSON());
  console.log(`📜 Załadowano komendę: ${command.data.name}`);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
      throw new Error('Brakuje DISCORD_TOKEN/CLIENT_ID/GUILD_ID w .env');
    }

    console.log('🚀 Rejestruję komendy...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Komendy zarejestrowane!');
  } catch (error) {
    console.error('❌ Rejestracja komend nieudana:', error);
  }
})();
