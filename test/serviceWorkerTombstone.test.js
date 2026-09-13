// Nagrobek po service workerze aplikacji instalowalnej (web/public/sw.js).
//
// Aplikacja mobilna zostala wycofana, ale samego workera nie dalo sie skasowac:
// public/_redirects oddaje index.html dla kazdej sciezki, ktora nie jest
// plikiem, i robi to z kodem 200. Przegladarka wyrejestrowuje workera tylko po
// 404 albo 410, wiec skasowany /sw.js wrocilby jako HTML, aktualizacja
// przewrocilaby sie na typie MIME, a stary worker zostalby aktywny na zawsze.
//
// Stad plik, ktory usuwa sam siebie. Testy pilnuja dwoch rzeczy: ze naprawde
// sprzata i ze NIE przechwytuje juz zadnego zapytania. To drugie jest wazne,
// bo nagrobek z obsluga `fetch` przestaje byc nagrobkiem, a wyglada tak samo.

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SW = path.join(__dirname, "..", "web", "public", "sw.js");

function zaladujWorkera() {
  const uchwyty = {};
  const skasowane = [];
  const przeladowane = [];
  const stan = {};

  const kontekst = {
    console,

    self: {
      addEventListener: (nazwa, fn) => {
        uchwyty[nazwa] = fn;
      },
      skipWaiting: () => {
        stan.pominietoOczekiwanie = true;
      },
      registration: {
        unregister: async () => {
          stan.wyrejestrowano = true;
        },
      },
      clients: {
        matchAll: async () => [
          { url: "https://pickembot.pl/events", navigate: async (u) => przeladowane.push(u) },
        ],
      },
    },

    caches: {
      async keys() {
        return ["pickem-v1", "cos-starego"];
      },
      async delete(nazwa) {
        skasowane.push(nazwa);
        return true;
      },
    },
  };

  vm.createContext(kontekst);
  vm.runInContext(readFileSync(SW, "utf8"), kontekst, { filename: "sw.js" });

  return { uchwyty, skasowane, przeladowane, stan };
}

test("nie przechwytuje zadnych zapytan", async () => {
  // Najwazniejszy test w tym pliku. Worker bez obslugi `fetch` nie stoi miedzy
  // strona a siecia - wszystko idzie tak, jakby go nie bylo. Gdyby ktos tu
  // kiedys dopisal `fetch`, plik dalej nazywalby sie nagrobkiem, a zaczalby
  // znowu serwowac z pamieci.
  const { uchwyty } = zaladujWorkera();

  assert.equal(uchwyty.fetch, undefined, "nagrobek nie moze miec obslugi fetch");
});

test("przejmuje bez czekania na zamkniecie kart", async () => {
  const { uchwyty, stan } = zaladujWorkera();

  uchwyty.install();

  assert.equal(stan.pominietoOczekiwanie, true);
});

test("kasuje cala pamiec poprzednika i wyrejestrowuje sie", async () => {
  const { uchwyty, skasowane, stan } = zaladujWorkera();

  const event = { waitUntil: (p) => (event.czekanie = p) };
  uchwyty.activate(event);
  await event.czekanie;

  assert.deepEqual(skasowane, ["pickem-v1", "cos-starego"], "kazda pamiec, nie tylko swoja");
  assert.equal(stan.wyrejestrowano, true);
});

test("zdejmuje otwarte karty spod kontroli od razu", async () => {
  // Bez tego strona otwarta w chwili aktywacji chodzi dalej pod workerem,
  // ktory juz sie wyrejestrowal - az ktos sam ja odswiezy.
  const { uchwyty, przeladowane } = zaladujWorkera();

  const event = { waitUntil: (p) => (event.czekanie = p) };
  uchwyty.activate(event);
  await event.czekanie;

  assert.deepEqual(przeladowane, ["https://pickembot.pl/events"]);
});
