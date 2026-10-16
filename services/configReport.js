// Raport o konfiguracji bota - to, co pokazuje /validate-config.
//
// CO BYLO WCZESNIEJ. Komenda wolala funkcje z korzeniowego validateConfig.js,
// ktora nie przyjmowala argumentow i NIE ZWRACALA NICZEGO - po czym czytala
// `report.fail.length`. Czyli komenda konczyla sie bledem "Cannot read
// properties of undefined" za kazdym razem, od pierwszego dnia. Dodatkowo ta
// funkcja w razie braku configu wolala process.exit(1), a komenda nie miala
// progu uprawnien - czyli istniala droga, w ktorej dowolny uczestnik serwera
// zatrzymywal procesowi bota prace.
//
// CZEGO TEN RAPORT NIE SPRAWDZA. Kluczy wymaganych do wstania bota
// (GUILD_ID, DB_*) nie ma sensu sprawdzac: utils/guildRegistry.js rzuca
// wyjatkiem, gdy ich brakuje, wiec bot, ktory odpowiada na komende, ma je na
// pewno. Sprawdzanie ich jeszcze raz dawaloby raport, ktory zawsze mowi
// "wszystko dobrze" o rzeczach, ktore nie moga byc zle.
//
// CZEGO SPRAWDZA. Dokladnie tego, co moze byc zle przy dzialajacym bocie:
// klucze, ktorych brak nie zatrzymuje startu, tylko po cichu wylacza jedna
// funkcje - i to zwykle taka, ktorej brak widac dopiero w trakcie turnieju.
//
// SIEC JEST WSTRZYKIWANA. `resolveChannel` podaje sie z zewnatrz, wiec cala
// logika ma testy bez Discorda. Tak samo `env` i `serverEnv` - raport nie
// czyta niczego sam.
//
// WARTOSCI NIE WCHODZA DO RAPORTU. Nigdy. W configu stoi token bota, haslo do
// bazy i SESSION_SECRET, a raport potrafi wyladowac na kanale (parametr
// `embed`). Raport mowi WYLACZNIE o nazwach kluczy i o tym, czy cos jest
// ustawione - z jednym wyjatkiem, MATCH_LOCK_BEFORE_SEC, bo to liczba sekund,
// a jej porownanie miedzy plikami jest calym sensem tej kontroli.

const { DOMYSLNY_LOCK_BEFORE_SEC } = require("../utils/matchLock");

/*
 * Klucze kanalow: czego brak wylacza i jak bardzo.
 *
 * "fail" znaczy, ze funkcja nie dziala wcale i zglosi to dopiero przy
 * probie uzycia. "warn" - dziala w okrojonej formie.
 */
const KANALY = [
  {
    key: "EXPORT_PANEL_CHANNEL_ID",
    waga: "fail",
    bezTego: "panel administracyjny nie pojawi sie na zadnym kanale",
  },
  {
    key: "PICKEM_CHANNEL_ID",
    waga: "warn",
    bezTego:
      '"Uruchom typowanie" na stronie nie ma domyslnego kanalu - trzeba podawac ID za kazdym razem',
  },
  {
    key: "ARCHIVE_CHANNEL_ID",
    waga: "warn",
    bezTego: "/end_tournament odmowi wykonania",
  },
  {
    key: "LOG_CHANNEL_ID",
    waga: "warn",
    bezTego: "zdarzenia bota nie trafia na kanal logow",
  },
];

/** Czy wartosc w ogole jest ustawiona. Nigdzie nie oddaje samej wartosci. */
function ustawione(wartosc) {
  return Boolean(wartosc && String(wartosc).trim());
}

function krotkiGuild(guildId) {
  const tekst = String(guildId || "");

  // Identyfikator serwera nie jest sekretem, ale raport bywa publiczny,
  // a do rozpoznania wiersza wystarcza nazwa i koncowka.
  return tekst.length > 6 ? `...${tekst.slice(-6)}` : tekst;
}

/**
 * Buduje raport o konfiguracji.
 *
 * @param env            process.env bota (albo jego atrapa w testach)
 * @param guildConfigs   mapa guildId -> config, z guildRegistry
 * @param resolveChannel async (channelId) => { ok, type?, guildId?, reason? }
 * @param serverEnv      { hasCitoKey, lockBeforeSec } - to, co widzi API
 *                       w server/.env; same nazwy i jedna liczba, zero sekretow
 *
 * Zwraca { fail, warn, pass, extraNotes } - cztery listy napisow, gotowe do
 * wyswietlenia.
 */
async function buildConfigReport({
  env = {},
  guildConfigs = {},
  resolveChannel = null,
  serverEnv = {},
} = {}) {
  const fail = [];
  const warn = [];
  const pass = [];
  const extraNotes = [];

  const guildIds = Object.keys(guildConfigs);

  if (!guildIds.length) {
    fail.push("Brak konfiguracji serwerow - nie wczytano zadnego config/*.env");

    return { fail, warn, pass, extraNotes };
  }

  pass.push(
    `Wczytane serwery: ${guildIds.length} (${guildIds
      .map((id) => guildConfigs[id]?.GUILD_NAME || krotkiGuild(id))
      .join(", ")})`,
  );

  /* ---------------- kanaly, serwer po serwerze ---------------- */

  for (const guildId of guildIds) {
    const cfg = guildConfigs[guildId] || {};
    const nazwa = cfg.GUILD_NAME || krotkiGuild(guildId);

    for (const { key, waga, bezTego } of KANALY) {
      if (!ustawione(cfg[key])) {
        const wiersz = `${nazwa}: brak ${key} - ${bezTego}`;

        if (waga === "fail") fail.push(wiersz);
        else warn.push(wiersz);

        continue;
      }

      // Klucz jest - ale czy wskazuje na kanal, ktory bot widzi.
      if (typeof resolveChannel !== "function") {
        pass.push(`${nazwa}: ${key} ustawione`);
        continue;
      }

      let wynik;

      try {
        wynik = await resolveChannel(String(cfg[key]).trim());
      } catch (err) {
        wynik = { ok: false, reason: err?.message || "blad pobierania" };
      }

      if (!wynik?.ok) {
        fail.push(
          `${nazwa}: ${key} wskazuje kanal, ktorego bot nie widzi (${
            wynik?.reason || "nie znaleziono"
          })`,
        );

        continue;
      }

      // Kanal z innego serwera to najgorszy przypadek, bo wszystko dziala -
      // tylko wyniki jada do obcych ludzi.
      if (wynik.guildId && String(wynik.guildId) !== String(guildId)) {
        fail.push(
          `${nazwa}: ${key} nalezy do INNEGO serwera (${krotkiGuild(
            wynik.guildId,
          )})`,
        );

        continue;
      }

      if (wynik.type && wynik.type !== "text") {
        fail.push(`${nazwa}: ${key} to nie kanal tekstowy (${wynik.type})`);

        continue;
      }

      pass.push(`${nazwa}: ${key} wskazuje widoczny kanal tekstowy`);
    }
  }

  /* ---------------- klucze czytane z process.env bota ---------------- */

  // Watcher map. Ten konkretny klucz ma wlasna historie: byl wpisany do
  // server/.env, ktorego bot nie czyta, wiec watcher nie wstawal, a jedynym
  // objawem byl brak map - czyli stan nieodroznialny od sprzed calej roboty.
  if (ustawione(env.CITO_API_KEY)) {
    pass.push("CITO_API_KEY ustawione - watcher map wstanie");
  } else if (serverEnv.hasCitoKey) {
    fail.push(
      "CITO_API_KEY stoi w server/.env, ale NIE w env bota - watcher map nie wstanie. " +
        "Bot czyta tylko swoj .env; server/.env czyta API i skrypt map",
    );
  } else {
    warn.push(
      "Brak CITO_API_KEY - mapy po veto trzeba wpisywac recznie w panelu",
    );
  }

  // Godzina zamkniecia typowania meczu. Ta zmienna stala dotad TYLKO
  // w server/.env, wiec strona zamykala piec minut przed startem, a bot
  // dokladnie o starcie - dwie rozne godziny dla jednego meczu.
  const botLock = ustawione(env.MATCH_LOCK_BEFORE_SEC)
    ? Number(String(env.MATCH_LOCK_BEFORE_SEC).trim())
    : DOMYSLNY_LOCK_BEFORE_SEC;

  const apiLock = ustawione(serverEnv.lockBeforeSec)
    ? Number(String(serverEnv.lockBeforeSec).trim())
    : DOMYSLNY_LOCK_BEFORE_SEC;

  if (!Number.isFinite(botLock)) {
    warn.push(
      `MATCH_LOCK_BEFORE_SEC w env bota nie jest liczba - uzywam ${DOMYSLNY_LOCK_BEFORE_SEC} s`,
    );
  } else if (botLock !== apiLock) {
    warn.push(
      `MATCH_LOCK_BEFORE_SEC rozne po dwoch stronach: bot ${botLock} s, API ${apiLock} s - ` +
        "ten sam mecz zamknie sie na stronie i na Discordzie o innej godzinie",
    );
  } else {
    pass.push(
      `MATCH_LOCK_BEFORE_SEC zgodne po obu stronach: ${botLock} s przed startem`,
    );
  }

  /* ---------------- notatki ---------------- */

  if (!serverEnv || Object.keys(serverEnv).length === 0) {
    extraNotes.push(
      "Nie udalo sie zajrzec do server/.env - kontrola zgodnosci z API pominieta",
    );
  }

  extraNotes.push(
    "Raport nie pokazuje zadnych wartosci z configu, tylko nazwy kluczy.",
  );

  return { fail, warn, pass, extraNotes };
}

module.exports = {
  buildConfigReport,
  KANALY,
};
