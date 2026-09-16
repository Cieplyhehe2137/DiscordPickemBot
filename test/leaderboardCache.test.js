// Pamiec podreczna policzonego rankingu (server/lib/leaderboardCache.js).
//
// Testy sa przede wszystkim o SCALANIU ZADAN, bo to jest ta wlasciwosc,
// dla ktorej ta pamiec powstala. Dzis serwis ma siedem wejsc na dobe i samo
// zapamietywanie prawie nigdy nie trafi. W dniu turnieju piecuset typujacych
// odswieza ranking naraz - i wtedy liczy sie, czy to jedno przeliczenie,
// czy piecset.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/leaderboardCache.js";

// Zegar sterowany recznie. Czekanie na prawdziwe trzydziesci sekund
// zamienialoby ten plik w test, ktorego nikt nie uruchamia.
function zegar(start = 0) {
  let teraz = start;

  return {
    teraz: () => teraz,
    przesun: (ms) => {
      teraz += ms;
    },
  };
}

test("drugie zapytanie o ten sam turniej nie liczy go jeszcze raz", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    load: async (slug) => {
      przebiegow += 1;

      return { slug };
    },
  });

  await cache.get("iem");
  await cache.get("iem");

  assert.equal(przebiegow, 1);
});

test("rozne turnieje licza sie osobno", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  const widziane = [];

  const cache = createLeaderboardCache({
    load: async (slug) => {
      widziane.push(slug);

      return { slug };
    },
  });

  const a = await cache.get("iem");
  const b = await cache.get("starladder");

  assert.deepEqual(widziane, ["iem", "starladder"]);
  assert.equal(a.slug, "iem");
  assert.equal(b.slug, "starladder");
});

test("piecdziesiat rownoczesnych zadan to JEDNO przeliczenie", async () => {
  // To jest powod istnienia tej pamieci. Bez scalania zadan ochrona
  // nie dziala dokladnie w tej chwili, w ktorej jest potrzebna - czyli
  // zaraz po przeliczeniu punktow, gdy wszyscy odswiezaja ranking.
  const { createLeaderboardCache } = await import(MODUL);

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    load: async () => {
      przebiegow += 1;

      await new Promise((r) => setTimeout(r, 10));

      return { ok: true };
    },
  });

  const wyniki = await Promise.all(
    Array.from({ length: 50 }, () => cache.get("iem")),
  );

  assert.equal(przebiegow, 1, `przeliczen: ${przebiegow}`);
  assert.equal(wyniki.length, 50);
  assert.ok(wyniki.every((w) => w.ok));
});

test("po czasie zycia liczy sie od nowa", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  const z = zegar();

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    ttlMs: 30_000,
    teraz: z.teraz,
    load: async () => {
      przebiegow += 1;

      return { n: przebiegow };
    },
  });

  assert.equal((await cache.get("iem")).n, 1);

  z.przesun(29_999);
  assert.equal((await cache.get("iem")).n, 1, "jeszcze swieze");

  z.przesun(2);
  assert.equal((await cache.get("iem")).n, 2, "juz przeterminowane");
});

test("uniewaznienie wymusza przeliczenie", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    load: async () => {
      przebiegow += 1;

      return { n: przebiegow };
    },
  });

  await cache.get("iem");
  cache.uniewaznij("iem");

  assert.equal((await cache.get("iem")).n, 2);
});

test("blad nie zostaje zapamietany", async () => {
  // Odrzucona obietnica w pamieci oznaczalaby, ze jedna chwilowa awaria bazy
  // psuje ranking az do restartu procesu.
  const { createLeaderboardCache } = await import(MODUL);

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    load: async () => {
      przebiegow += 1;

      if (przebiegow === 1) throw new Error("baza padla");

      return { n: przebiegow };
    },
  });

  await assert.rejects(() => cache.get("iem"), /baza padla/);

  assert.equal((await cache.get("iem")).n, 2, "druga proba ma dzialac");
});

test("stary wynik znika, gdy przeliczenie sie nie uda", async () => {
  // Przeterminowany wpis jest usuwany PRZED proba przeliczenia. Inaczej
  // awaria bazy podawalaby dalej ranking sprzed godzin, udajac swiezy.
  const { createLeaderboardCache } = await import(MODUL);

  const z = zegar();

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    ttlMs: 1000,
    teraz: z.teraz,
    load: async () => {
      przebiegow += 1;

      if (przebiegow === 2) throw new Error("baza padla");

      return { n: przebiegow };
    },
  });

  await cache.get("iem");

  z.przesun(2000);

  await assert.rejects(() => cache.get("iem"), /baza padla/);

  assert.equal(cache.rozmiar(), 0, "stary wpis zostal w pamieci");
});

test("pamiec nie rosnie bez konca", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  const cache = createLeaderboardCache({
    maxEntries: 3,
    load: async (slug) => ({ slug }),
  });

  for (const slug of ["a", "b", "c", "d", "e"]) await cache.get(slug);

  assert.equal(cache.rozmiar(), 3);
});

test("brak turnieju tez jest zapamietywany", async () => {
  // Inaczej bledny adres w petli odpytywalby baze bez konca.
  const { createLeaderboardCache } = await import(MODUL);

  let przebiegow = 0;

  const cache = createLeaderboardCache({
    load: async () => {
      przebiegow += 1;

      return null;
    },
  });

  assert.equal(await cache.get("nie-ma"), null);
  assert.equal(await cache.get("nie-ma"), null);
  assert.equal(przebiegow, 1);
});

test("bez funkcji ladujacej nie da sie utworzyc pamieci", async () => {
  const { createLeaderboardCache } = await import(MODUL);

  assert.throws(() => createLeaderboardCache(), /wymagana funkcja load/);
  assert.throws(() => createLeaderboardCache({ load: 7 }), /wymagana funkcja load/);
});
