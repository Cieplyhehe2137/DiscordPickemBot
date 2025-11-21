const fs = require('fs');
const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
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
    console.log('🚀 Rejestruję komendy...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Komendy zarejestrowane!');
  } catch (error) {
    console.error(error);
  }
})();
