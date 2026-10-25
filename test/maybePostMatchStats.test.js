// Rozklad typow na kanal po zamknieciu meczu.
//
// CO SIE ZMIENILO. handlers/matches/maybePostMatchStats.js byl napisany
// w calosci - razem z tabela community_stats_posts w schemacie - i NIE BYL
// WOLANY ANI RAZ. Teraz woła go matchLockWatcher w chwili blokady meczu.
//
// DLACZEGO Z PROGIEM. Major ma 106 meczow. Bez progu to 106 wiadomosci na
// kanale typowania i jest to najprawdopodobniej powod, dla ktorego nikt tego
// nie podlaczyl. Zostaja mecze, o ktorych jest o czym gadac: z prawdziwym
// polem i bez jednomyslnosci.
//
// CZYM TO MOZE SIE ZEPSUC. Progi sa wspolne z serwisem (rules/field.js), wiec
// test NIE wpisuje 20 ani 85 - liczy wzgledem nich. Dzieki temu zmiana progu
// w jednym miejscu nie zostawia testu, ktory pilnuje starej liczby.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

const FIELD = require("../rules/field");

const MODUL = path.join(
  __dirname,
  "..",
  "handlers",
  "matches",
  "maybePostMatchStats.js",
);

/**
 * Laduje handler z podstawionymi zaleznosciami.
 *
 * Ta sama technika, co w test/matchPhaseOptions.test.js: podmiana na czas
 * samego require, bo modul zaciaga wszystko na gorze pliku.
 */
function zaladuj(atrapy) {
  const oryginal = Module._load;

  Module._load = function (request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(atrapy, request)) {
      return atrapy[request];
    }

    return oryginal.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(MODUL)];
    return require(MODUL);
  } finally {
    Module._load = oryginal;
  }
}

/** Stan jednego przebiegu: co policzono, co wyslano, co odnotowano. */
function srodowisko({ stats, posted = false }) {
  const slad = {
    policzono: 0,
    wyslane: [],
    odnotowane: [],
  };

  const kanal = {
    send: async (tresc) => {
      slad.wyslane.push(tresc);
    },
  };

  const atrapy = {
    "../../utils/calculateMatchPopularity": {
      calculateMatchPopularity: async () => {
        slad.policzono += 1;
        return stats;
      },
    },
    "../../utils/matchPopularityEmbed": {
      buildMatchPopularityEmbed: () => ({ embed: true }),
    },
    "../../utils/communityStatsPosts": {
      wasStatsPosted: async () => posted,
      markStatsPosted: async (pool, guildId, matchId, statsType) => {
        slad.odnotowane.push({ matchId, statsType });
      },
    },
  };

  const { maybePostMatchStats } = zaladuj(atrapy);

  const wywolaj = () =>
    maybePostMatchStats({
      client: { channels: { fetch: async () => kanal } },
      pool: {},
      guildId: "1",
      channelId: "2",
      matchId: 42,
    });

  return { slad, wywolaj };
}

/** Rozklad typow: ilu typujacych i jaki procent ma faworyt. */
function rozklad(totalUsers, faworytPct) {
  return {
    totalUsers,
    match: { id: 42, teamA: "NAVI", teamB: "G2" },
    winner: [
      { label: "NAVI", count: 1, pct: faworytPct },
      { label: "G2", count: 1, pct: 100 - faworytPct },
    ],
    scores: [],
  };
}

test("mecz z malym polem nie trafia na kanal", async () => {
  // Ponizej progu odsetek nic nie znaczy - trzy osoby to nie jest pole.
  const { slad, wywolaj } = srodowisko({
    stats: rozklad(FIELD.MIN_VOTERS - 1, 50),
  });

  const wynik = await wywolaj();

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "below_min_voters");
  assert.deepEqual(slad.wyslane, []);
  assert.deepEqual(slad.odnotowane, []);
});

test("mecz jednomyslny nie trafia na kanal", async () => {
  const { slad, wywolaj } = srodowisko({
    stats: rozklad(100, FIELD.OBVIOUS_PCT),
  });

  const wynik = await wywolaj();

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "obvious");
  assert.deepEqual(slad.wyslane, []);
});

test("mecz podzielony trafia na kanal i zostaje odnotowany", async () => {
  const { slad, wywolaj } = srodowisko({
    stats: rozklad(61, 72),
  });

  const wynik = await wywolaj();

  assert.equal(wynik.posted, true);
  assert.equal(slad.wyslane.length, 1);
  assert.deepEqual(slad.odnotowane, [
    { matchId: 42, statsType: "match_start" },
  ]);
});

test("progi sa domkniete z wlasciwej strony", async () => {
  // Pole DOKLADNIE na progu wystarcza...
  const doklNaProgu = srodowisko({ stats: rozklad(FIELD.MIN_VOTERS, 50) });
  assert.equal((await doklNaProgu.wywolaj()).posted, true);

  // ...a jednomyslnosc DOKLADNIE na progu juz nie, bo "oczywisty" znaczy
  // "co najmniej tyle procent".
  const naProguZgody = srodowisko({
    stats: rozklad(100, FIELD.OBVIOUS_PCT),
  });
  assert.equal((await naProguZgody.wywolaj()).posted, false);

  // Tuz pod progiem zgody mecz jeszcze wchodzi.
  const podProgiem = srodowisko({
    stats: rozklad(100, FIELD.OBVIOUS_PCT - 1),
  });
  assert.equal((await podProgiem.wywolaj()).posted, true);
});

test("drugi przebieg nie wysyla tego samego dwa razy", async () => {
  const { slad, wywolaj } = srodowisko({
    stats: rozklad(61, 72),
    posted: true,
  });

  const wynik = await wywolaj();

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "already_posted");
  assert.deepEqual(slad.wyslane, []);

  // I nie liczy rozkladu, skoro i tak nie ma go po co wysylac.
  assert.equal(slad.policzono, 0);
});

test("brak typow konczy sie cicho", async () => {
  const { slad, wywolaj } = srodowisko({
    stats: { totalUsers: 0, winner: [], scores: [] },
  });

  const wynik = await wywolaj();

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "no_predictions");
  assert.deepEqual(slad.wyslane, []);
});

test("watcher blokady WOLA ten modul", () => {
  // Caly sens tej zmiany: funkcja istniala i nikt jej nie wolal. Gdyby
  // wywolanie wypadlo przy refaktorze, testy wyzej dalej by przechodzily,
  // a na kanale znowu nie byloby ani jednej wiadomosci.
  const fs = require("node:fs");

  const watcher = fs.readFileSync(
    path.join(__dirname, "..", "handlers", "matches", "matchLockWatcher.js"),
    "utf8",
  );

  assert.ok(
    watcher.includes("maybePostMatchStats"),
    "matchLockWatcher nie wola maybePostMatchStats",
  );

  assert.ok(
    watcher.includes('statsType: "match_start"'),
    "watcher nie podaje rodzaju posta - dedup liczy sie po nim",
  );
});
