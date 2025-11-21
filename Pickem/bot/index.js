require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const logger = require('./utils/logger');

const { loadHandlers } = require('./loader');
const handleInteraction = require('./interactionRouter');
const onReady = require('./onReady');
const { closeExpiredPanels } = require('./utils/closeExpiredPanels');
// const startHLTVWatcher = require('./utils/syncHLTVWatcher'); 


// ───────────────────────────────────────────────
// Globalne łapanie błędów
// ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error({ err }, '❌ uncaughtException');
});

process.on('unhandledRejection', (err) => {
  logger.error({ err }, '❌ unhandledRejection');
});

// ───────────────────────────────────────────────
// Debug ENV (jedno miejsce, czytelnie)
// ───────────────────────────────────────────────
function logEnv() {
  console.log('==================== 🌍 DEBUG ENV ====================');
  [
    'DISCORD_TOKEN',
    'CLIENT_ID',
    'GUILD_ID',
    'EXPORT_CHANNEL_ID',
    'LOG_CHANNEL_ID',
    'DB_HOST',
    'DB_USER',
    'DB_NAME',
    'DB_PORT',
  ].forEach((key) => {
    const val = process.env[key];
    console.log(`${key}:`, val ? '✅ załadowany' : '❌ BRAK');
  });
  console.log('=====================================================');
}

logEnv();

// ───────────────────────────────────────────────
// Konfiguracja klienta Discord
// ───────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ───────────────────────────────────────────────
// Ładowanie komend (slashy)
// ───────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'))
  .forEach((file) => {
    try {
      const command = require(path.join(commandsPath, file));
      if (!command?.data?.name) {
        logger.warn({ file }, '⚠️ Plik komendy bez data.name – pomijam');
        return;
      }
      client.commands.set(command.data.name, command);
    } catch (err) {
      logger.error({ err, file }, '❌ Błąd przy ładowaniu komendy');
    }
  });

// ───────────────────────────────────────────────
// Mapy interakcji + cache handlerów
// ───────────────────────────────────────────────
const maps = {
  buttonMap: require('./maps/buttonMap'),
  modalMap: require('./maps/modalMap'),
  selectMap: require('./maps/selectMap'),
  dropdownMap: require('./maps/dropdownMap'),
};

// Ładujemy handlerów raz, a nie przy każdym kliknięciu
const handlerCache = loadHandlers('handlers');

// ───────────────────────────────────────────────
// Eventy diagnostyczne klienta
// ───────────────────────────────────────────────
client.on('error', (e) => logger.error({ err: e }, '💥 client error'));
client.on('warn', (w) => logger.warn({ warn: w }, '⚠️ client warn'));
client.on('shardError', (e) => logger.error({ err: e }, '💥 shard error'));

// ───────────────────────────────────────────────
// READY
// ───────────────────────────────────────────────
client.once('ready', async () => {
  try {
    console.log(`🤖 Discord READY jako ${client.user.tag} (id: ${client.user.id})`);
    console.log('⏰ Uruchamiam autostarty...');

    // startHLTVWatcher(); 
   
    // Presence – żeby było widać, że bot żyje
    if (client.user?.setPresence) {
      client.user.setPresence({
        activities: [{ name: 'Pick’Em panel' }],
        status: 'online',
      });
    }

    try {
      await onReady(client);
      console.log('✅ onReady() zakończone');
    } catch (err) {
      logger.error({ err }, '❌ Błąd w onReady()');
    }

    // 🕒 co 15 sekund sprawdzaj deadliny i automatycznie zamykaj panele
    setInterval(() => {
      closeExpiredPanels(client).catch((err) =>
        logger.error({ err }, '❌ Błąd w closeExpiredPanels tick')
      );
    }, 15 * 1000);

    console.log('⏱️ Uruchomiono automatyczne sprawdzanie paneli (co 15s)');
  } catch (err) {
    logger.error({ err }, '❌ Błąd w ready-handlerze');
  }
});

// ───────────────────────────────────────────────
// Obsługa interakcji
// ───────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction, client, handlerCache, maps, logger);
  } catch (err) {
    logger.error({ err }, '❌ interactionCreate error');

    // Opcjonalne grzeczne info dla usera
    try {
      if (interaction.isRepliable && interaction.isRepliable()) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Wystąpił niespodziewany błąd przy obsłudze tej interakcji.',
            ephemeral: true,
          });
        }
      }
    } catch {
      // tu już nie spamujemy logami, żeby nie robić pętli błędów
    }
  }
});

// ───────────────────────────────────────────────
// Start bota
// ───────────────────────────────────────────────
const rawToken = process.env.DISCORD_TOKEN;
const TOKEN = (rawToken || '').trim();

if (!TOKEN) {
  console.error('❌ Brak DISCORD_TOKEN w ENV!');
  // Możesz wyjść z procesem, żeby Cybrancee / PM2 itp. miały jasny sygnał
  process.exit(1);
} else {
  console.log('🔎 DISCORD_TOKEN length =', TOKEN.length);
  if (/\s/.test(rawToken)) {
    console.warn(
      '⚠️ Uwaga: w oryginalnym DISCORD_TOKEN wykryto znak białej spacji — .trim() to usuwa, ale usuń ją też z ENV.'
    );
  }

  // Watchdog: jeśli READY nie przyjdzie w 25s, zgłoś
  const readyTimeout = setTimeout(() => {
    console.error(
      '⏱️ 25s bez READY — to zwykle token/sieć/gateway. Sprawdź logi powyżej.'
    );
  }, 25_000);

  client
    .login(TOKEN)
    .then(() => {
      clearTimeout(readyTimeout);
      console.log('✅ client.login() OK — czekam na READY…');
    })
    .catch((err) => {
      clearTimeout(readyTimeout);
      logger.error({ err }, '❌ client.login error');
      console.error('❌ client.login error:', err);
    });
}
