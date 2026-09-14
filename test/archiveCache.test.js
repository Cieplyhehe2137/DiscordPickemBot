// Pamiec podreczna archiwow .xlsx (server/lib/archiveCache.js).
//
// Zmierzone na produkcji: jedno archiwum IEM Cologne to 21 zapytan do bazy,
// ~6 sekund i 1016 kB. Endpoint jest publiczny i bez logowania, wiec liczy
// sie nie tylko to, ze plik jest zapamietywany, ale przede wszystkim to, co
// dzieje sie w ciagu tych szesciu sekund, zanim jest gotowy - czyli dokladnie
// wtedy, gdy link idzie na Discorda i klika w niego naraz kilkanascie osob.

const test = require("node:test");
const assert = require("node:assert/strict");

const CACHE = "../server/lib/archiveCache.js";

function licznik(opoznienie = 0) {
  const wywolania = [];

  return {
    wywolania,
    generate: async (klucz) => {
      wywolania.push(klucz);

      if (opoznienie) {
        await new Promise((r) => setTimeout(r, opoznienie));
      }

      return Buffer.from(`plik-${klucz}`);
    },
  };
}

test("drugie zapytanie o ten sam turniej nie generuje pliku ponownie", async () => {
  const { createArchiveCache } = await import(CACHE);
  const { generate, wywolania } = licznik();

  const cache = createArchiveCache({ generate });

  const a = await cache.get("cologne");
  const b = await cache.get("cologne");

  assert.deepEqual(wywolania, ["cologne"], "generowanie ma pojsc raz");
  assert.equal(a.toString(), "plik-cologne");
  assert.equal(b.toString(), "plik-cologne");
});

test("rownolegle zapytania czekaja na JEDNA prace", async () => {
  // To jest sedno. Bez scalania pamiec podreczna nie chroni przed niczym
  // w jedynym momencie, w ktorym ochrona jest potrzebna: kilkanascie osob
  // klika w link w tej samej sekundzie, a pliku jeszcze nie ma.
  const { createArchiveCache } = await import(CACHE);
  const { generate, wywolania } = licznik(40);

  const cache = createArchiveCache({ generate });

  const wyniki = await Promise.all([
    cache.get("cologne"),
    cache.get("cologne"),
    cache.get("cologne"),
    cache.get("cologne"),
  ]);

  assert.deepEqual(wywolania, ["cologne"], "cztery zadania, jedno generowanie");

  for (const w of wyniki) {
    assert.equal(w.toString(), "plik-cologne", "kazdy dostaje ten sam plik");
  }
});

test("rozne turnieje nie mieszaja sie ze soba", async () => {
  const { createArchiveCache } = await import(CACHE);
  const { generate, wywolania } = licznik();

  const cache = createArchiveCache({ generate });

  assert.equal((await cache.get("cologne")).toString(), "plik-cologne");
  assert.equal((await cache.get("krakow")).toString(), "plik-krakow");
  assert.deepEqual(wywolania, ["cologne", "krakow"]);
});

test("blad nie zostaje w pamieci na zawsze", async () => {
  // Gdyby odrzucona obietnica zostala zapamietana, jedna nieudana proba -
  // chwilowy brak bazy - psulaby pobieranie az do restartu procesu.
  const { createArchiveCache } = await import(CACHE);

  let proby = 0;

  const cache = createArchiveCache({
    generate: async () => {
      proby += 1;

      if (proby === 1) throw new Error("baza chwilowo padla");

      return Buffer.from("plik-po-ponowieniu");
    },
  });

  await assert.rejects(() => cache.get("cologne"), /baza chwilowo padla/);

  const drugie = await cache.get("cologne");

  assert.equal(drugie.toString(), "plik-po-ponowieniu");
  assert.equal(proby, 2, "druga proba ma sie odbyc naprawde");
});

test("stare pliki wypadaja, zeby pamiec procesu nie rosla bez konca", async () => {
  // Kazdy plik ma okolo megabajta.
  const { createArchiveCache } = await import(CACHE);
  const { generate } = licznik();

  const cache = createArchiveCache({ generate, maxEntries: 2 });

  await cache.get("a");
  await cache.get("b");
  await cache.get("c");

  assert.equal(cache.rozmiar(), 2);
});

test("po wypadnieciu z pamieci plik powstaje na nowo", async () => {
  const { createArchiveCache } = await import(CACHE);
  const { generate, wywolania } = licznik();

  const cache = createArchiveCache({ generate, maxEntries: 1 });

  await cache.get("a");
  await cache.get("b");
  await cache.get("a");

  assert.deepEqual(wywolania, ["a", "b", "a"]);
});

test("brak funkcji generujacej to blad od razu, a nie przy pierwszym pobraniu", async () => {
  const { createArchiveCache } = await import(CACHE);

  assert.throws(() => createArchiveCache(), /generate/);
  assert.throws(() => createArchiveCache({ generate: "nie funkcja" }), /generate/);
});
