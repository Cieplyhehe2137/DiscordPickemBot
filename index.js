const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const {
  logInfo,
  logError,
  logCommandStart,
  logCommandSuccess,
  logCommandError
} = require('./utils/logger');

const envPath = process.env.ENV_FILE || '.env';
const resolvedEnvPath = path.isAbsolute(envPath)
  ? envPath
  : path.join(process.cwd(), envPath);

dotenv.config({ path: resolvedEnvPath });

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logError('UNHANDLED_REJECTION', err);
});

process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', err);
});

if (!fs.existsSync(resolvedEnvPath)) {
  console.warn(`⚠️ ENV_FILE path nie istnieje: ${resolvedEnvPath}`);
}

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadHandlers } = require('./loader');
const handleInteraction = require('./interactionRouter');
const onReady = require('./onReady');
const { closeExpiredPanels } = require('./utils/closeExpiredPanels');

let readyTimeout = null;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on('shardDisconnect', (event, id) => {
  logInfo('SHARD_DISCONNECT', {
    extra: {
      shardId: id,
      code: event?.code ?? event?.closeCode ?? 'unknown',
      reason: event?.reason ?? event?.closeReason ?? 'unknown',
      clean: event?.wasClean ?? 'unknown',
    },
  });
});

client.commands = new Collection();

fs.readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
  });

const maps = {
  buttonMap: require('./maps/buttonMap'),
  selectMap: require('./maps/selectMap'),
  dropdownMap: require('./maps/dropdownMap'),
  modalMap: require('./maps/modalMap'),
};

client.on('error', (e) => {
  logError('DISCORD_CLIENT_ERROR', e);
  console.error('💥 client error:', e);
});

client.on('warn', (w) => {
  logInfo('DISCORD_CLIENT_WARN', { extra: w });
  console.warn('⚠️ client warn:', w);
});

client.once('ready', async () => {
  if (readyTimeout) clearTimeout(readyTimeout);

  logInfo('BOT_READY', {
    extra: {
      botTag: client.user.tag,
      botId: client.user.id,
    },
  });

  console.log(`✅ Zalogowano jako ${client.user.tag}`);

  setInterval(() => {
    closeExpiredPanels(client);
  }, 30 * 1000);

  closeExpiredPanels(client);

  try {
    await onReady(client);
  } catch (err) {
    logError('ON_READY_FAILED', err);
    console.error('❌ onReady failed:', err);
  }
});

const handlers = loadHandlers('handlers');

client.on('interactionCreate', async (interaction) => {
  try {
    logCommandStart(interaction);

    await handleInteraction(interaction, client, handlers, maps);

    logCommandSuccess(interaction);
  } catch (e) {
    logCommandError(interaction, e);
    console.error('❌ interactionCreate error:', e);
  }
});

// 🔑 Start z diagnostyką
const rawToken = process.env.DISCORD_TOKEN;
const TOKEN = (rawToken || '').trim();

console.log('[BOOT] ENV_FILE:', resolvedEnvPath);
console.log('[BOOT] token exists:', Boolean(TOKEN));
console.log('[BOOT] token length:', TOKEN.length);

if (!TOKEN) {
  console.error('❌ Brak DISCORD_TOKEN w ENV!');
} else {
  if (/\s/.test(rawToken || '')) {
    console.warn('⚠️ DISCORD_TOKEN ma spację/enter w ENV.');
  }

  readyTimeout = setTimeout(() => {
    console.error('❌ READY nie przyszedł po 25s. Bot nie zalogował się do Discorda.');
  }, 25000);

  console.log('[BOOT] logging into Discord...');

  client.login(TOKEN)
    .then(() => {
      console.log('[BOOT] client.login resolved');
    })
    .catch((e) => {
      if (readyTimeout) clearTimeout(readyTimeout);
      logError('CLIENT_LOGIN_ERROR', e);
      console.error('❌ client.login error:', e);
    });
}