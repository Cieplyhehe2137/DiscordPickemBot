// Reguly pamieci podrecznej service workera (web/public/sw.js).
//
// Service worker siedzi MIEDZY aplikacja a siecia i nie widac go w zadnym
// widoku. Zla regula nie wywala sie na czerwono - po prostu ktos dostaje
// wczorajszy wynik meczu albo cudzy ranking, i dowiaduje sie o tym dopiero
// wtedy, gdy zdazy sie juz na nim oprzec.
//
// Te testy pilnuja trzech rzeczy, na ktorych stoi calosc:
//   1. odpowiedzi API nigdy nie trafiaja do pamieci,
//   2. nawigacja idzie do sieci pierwsza, wiec wdrozenie wchodzi od razu,
//   3. pliki z /assets/ ida z pamieci, bo to one pozwalaja wstac bez sieci.
//
// Sprawdzane na prawdziwym pliku workera, nie na jego kopii: kod jest ladowany
// do wlasnego kontekstu z podstawionymi atrapami `self`, `caches` i `fetch`.
// Dzieki temu test chodzi bez przegladarki - a przegladarka w tym srodowisku
// i tak odmawia rejestracji workera.

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SW = path.join(__dirname, "..", "web", "public", "sw.js");

const ORIGIN = "https://pickembot.pl";

// Uruchamia workera w izolowanym kontekscie i oddaje jego uchwyty zdarzen
// razem z atrapami, zeby dalo sie sprawdzic, co zrobil.
function zaladujWorkera({ wPamieci = {}, odpowiedzSieci = null } = {}) {
  const uchwyty = {};

  const pamiec = new Map(Object.entries(wPamieci));

  const zapisy = [];
  const otwarte = [];
  const skasowane = [];
  const zapytaniaSieci = [];

  const cache = {
    async put(klucz, wartosc) {
      const k = typeof klucz === "string" ? klucz : klucz.url;
      zapisy.push(k);
      pamiec.set(k, wartosc);
    },
    async add(request) {
      zapisy.push(request.url);
      pamiec.set(request.url, { zrodlo: "install" });
    },
  };

  const caches = {
    async open(nazwa) {
      otwarte.push(nazwa);
      return cache;
    },
    async keys() {
      return ["pickem-v0", "pickem-v1", "stara-pamiec"];
    },
    async delete(nazwa) {
      skasowane.push(nazwa);
      return true;
    },
    async match(klucz) {
      const k = typeof klucz === "string" ? klucz : klucz.url;
      return pamiec.get(k);
    },
  };

  const kontekst = {
    URL,
    console,

    self: {
      location: { origin: ORIGIN },
      addEventListener: (nazwa, fn) => {
        uchwyty[nazwa] = fn;
      },
      skipWaiting: async () => {
        kontekst.self.pominietoOczekiwanie = true;
      },
      clients: {
        claim: async () => {
          kontekst.self.przejeto = true;
        },
      },
    },

    caches,

    async fetch(request) {
      zapytaniaSieci.push(typeof request === "string" ? request : request.url);

      if (odpowiedzSieci instanceof Error) throw odpowiedzSieci;

      return odpowiedzSieci ?? { ok: true, zrodlo: "siec", clone: () => ({ zrodlo: "siec" }) };
    },

    Request: class {
      constructor(url, opcje = {}) {
        this.url = url;
        this.opcje = opcje;
      }
    },

    Response: {
      error: () => ({ zrodlo: "blad" }),
    },
  };

  vm.createContext(kontekst);
  vm.runInContext(readFileSync(SW, "utf8"), kontekst, { filename: "sw.js" });

  return { uchwyty, kontekst, pamiec, zapisy, otwarte, skasowane, zapytaniaSieci };
}

// Atrapa zdarzenia fetch: zapamietuje, czy worker w ogole przejal zapytanie.
function zdarzenie(request) {
  const ev = {
    request,
    przejete: false,
    odpowiedz: null,
    respondWith(p) {
      ev.przejete = true;
      ev.odpowiedz = p;
    },
    waitUntil(p) {
      ev.czekanie = p;
    },
  };

  return ev;
}

function zapytanie(url, { method = "GET", mode = "no-cors" } = {}) {
  return { url, method, mode };
}

test("odpowiedzi API nie sa przejmowane ani zapisywane", async () => {
  // Najwazniejsza regula w calym pliku. Wynik meczu podany z pamieci wyglada
  // dokladnie tak samo jak prawdziwy, a odpowiedzi /api/ sa dodatkowo zalezne
  // od zalogowanej osoby - cudzy ranking w cudzej przegladarce to nie jest
  // "nieaktualne dane", tylko wyciek.
  const w = zaladujWorkera();

  const obce = zdarzenie(zapytanie("https://api.pickembot.pl/api/public/events"));
  const wlasne = zdarzenie(zapytanie(`${ORIGIN}/api/public/events`));

  w.uchwyty.fetch(obce);
  w.uchwyty.fetch(wlasne);

  assert.equal(obce.przejete, false, "API na obcym pochodzeniu ma isc wprost do sieci");
  assert.equal(wlasne.przejete, false, "API przez posrednika tak samo");
  assert.deepEqual(w.zapisy, [], "nic z API nie moze trafic do pamieci");
});

test("zapisy nie sa przejmowane", async () => {
  // Zapis typu to POST. Przechwytywanie go nie daje nic, a moze zaszkodzic.
  const w = zaladujWorkera();

  const ev = zdarzenie(zapytanie(`${ORIGIN}/assets/index-abc.js`, { method: "POST" }));
  w.uchwyty.fetch(ev);

  assert.equal(ev.przejete, false);
});

test("nawigacja idzie do sieci pierwsza", async () => {
  // Dzieki temu swieze wdrozenie wchodzi przy nastepnym wejsciu, a nie po
  // wygasnieciu czegokolwiek. Pamiec jest tu wylacznie zapasem.
  const w = zaladujWorkera();

  const ev = zdarzenie(zapytanie(`${ORIGIN}/events/iem-cologne`, { mode: "navigate" }));
  w.uchwyty.fetch(ev);

  const odpowiedz = await ev.odpowiedz;

  assert.equal(ev.przejete, true);
  assert.equal(odpowiedz.zrodlo, "siec");
  assert.deepEqual(w.zapytaniaSieci, [`${ORIGIN}/events/iem-cologne`]);
  assert.deepEqual(w.zapisy, ["/"], "swiezy dokument odswieza powloke pod stalym adresem");
});

test("nawigacja bez sieci dostaje powloke z pamieci", async () => {
  const w = zaladujWorkera({
    wPamieci: { "/": { zrodlo: "powloka" } },
    odpowiedzSieci: new Error("offline"),
  });

  const ev = zdarzenie(zapytanie(`${ORIGIN}/events/iem-cologne`, { mode: "navigate" }));
  w.uchwyty.fetch(ev);

  assert.equal((await ev.odpowiedz).zrodlo, "powloka");
});

test("nawigacja bez sieci i bez powloki nie wywala sie wyjatkiem", async () => {
  // Pierwsze wejscie w samolocie. Ma wyjsc blad odpowiedzi, a nie odrzucona
  // obietnica - ta w service workerze konczy sie pusta strona bez tresci.
  const w = zaladujWorkera({ odpowiedzSieci: new Error("offline") });

  const ev = zdarzenie(zapytanie(`${ORIGIN}/`, { mode: "navigate" }));
  w.uchwyty.fetch(ev);

  assert.equal((await ev.odpowiedz).zrodlo, "blad");
});

test("plik z /assets/ idzie z pamieci i nie pyta sieci", async () => {
  // Nazwy w /assets/ zawieraja skrot tresci, wiec ten sam adres zawsze znaczy
  // to samo. To dlatego pamiec pierwsza jest tu bezpieczna, a nie ryzykowna.
  const w = zaladujWorkera({
    wPamieci: { [`${ORIGIN}/assets/index-abc.js`]: { zrodlo: "pamiec" } },
  });

  const ev = zdarzenie(zapytanie(`${ORIGIN}/assets/index-abc.js`));
  w.uchwyty.fetch(ev);

  assert.equal((await ev.odpowiedz).zrodlo, "pamiec");
  assert.deepEqual(w.zapytaniaSieci, [], "skoro jest w pamieci, siec nie ma po co odpowiadac");
});

test("brakujacy plik z /assets/ jest pobierany i zapamietywany", async () => {
  const w = zaladujWorkera();

  const ev = zdarzenie(zapytanie(`${ORIGIN}/assets/index-abc.js`));
  w.uchwyty.fetch(ev);

  assert.equal((await ev.odpowiedz).zrodlo, "siec");
  assert.deepEqual(w.zapisy, [`${ORIGIN}/assets/index-abc.js`]);
});

test("nieudane pobranie zasobu nie trafia do pamieci", async () => {
  // Zapisana czterysta-cztery zostalaby tam na zawsze, bo adres z hashem
  // nigdy sie nie powtorzy z inna trescia.
  const w = zaladujWorkera({ odpowiedzSieci: { ok: false, clone: () => ({}) } });

  const ev = zdarzenie(zapytanie(`${ORIGIN}/assets/index-abc.js`));
  w.uchwyty.fetch(ev);

  await ev.odpowiedz;

  assert.deepEqual(w.zapisy, []);
});

test("pliki spoza /assets/ ida wprost do sieci", async () => {
  // Ikony i manifest zmieniaja sie rzadko, ale nie maja skrotu w nazwie -
  // wiec ich buforowanie musialoby miec wlasna zasade uniewazniania.
  const w = zaladujWorkera();

  const ev = zdarzenie(zapytanie(`${ORIGIN}/icon-192.png`));
  w.uchwyty.fetch(ev);

  assert.equal(ev.przejete, false);
});

test("instalacja pobiera powloke z pominieciem pamieci przegladarki", async () => {
  const w = zaladujWorkera();

  const ev = zdarzenie(null);
  w.uchwyty.install(ev);
  await ev.czekanie;

  assert.deepEqual(w.zapisy, ["/"]);
  assert.equal(w.kontekst.self.pominietoOczekiwanie, true);
});

test("aktywacja kasuje stare pamieci, a biezaca zostawia", async () => {
  const w = zaladujWorkera();

  const ev = zdarzenie(null);
  w.uchwyty.activate(ev);
  await ev.czekanie;

  assert.ok(!w.skasowane.includes("pickem-v1"), "biezaca pamiec ma zostac");
  assert.deepEqual(w.skasowane, ["pickem-v0", "stara-pamiec"]);
  assert.equal(w.kontekst.self.przejeto, true);
});
