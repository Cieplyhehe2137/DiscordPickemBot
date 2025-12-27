require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { loadHandlers } = require('./loader');
const handleInteraction = require('./interactionRouter');
const onReady = require('./onReady');
const { closeExpiredPanels } = require('./utils/closeExpiredPanels');

function getGitCommit() {
  try {
    const headPath = path.join(process.cwd(), ".git", "HEAD");
    const head = fs.readFileSync(headPath, "utf8").trim();

    if (head.startsWith("ref:")) {
      const ref = head.split(" ")[1].trim();
      const refPath = path.join(process.cwd(), ".git", ref);
      return fs.readFileSync(refPath, "utf8").trim();
    }
    return head;
  } catch (e) {
    return "no-git";
  }
}

console.log("=== DEPLOY DEBUG ===");
console.log("CWD:", process.cwd());
console.log("ENTRY __dirname:", __dirname);
console.log("GIT COMMIT:", getGitCommit());
console.log("DEPLOY TS:", new Date().toISOString());
console.log("====================");


// 🌍 Debugowanie zmiennych środowiskowych
console.log('==================== 🌍 DEBUG ENV ====================');
[
  'DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'EXPORT_PANEL_CHANNEL_ID', 'LOG_CHANNEL_ID',
  'DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT'
].forEach((key) => {
  const val = process.env[key];
  console.log(`${key}:`, val ? '✅ załadowany' : '❌ BRAK');
});
console.log('=====================================================');

// 🔧 Konfiguracja klienta Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});




client.on('shardDisconnect', (event, id) => {
  const code = event?.code ?? event?.closeCode ?? 'unknown';
  const reason = event?.reason ?? event?.closeReason ?? 'unknown';
  const clean = event?.wasClean ?? 'unknown';

  console.warn(
    `⚠️ [SHARD DISCONNECT] shard ${id} code=${code} clean=${clean} reason=${reason}`
  );
});

client.on('shardResume', (id, replayed) => {
  console.log(`✅ [SHARD RESUME] shard ${id} replayed=${replayed}`);
});

client.on('invalidated', () => {
  console.warn('🚫 [INVALIDATED] sesja unieważniona (często: druga instancja bota albo problem z tokenem)');
});



// 📦 Ładowanie komend
client.commands = new Collection();
fs.readdirSync(path.join(__dirname, 'commands'))
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
  });

// 📥 Mapy interakcji
const maps = {
  buttonMap: require('./maps/buttonMap'),
  selectMap: require('./maps/selectMap'),
  dropdownMap: require('./maps/dropdownMap'),
  modalMap: require('./maps/modalMap')
};

// 🚀 Eventy (diag)
client.on('error', (e) => console.error('💥 client error:', e));
client.on('warn',  (w) => console.warn('⚠️ client warn:', w));

// Zabezpieczenie: wyraźny log READY + presence, a dopiero potem bezpiecznie onReady()
client.once('ready', async () => {
  try {
    console.log(`🤖 Discord READY jako ${client.user.tag} (id: ${client.user.id})`);
    // pokaż, że żyje
    if (client.user && client.user.setPresence) {
      client.user.setPresence({ activities: [{ name: 'Pick’Em panel' }], status: 'online' });
    }
    // teraz bezpiecznie wywołujemy Twój handler
    try {
      await onReady(client);
      console.log('✅ onReady() zakończone');
        // 🕒 co 15 sekund sprawdzaj deadliny i automatycznie zamykaj panele
setInterval(() => {
  closeExpiredPanels(client).catch(err =>
    console.error('❌ Błąd w closeExpiredPanels tick:', err)
  );
}, 15 * 1000);

console.log('⏱️ Uruchomiono automatyczne sprawdzanie paneli (co 15s)');

    } catch (e) {
      console.error('❌ Błąd w onReady():', e);
    }
  } catch (e) {
    console.error('❌ Błąd w ready-handlerze:', e);
  }
});

const handlers = loadHandlers('handlers');

client.on('interactionCreate', (interaction) => {
  try {
    handleInteraction(interaction, client, handlers, maps);
  } catch (e) {
    console.error('❌ interactionCreate error:', e);
  }
});

// 🔑 Start z twardą diagnostyką
const rawToken = process.env.DISCORD_TOKEN;
const TOKEN = (rawToken || '').trim();

if (!TOKEN) {
  console.error('❌ Brak DISCORD_TOKEN w ENV!');
} else {
  console.log('🔎 DISCORD_TOKEN length =', TOKEN.length);
  if (/\s/.test(rawToken)) {
    console.warn('⚠️ Uwaga: w oryginalnym DISCORD_TOKEN wykryto znak białej spacji — .trim() to usuwa, ale usuń ją też z ENV.');
  }

  // watchdog: jeśli READY nie przyjdzie w 25s, zgłoś
  const readyTimeout = setTimeout(() => {
    console.error('⏱️ 25s bez READY — to zwykle token/sieć/gateway. Sprawdź logi powyżej.');
  }, 25000);

  client.login(TOKEN)
    .then(() => {
      console.log('✅ client.login() OK — czekam na READY…');
    })
    .catch((e) => {
      clearTimeout(readyTimeout);
      console.error('❌ client.login error:', e);
    });

  // czytelniejsze info o nieobsłużonych wyjątkach
  process.on('unhandledRejection', (r) => console.error('❌ UnhandledRejection:', r));
  process.on('uncaughtException', (e) => console.error('❌ UncaughtException:', e));
}

