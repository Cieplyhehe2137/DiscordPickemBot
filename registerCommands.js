// registerCommands.js
const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");
const dotenv = require("dotenv");

/* =======================
   LOAD ENV FROM /config
======================= */

const configDir = path.join(__dirname, "config");

/** Nazwy configów serwerów: pliki .env poza wspólnym _base.env. */
function dostepneConfigi() {
  if (!fs.existsSync(configDir)) return [];

  return fs
    .readdirSync(configDir)
    .filter((f) => f.toLowerCase().endsWith(".env"))
    .filter((f) => f.toLowerCase() !== "_base.env")
    .map((f) => f.replace(/\.env$/i, ""))
    .sort();
}

/*
 * ENV_NAME JEST WYMAGANE - bez domyślnego serwera.
 *
 * Stała tu wcześniej wartość domyślna i to jest najcichsza pomyłka, jaką ten
 * skrypt potrafił zrobić: `npm run deploy-commands` bez ENV_NAME rejestrowało
 * komendy na JEDNYM konkretnym serwerze, wypisywało „✅ Komendy
 * zarejestrowane" i kończyło się sukcesem. Na serwerze, o który chodziło, nie
 * pojawiało się nic - bo rejestracja idzie per gildia, a nie globalnie.
 *
 * Nie ma dobrej wartości domyślnej: każda z nich jest czyimś produkcyjnym
 * serwerem. Lepszy jest błąd z listą do wyboru.
 */
const envName = String(process.env.ENV_NAME || "").trim();

if (!envName) {
  const lista = dostepneConfigi();

  console.error("❌ Brakuje ENV_NAME - nie wiadomo, na który serwer rejestrować.");
  console.error(
    lista.length
      ? `   Dostępne: ${lista.join(", ")}`
      : "   W katalogu config/ nie ma żadnego pliku .env",
  );
  console.error("   Przykład: ENV_NAME=hyperland npm run deploy-commands");
  process.exit(1);
}

const envPath = path.join(configDir, `${envName}.env`);

if (!fs.existsSync(envPath)) {
  const lista = dostepneConfigi();

  console.error(`❌ Nie znaleziono pliku ENV: ${envPath}`);
  if (lista.length) console.error(`   Dostępne: ${lista.join(", ")}`);
  process.exit(1);
}

/*
 * NAJPIERW PLIK SERWERA, POTEM WSPÓLNY _base.env.
 *
 * Taka kolejność daje dokładnie tę samą regułę, co utils/guildRegistry.js:
 * „Klucz może być w pliku serwera albo we wspólnym _base.env", przy czym plik
 * serwera wygrywa. Działa to dlatego, że dotenv NIE nadpisuje tego, co już
 * stoi w process.env - ani zmiennych ze środowiska, ani wczytanych wcześniej.
 *
 * Bez tego bot wstawał z configem opartym na _base.env, a rejestracja komend
 * dla tego samego serwera padała na „Brakuje DISCORD_TOKEN lub CLIENT_ID".
 * Dwa pliki, jedna konfiguracja, dwie różne odpowiedzi.
 */
dotenv.config({ path: envPath });

const basePath = path.join(configDir, "_base.env");
const bazaJest = fs.existsSync(basePath);

if (bazaJest) dotenv.config({ path: basePath });

console.log(
  `🌍 Załadowano ENV: config/${envName}.env${bazaJest ? " + config/_base.env" : ""}`,
);

/* =======================
   LOAD COMMANDS
======================= */

const commands = [];
const commandsDir = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsDir)
  .filter((f) => f.endsWith(".js"));

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
      throw new Error("Brakuje DISCORD_TOKEN lub CLIENT_ID w ENV");
    }

    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

    if (GUILD_ID && String(GUILD_ID).trim()) {
      // 🧪 DEV – rejestracja na jednej guildzie
      const gid = String(GUILD_ID).trim();

      console.log(`🧪 TRYB DEV`);
      console.log(`➡️ Rejestruję komendy TYLKO dla guildId=${gid}`);

      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, gid), {
        body: commands,
      });

      console.log('✅ Komendy zarejestrowane (DEV)');
    } else {
      // 🌍 PROD – globalne komendy
      console.log(`🌍 TRYB PROD`);
      console.log('➡️ Rejestruję GLOBALNE komendy aplikacji');

      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

      console.log('✅ Globalne komendy zarejestrowane');
      console.log('⏳ Uwaga: propagacja może potrwać 5–60 minut');
    }

    console.log('🎉 Done!');
  } catch (error) {
    console.error("❌ Rejestracja komend nieudana:", error);
    process.exitCode = 1;
  }
})();
