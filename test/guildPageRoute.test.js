// Strona pojedynczej spolecznosci (/api/public/:guildSlug).
//
// Trasa istniala od dawna i oddawala komplet danych, ale nic jej nie wolalo -
// w kodzie przewijala sie wylacznie jako wzorzec przeslaniajacy inne adresy.
// Przy budowaniu strony wyszly dwie wady, ktore te testy pilnuja:
//
//   1. czolowka sumowala punkty z roznych turniejow - dokladnie to, co
//      server/lib/allTime.js odrzuca, bo IEM Cologne dawalo 316 punktow,
//      a StarLadder Budapest 47;
//   2. oddawala same user_id, wiec na stronie stalyby dziewietnastocyfrowe
//      liczby zamiast nickow.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/publicOverview.js";

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  const res = {
    zapis,
    status(kod) {
      zapis.kod = kod;

      return res;
    },
    json(tresc) {
      zapis.tresc = tresc;

      return res;
    },
  };

  return res;
}

const REJESTR = {
  getAllGuildIds: () => ["111"],
  getGuildConfig: (id) =>
    id === "111"
      ? {
        GUILD_SLUG: "hyperland",
        GUILD_NAME: "Hyperland",
        DISCORD_INVITE_URL: "https://discord.gg/x",
      }
      : null,
};

const EVENTY = [
  { id: 1, name: "Duzy turniej", slug: "duzy", phase: "PLAYOFFS", status: "FINISHED" },
  { id: 2, name: "Maly turniej", slug: "maly", phase: "PLAYOFFS", status: "FINISHED" },
];

// Gracz "stały" gra w obu, "jednorazowy" tylko w jednym.
// W duzym turnieju maksimum to 300 punktow, w malym 40 - dokladnie ten
// rozjazd, przez ktory suma punktow jest zla miara.
const KLASYFIKACJA = [
  {
    user_id: "staly", event_id: 1, total_points: 200, rank_position: 10,
    uczestnicy: 100, name: "Duzy turniej", slug: "duzy",
    displayname: "Staly", avatar: "abc",
  },
  {
    user_id: "staly", event_id: 2, total_points: 30, rank_position: 2,
    uczestnicy: 100, name: "Maly turniej", slug: "maly",
    displayname: "Staly", avatar: "abc",
  },
  {
    user_id: "jednorazowy", event_id: 1, total_points: 300, rank_position: 1,
    uczestnicy: 100, name: "Duzy turniej", slug: "duzy",
    displayname: null, avatar: null,
  },
];

const NAZWY = [{ user_id: "jednorazowy", displayname: "Z fazy" }];

function daneDla(sql, statsEventow = 2) {
  if (sql.includes("ROW_NUMBER() OVER")) return KLASYFIKACJA;
  if (sql.includes("MAX(nazwa) AS displayname")) return NAZWY;

  if (sql.includes("COUNT(DISTINCT e.id)")) {
    return [{ events_count: statsEventow, participants: 150, predictions: 5000 }];
  }

  // Dopiero teraz - zapytania wyzej TEZ zawieraja "FROM events".
  if (sql.includes("FROM events")) return EVENTY.slice(0, statsEventow);

  return [];
}

async function zbuduj(pool) {
  const { registerPublicOverviewRoutes } = await import(MODUL);

  const app = fakeApp();

  registerPublicOverviewRoutes(app, {
    buildPublicMatch: () => ({}),
    guildRegistry: REJESTR,
    pool,
  });

  const handler = app.trasy.get("GET /api/public/:guildSlug");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

function pula(statsEventow = 2) {
  return {
    async query(sql) {
      return [daneDla(sql, statsEventow), []];
    },
  };
}

const req = { params: { guildSlug: "hyperland" } };

test("oddaje dane gildii, statystyki i jej turnieje", async () => {
  const res = fakeRes();

  await (await zbuduj(pula()))(req, res);

  const d = res.zapis.tresc;

  assert.equal(res.zapis.kod, 200);
  assert.equal(d.guild.name, "Hyperland");
  assert.equal(d.guild.slug, "hyperland");
  assert.equal(d.stats.events, 2);
  assert.equal(d.events.length, 2);
});

test("czolowka stoi na PERCENTYLU, nie na sumie punktow", async () => {
  // "jednorazowy" ma 300 punktow wobec 230 u "stalego" - po sumie punktow
  // bylby pierwszy. Ale ma jeden start, a prog przy dwoch turniejach to dwa.
  const res = fakeRes();

  await (await zbuduj(pula()))(req, res);

  const czolowka = res.zapis.tresc.top_players;

  assert.equal(czolowka.length, 1, "jednorazowy nie spelnia progu");
  assert.equal(czolowka[0].user_id, "staly");

  // Miejsce 10 ze 100 i 2 ze 100 - srednia percentyla, nie punktow.
  assert.equal(czolowka[0].avg_top_percent, 6);
  assert.equal(czolowka[0].starts, 2);
});

test("PROG DOPASOWANY DO SERWERA: przy jednym turnieju wystarczy jeden start", async () => {
  // Sedno tej strony. Serwer z jednym turniejem nie ma nikogo z dwoma
  // startami - zmierzone, 221 graczy nie moglo przez to wejsc do zadnej
  // klasyfikacji, i nie zalezalo to od nich.
  const res = fakeRes();

  await (await zbuduj(pula(1)))(req, res);

  assert.equal(res.zapis.tresc.min_starts, 1);

  assert.ok(
    res.zapis.tresc.top_players.length > 0,
    "przy jednym turnieju czolowka nie moze byc pusta",
  );
});

test("gracz bez profilu dostaje nazwe z fazy, a nie surowy identyfikator", async () => {
  const res = fakeRes();

  await (await zbuduj(pula(1)))(req, res);

  const jednorazowy = res.zapis.tresc.top_players.find(
    (p) => p.user_id === "jednorazowy",
  );

  assert.ok(jednorazowy, "przy progu 1 wchodzi do czolowki");
  assert.equal(jednorazowy.displayname, "Z fazy");
});

test("nazwa z profilu ma pierwszenstwo przed nazwa z fazy", async () => {
  const res = fakeRes();

  await (await zbuduj(pula()))(req, res);

  assert.equal(res.zapis.tresc.top_players[0].displayname, "Staly");
});

test("awaria bazy konczy sie piecsetka", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const res = fakeRes();

  await (await zbuduj(pool))(req, res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.dbError");
});
