// Dane gildii pokazywane na stronie.
//
// Wyladowaly w osobnym module przy rozbijaniu app.js, bo okazalo sie, ze sa
// potrzebne po obu stronach podzialu. Skoro juz maja wstrzykiwana zaleznosc,
// warte sa testu - najciekawsze jest tu zachowanie przy braku konfiguracji,
// bo gildia bez pliku env nie powinna wywalac strony ani pokazywac cudzych
// danych.

const test = require("node:test");
const assert = require("node:assert/strict");

const GUILD_INFO = "../server/lib/guildInfo.js";

function fakeRegistry(configs) {
  return {
    getGuildConfig: (id) => configs[id],
    getAllGuildIds: () => Object.keys(configs),
  };
}

test("bierze nazwe, slug i zaproszenie z konfiguracji gildii", async () => {
  const { createGuildInfo } = await import(GUILD_INFO);

  const { getKnownGuildInfo } = createGuildInfo(
    fakeRegistry({
      "111": {
        GUILD_SLUG: "hyperland",
        GUILD_NAME: "Hyperland",
        DISCORD_INVITE_URL: "https://discord.gg/abc",
      },
    }),
  );

  assert.deepEqual(getKnownGuildInfo("111"), {
    slug: "hyperland",
    name: "Hyperland",
    discord_url: "https://discord.gg/abc",
  });
});

test("gildia bez konfiguracji dostaje surowe id zamiast cudzych danych", async () => {
  const { createGuildInfo } = await import(GUILD_INFO);

  const { getKnownGuildInfo } = createGuildInfo(fakeRegistry({}));

  assert.deepEqual(getKnownGuildInfo("999"), {
    slug: "999",
    name: "999",
    discord_url: null,
  });
});

test("brakujace pojedyncze pola tez schodza do wartosci zastepczych", async () => {
  const { createGuildInfo } = await import(GUILD_INFO);

  const { getKnownGuildInfo } = createGuildInfo(
    fakeRegistry({ "222": { GUILD_NAME: "Tylko nazwa" } }),
  );

  assert.deepEqual(getKnownGuildInfo("222"), {
    slug: "222",
    name: "Tylko nazwa",
    discord_url: null,
  });
});

test("slug z URL-a wraca na guild_id", async () => {
  const { createGuildInfo } = await import(GUILD_INFO);

  const { resolveGuildIdFromSlug } = createGuildInfo(
    fakeRegistry({
      "111": { GUILD_SLUG: "hyperland" },
      "222": { GUILD_SLUG: "luffastream" },
    }),
  );

  assert.equal(resolveGuildIdFromSlug("luffastream"), "222");
});

test("nieznany slug jest traktowany jak samo guild_id", async () => {
  const { createGuildInfo } = await import(GUILD_INFO);

  const { resolveGuildIdFromSlug } = createGuildInfo(
    fakeRegistry({ "111": { GUILD_SLUG: "hyperland" } }),
  );

  // /public/:guildSlug obsluguje takze surowe id - dla gildii bez ustawionego
  // slugu to jedyna droga wejscia, wiec brak dopasowania nie moze byc bledem.
  assert.equal(resolveGuildIdFromSlug("333"), "333");
});
