// Raport konfiguracji (/validate-config).
//
// Ta komenda nie dzialala od pierwszego dnia: wolala funkcje, ktora nie
// zwracala niczego, i czytala z tego pole. Testy nie wylapaly tego, bo
// komenda nie miala ani jednego testu - a jej jedyny objaw, "Blad
// walidatora", wyglada jak chwilowa awaria, nie jak kod, ktory nie moze
// zadzialac nigdy.
//
// Logika siedzi teraz w services/configReport.js i dostaje wszystko
// argumentami, wiec da sie ja sprawdzic bez Discorda i bez plikow.

const test = require("node:test");
const assert = require("node:assert/strict");

const { buildConfigReport } = require("../services/configReport");
const { DOMYSLNY_LOCK_BEFORE_SEC } = require("../utils/matchLock");

/** Config serwera z kompletem kanalow - punkt wyjscia dla wiekszosci testow. */
function cfgKompletny(nadpisz = {}) {
  return {
    GUILD_ID: "111111111111111111",
    GUILD_NAME: "Testowy",
    EXPORT_PANEL_CHANNEL_ID: "200",
    PICKEM_CHANNEL_ID: "201",
    ARCHIVE_CHANNEL_ID: "202",
    LOG_CHANNEL_ID: "203",
    ...nadpisz,
  };
}

/** Kazdy kanal istnieje, jest tekstowy i nalezy do tego serwera. */
const kanalyOk = async () => ({
  ok: true,
  type: "text",
  guildId: "111111111111111111",
});

function wszystko(raport) {
  return [
    ...raport.fail,
    ...raport.warn,
    ...raport.pass,
    ...raport.extraNotes,
  ].join("\n");
}

/* ---------------- w ogole dziala ---------------- */

test("raport ZWRACA cztery listy - to jest cala usterka, od ktorej sie zaczelo", async () => {
  // Poprzednia wersja oddawala undefined, a komenda czytala z tego .fail.
  const raport = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: kanalyOk,
    serverEnv: {},
  });

  assert.ok(Array.isArray(raport.fail), "fail nie jest lista");
  assert.ok(Array.isArray(raport.warn), "warn nie jest lista");
  assert.ok(Array.isArray(raport.pass), "pass nie jest lista");
  assert.ok(Array.isArray(raport.extraNotes), "extraNotes nie jest lista");
});

test("wywolanie bez zadnego argumentu nie wysypuje sie", async () => {
  // Komenda moze dostac puste wejscie przy dziwnej instalacji - raport ma
  // wtedy powiedziec, co jest nie tak, a nie rzucic wyjatkiem.
  const raport = await buildConfigReport();

  assert.equal(raport.fail.length, 1);
  assert.match(raport.fail[0], /Brak konfiguracji serwerow/);
});

/* ---------------- kanaly ---------------- */

test("brak kanalu panelu to BLAD, brak kanalu archiwum to ostrzezenie", async () => {
  // Bez panelu nie ma z czego sterowac botem. Bez archiwum dziala wszystko
  // poza jedna komenda - to nie ta sama waga.
  const raport = await buildConfigReport({
    env: {},
    guildConfigs: {
      "111111111111111111": cfgKompletny({
        EXPORT_PANEL_CHANNEL_ID: "",
        ARCHIVE_CHANNEL_ID: "",
      }),
    },
    resolveChannel: kanalyOk,
    serverEnv: {},
  });

  assert.ok(
    raport.fail.some((w) => /EXPORT_PANEL_CHANNEL_ID/.test(w)),
    "brak kanalu panelu nie zostal zglosczony jako blad",
  );

  assert.ok(
    raport.warn.some((w) => /ARCHIVE_CHANNEL_ID/.test(w)),
    "brak kanalu archiwum nie zostal zglosczony jako ostrzezenie",
  );
});

test("kanal z INNEGO serwera jest bledem", async () => {
  // Najgorszy przypadek z calej tej listy: wszystko dziala, tylko archiwum
  // turnieju jedzie na obcy serwer. Bez tej kontroli nikt tego nie zauwazy.
  const raport = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: async () => ({
      ok: true,
      type: "text",
      guildId: "999999999999999999",
    }),
    serverEnv: {},
  });

  assert.ok(
    raport.fail.some((w) => /INNEGO serwera/.test(w)),
    "kanal obcego serwera przeszedl bez bledu",
  );
});

test("kanal nieosiagalny i kanal nietekstowy sa bledami", async () => {
  const brak = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: async () => ({ ok: false, reason: "nie znaleziono" }),
    serverEnv: {},
  });

  assert.ok(brak.fail.length >= 4, "nieosiagalne kanaly nie daly bledow");

  const glosowy = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: async () => ({
      ok: true,
      type: "2",
      guildId: "111111111111111111",
    }),
    serverEnv: {},
  });

  assert.ok(
    glosowy.fail.some((w) => /nie kanal tekstowy/.test(w)),
    "kanal nietekstowy przeszedl bez bledu",
  );
});

test("wyjatek z pobierania kanalu nie przerywa raportu", async () => {
  // Discord potrafi odmowic pojedynczego pobrania. Raport ma to zapisac
  // i policzyc reszte, a nie zginac w polowie.
  const raport = await buildConfigReport({
    env: { CITO_API_KEY: "x" },
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: async () => {
      throw new Error("rate limited");
    },
    serverEnv: {},
  });

  assert.ok(raport.fail.some((w) => /rate limited/.test(w)));
  assert.ok(
    raport.pass.some((w) => /CITO_API_KEY/.test(w)),
    "raport nie dokonczyl kontroli po wyjatku",
  );
});

/* ---------------- klucz w ZLYM pliku ---------------- */

test("klucz map w server/.env, a nie w env bota, to BLAD z nazwa pliku", async () => {
  // Ten jeden przypadek kosztowal dzien szukania: watcher map nie wstawal,
  // bo klucz lezal w pliku, ktorego bot nie czyta, a wygladal na ustawiony.
  const raport = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: true },
  });

  const wpis = raport.fail.find((w) => /CITO_API_KEY/.test(w));

  assert.ok(wpis, "raport nie zglosil klucza w zlym pliku");
  assert.match(wpis, /server\/\.env/);
});

test("brak klucza map w ogole to tylko ostrzezenie", async () => {
  // Instalacja bez klucza jest poprawna - mapy wpisuje sie wtedy recznie.
  const raport = await buildConfigReport({
    env: {},
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: false },
  });

  assert.ok(raport.warn.some((w) => /CITO_API_KEY/.test(w)));
  assert.ok(!raport.fail.some((w) => /CITO_API_KEY/.test(w)));
});

/* ---------------- dwie godziny zamkniecia ---------------- */

test("rozjazd MATCH_LOCK_BEFORE_SEC miedzy botem a API jest zglaszany", async () => {
  const raport = await buildConfigReport({
    env: { CITO_API_KEY: "x", MATCH_LOCK_BEFORE_SEC: "0" },
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: true, lockBeforeSec: "300" },
  });

  const wpis = raport.warn.find((w) => /MATCH_LOCK_BEFORE_SEC/.test(w));

  assert.ok(wpis, "rozjazd nie zostal zglosczony");
  assert.match(wpis, /bot 0 s/);
  assert.match(wpis, /API 300 s/);
});

test("obie strony bez zmiennej sa ZGODNE - to jest sens wartosci domyslnej", async () => {
  // Przed poprawka bot liczyl 0, a API 300, bo zmienna stala tylko
  // w server/.env. Teraz brak zmiennej po obu stronach znaczy to samo.
  const raport = await buildConfigReport({
    env: { CITO_API_KEY: "x" },
    guildConfigs: { "111111111111111111": cfgKompletny() },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: true, lockBeforeSec: null },
  });

  assert.ok(
    raport.pass.some((w) =>
      new RegExp(`${DOMYSLNY_LOCK_BEFORE_SEC} s przed startem`).test(w),
    ),
    "brak zmiennej po obu stronach nie zostal uznany za zgodny",
  );

  assert.ok(!raport.warn.some((w) => /MATCH_LOCK_BEFORE_SEC/.test(w)));
});

/* ---------------- sekrety ---------------- */

test("raport NIE ZAWIERA ani jednej wartosci z configu", async () => {
  // Parametr `embed` wystawia ten raport na kanal, a w configu stoi token
  // bota, haslo do bazy i SESSION_SECRET. Raport mowi o nazwach kluczy.
  const sekrety = [
    "token-bota-nie-pokazuj",
    "haslo-do-bazy-nie-pokazuj",
    "sekret-sesji-nie-pokazuj",
  ];

  const raport = await buildConfigReport({
    env: {
      CITO_API_KEY: sekrety[0],
      DISCORD_TOKEN: sekrety[0],
    },
    guildConfigs: {
      "111111111111111111": cfgKompletny({
        DB_PASS: sekrety[1],
        SESSION_SECRET: sekrety[2],
        DISCORD_TOKEN: sekrety[0],
      }),
    },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: true },
  });

  const tekst = wszystko(raport);

  for (const sekret of sekrety) {
    assert.ok(
      !tekst.includes(sekret),
      `wartosc z configu trafila do raportu: ${sekret}`,
    );
  }
});

test("raport nie wypisuje pelnych identyfikatorow serwerow", async () => {
  // Nie sekret, ale raport bywa publiczny, a do rozpoznania wiersza
  // wystarcza nazwa serwera.
  const pelneId = "123456789012345678";

  const raport = await buildConfigReport({
    env: { CITO_API_KEY: "x" },
    guildConfigs: {
      [pelneId]: cfgKompletny({ GUILD_ID: pelneId, GUILD_NAME: null }),
    },
    resolveChannel: kanalyOk,
    serverEnv: { hasCitoKey: true },
  });

  assert.ok(
    !wszystko(raport).includes(pelneId),
    "pelny identyfikator serwera trafil do raportu",
  );
});

/* ---------------- komenda jest wpieta poprawnie ---------------- */

test("komenda ma prog uprawnien i NIE siega po martwy walidator", async () => {
  // Brak progu byl druga polowa usterki: raport nazywa kanaly i serwery,
  // a wpisac komende mogl kazdy uczestnik.
  const komenda = require("../commands/validate_config.js");

  const json = komenda.data.toJSON();

  assert.equal(json.name, "validate-config");

  assert.ok(
    json.default_member_permissions,
    "komenda nadal nie ma progu uprawnien",
  );

  const fs = require("node:fs");
  const path = require("node:path");

  const zrodlo = fs.readFileSync(
    path.join(__dirname, "..", "commands", "validate_config.js"),
    "utf8",
  );

  assert.doesNotMatch(
    zrodlo,
    /require\(["']\.\.\/validateConfig["']\)/,
    "komenda znow siega po funkcje, ktora nie zwraca raportu",
  );

  assert.match(zrodlo, /services\/configReport/);
});
