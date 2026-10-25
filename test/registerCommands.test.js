// Rejestracja komend: wybor serwera i skladanie configu.
//
// TRZY RZECZY, KTORE TU POSZLY ZLE W PRAKTYCE.
//
// 1. DOMYSLNY SERWER. Skrypt mial wpisana wartosc domyslna ENV_NAME, wiec
//    `npm run deploy-commands` bez tej zmiennej rejestrowalo komendy na
//    JEDNYM konkretnym serwerze, wypisywalo "✅ Komendy zarejestrowane"
//    i konczylo sie sukcesem. Na serwerze, o ktory chodzilo, nie pojawialo
//    sie nic - rejestracja idzie per gildia, nie globalnie. Zadna wartosc
//    domyslna nie jest tu dobra, bo kazda jest czyims produkcyjnym serwerem.
//
// 2. _base.env. utils/guildRegistry.js mowi wprost, ze klucz moze stac
//    w pliku serwera ALBO we wspolnym _base.env - i bot tak wlasnie wstaje.
//    Skrypt rejestracji czytal wylacznie plik serwera, wiec ten sam config
//    dawal dwie rozne odpowiedzi: bot dzialal, a rejestracja padala na
//    "Brakuje DISCORD_TOKEN lub CLIENT_ID".
//
// 3. KONIEC PLIKU. Brak znaku nowej linii zaszumia kazdy kolejny diff na tym
//    pliku - zmiana ostatniej linii pokazuje sie jako usuniecie i dodanie.
//
// Test NIE uruchamia sciezki z poprawnym configiem: tam skrypt wysyla
// komendy do Discorda prawdziwym tokenem.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKRYPT = path.join(__dirname, "..", "registerCommands.js");

function zrodlo() {
  return fs.readFileSync(SKRYPT, "utf8");
}

test("brak ENV_NAME nie wybiera serwera po cichu", () => {
  const kod = zrodlo();

  // Zadnej wartosci domyslnej przy ENV_NAME.
  assert.doesNotMatch(
    kod,
    /process\.env\.ENV_NAME\s*\|\|\s*["'][a-z]/i,
    "ENV_NAME ma znowu domyslny serwer",
  );

  assert.ok(
    kod.includes("Brakuje ENV_NAME"),
    "brak ENV_NAME nie konczy sie czytelnym bledem",
  );
});

test("blad wypisuje liste dostepnych configow", () => {
  const kod = zrodlo();

  assert.ok(
    kod.includes("dostepneConfigi") || kod.includes("Dostępne"),
    "komunikat nie podpowiada, co mozna wpisac",
  );

  // _base.env nie jest serwerem i nie moze trafic na te liste.
  assert.ok(
    kod.includes('"_base.env"'),
    "lista configow nie odsiewa wspolnego _base.env",
  );
});

test("skrypt czyta wspolny _base.env", () => {
  const kod = zrodlo();

  assert.ok(
    kod.includes("_base.env"),
    "rejestracja nadal nie zna wspolnego pliku, a bot go czyta",
  );
});

test("plik konczy sie znakiem nowej linii", () => {
  const bajty = fs.readFileSync(SKRYPT);

  assert.ok(
    bajty.length > 0 && bajty[bajty.length - 1] === 0x0a,
    "brak znaku nowej linii na koncu - kazdy kolejny diff bedzie zaszumiony",
  );
});

test("plik serwera wygrywa z _base.env, a brakujace klucze dochodza z niego", () => {
  // To jest regula z guildRegistry, odtworzona tym samym mechanizmem, ktorego
  // uzywa skrypt: dotenv NIE nadpisuje tego, co juz stoi, wiec plik serwera
  // ladowany PIERWSZY wygrywa, a base tylko uzupelnia dziury.
  const dotenv = require("dotenv");

  const katalog = fs.mkdtempSync(path.join(os.tmpdir(), "pickem-env-"));

  try {
    const serwer = path.join(katalog, "serwer.env");
    const baza = path.join(katalog, "_base.env");

    fs.writeFileSync(serwer, "GUILD_ID=111\nDISCORD_TOKEN=wlasny\n");
    fs.writeFileSync(baza, "DISCORD_TOKEN=wspolny\nCLIENT_ID=999\n");

    // processEnv zamiast process.env: test nie zasmieca wlasnego srodowiska.
    const env = {};

    dotenv.config({ path: serwer, processEnv: env });
    dotenv.config({ path: baza, processEnv: env });

    assert.equal(env.GUILD_ID, "111", "zgubiony klucz z pliku serwera");
    assert.equal(
      env.DISCORD_TOKEN,
      "wlasny",
      "wspolny _base.env nadpisal plik serwera",
    );
    assert.equal(
      env.CLIENT_ID,
      "999",
      "brakujacy klucz nie doszedl z _base.env",
    );
  } finally {
    fs.rmSync(katalog, { recursive: true, force: true });
  }
});

test("kolejnosc wczytywania w skrypcie jest wlasnie taka", () => {
  const kod = zrodlo();

  const serwer = kod.indexOf("dotenv.config({ path: envPath })");
  const baza = kod.indexOf("dotenv.config({ path: basePath })");

  assert.ok(serwer > 0, "skrypt nie wczytuje pliku serwera");
  assert.ok(baza > 0, "skrypt nie wczytuje _base.env");

  assert.ok(
    serwer < baza,
    "_base.env wczytuje sie PRZED plikiem serwera - wtedy nadpisze jego klucze",
  );
});
