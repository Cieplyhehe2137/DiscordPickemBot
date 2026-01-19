const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// =======================
// ENV
// =======================
const envPath = process.env.ENV_FILE || '.env';
const resolvedEnvPath = path.isAbsolute(envPath)
  ? envPath
  : path.join(process.cwd(), envPath);

dotenv.config({ path: resolvedEnvPath });

console.log('ENV_FILE:', resolvedEnvPath);
if (!fs.existsSync(resolvedEnvPath)) {
  console.warn(`⚠️ ENV_FILE path nie istnieje: ${resolvedEnvPath}`);
}

// =======================
// DISCORD
// =======================
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const handleInteraction = require('./interactionRouter');
const onReady = require('./onReady');
const { closeExpiredPanels } = require('./utils/closeExpiredPanels');
const startPresence = require('./utils/startPresence');

// =======================
// GIT / DEPLOY DEBUG
// =======================
function getGitCommit() {
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    const head = fs.readFileSync(headPath, 'utf8').trim();

    if (head.startsWith('ref:')) {
      const ref = head.split(' ')[1].trim();
      const refPath = path.join(process.cwd(), '.git', ref);
      return fs.readFileSync(refPath, 'utf8').trim();
    }
    return head;
  } catch {
    return 'no-git';
  }
}

console.log('=== DEPLOY DEBUG ===');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('GIT COMMIT:', getGitCommit());
console.log('DEPLOY TS:', new Date().toISOString());
console.log('====================');

// =======================
// ENV CHECK
// =======================
console.log('==================== 🌍 DEBUG ENV ====================');
[
  'DISCORD_TOKEN',
  'CLIENT_ID',
  'GUILD_ID',
  'EXPORT_PANEL_CHANNEL_ID',
  'LOG_CHANNEL_ID',
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'DB_PORT'
].forEach((key) => {
  console.log(`${key}:`, process.env[key] ? '✅ załadowany' : '❌ BRAK');
});
console.log('=====================================================');

// =======================
// CLIENT
// =======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// =======================
// SHARD / SESSION DIAG
// =======================
client.on('shardDisconnect', (event, id) => {
  console.warn(
    `⚠️ [SHARD DISCONNECT] shard ${id} code=${event?.code ?? 'unknown'}`
  );
});

client.on('shardResume', (id, replayed) => {
  console.log(`✅ [SHARD RESUME] shard ${id} replayed=${replayed}`);
});

client.on('invalidated', () => {
  console.warn('🚫 [INVALIDATED] sesja unieważniona (token / druga instancja)');
});

// =======================
// COMMANDS
// =======================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
  });

// =======================
// EVENTS
// =======================
client.on('error', (e) => console.error('💥 client error:', e));
client.on('warn', (w) => console.warn('⚠️ client warn:', w));

// =======================
// READY
// =======================
client.once('ready', async () => {
  try {
    console.log(`🤖 Discord READY jako ${client.user.tag} (${client.user.id})`);

    await onReady(client);
    console.log('✅ onReady() zakończone');

    startPresence(client);

    setInterval(() => {
      closeExpiredPanels(client).catch(err =>
        console.error('❌ closeExpiredPanels error:', err)
      );
    }, 15_000);

    console.log('⏱️ closeExpiredPanels uruchomione (co 15s)');
  } catch (e) {
    console.error('❌ Błąd w ready handlerze:', e);
  }
});

// =======================
// INTERACTIONS (JEDYNE MIEJSCE)
// =======================
client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (e) {
    console.error('❌ interactionCreate error:', e);
  }
});

// =======================
// LOGIN
// =======================
const rawToken = process.env.DISCORD_TOKEN;
const TOKEN = (rawToken || '').trim();

if (!TOKEN) {
  console.error('❌ Brak DISCORD_TOKEN w ENV!');
} else {
  console.log('🔎 DISCORD_TOKEN length =', TOKEN.length);

  const readyTimeout = setTimeout(() => {
    console.error('⏱️ 25s bez READY — problem z tokenem / gateway');
  }, 25_000);

  client.login(TOKEN)
    .then(() => {
      clearTimeout(readyTimeout);
      console.log('✅ client.login() OK — czekam na READY…');
    })
    .catch((e) => {
      clearTimeout(readyTimeout);
      console.error('❌ client.login error:', e);
    });

  process.on('unhandledRejection', (r) =>
    console.error('❌ UnhandledRejection:', r)
  );
  process.on('uncaughtException', (e) =>
    console.error('❌ UncaughtException:', e)
  );
}
