// Publiczne archiwum turnieju (.xlsx) - trasa w server/routes/publicEvents.js.
//
// Atrapy `app`, puli i generatora: nic nie laczy sie z baza i nie powstaje
// zaden plik.
//
// Najwazniejsze jest tu jedno zdanie, i nie dotyczy ono formatu pliku:
// exportClassification wola na wejsciu calculateScores, ktore ma dwanascie
// zapytan PISZACYCH. Dla turnieju zarchiwizowanego liczenie punktow pomija sie
// i nic nie zapisuje - i wlasnie dlatego archiwum wydajemy tylko dla takich.
// Ta trasa nie wymaga logowania, wiec gdyby warunek puscil turniej w toku,
// dowolna osoba z internetu moglaby w kolko wywolywac przeliczanie punktow.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/publicEvents.js";

const SCIEZKA = "GET /api/public/events/:slug/archive.xlsx";

function fakeApp() {
  const trasy = new Map();

  const zapamietaj =
    (metoda) =>
    (sciezka, ...reszta) => {
      trasy.set(`${metoda} ${sciezka}`, reszta[reszta.length - 1]);
    };

  return {
    trasy,
    get: zapamietaj("GET"),
    post: zapamietaj("POST"),
    put: zapamietaj("PUT"),
    delete: zapamietaj("DELETE"),
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null, naglowki: {}, wyslane: null };

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
    setHeader(nazwa, wartosc) {
      zapis.naglowki[nazwa.toLowerCase()] = wartosc;
      return res;
    },
    send(dane) {
      zapis.wyslane = dane;
      return res;
    },
  };

  return res;
}

// Pula oddaje jeden wiersz turnieju albo nic.
function fakePool(event) {
  return {
    async query() {
      return [event ? [event] : []];
    },
  };
}

const ZARCHIWIZOWANY = {
  id: 37,
  guild_id: "111",
  name: "IEM Cologne Major 2026",
  slug: "iem-cologne-major-2026",
  is_archived: 1,
};

async function zarejestruj({ event, generuj }) {
  const { registerPublicEventRoutes } = await import(MODUL);

  const wywolania = [];

  const app = fakeApp();

  registerPublicEventRoutes(app, {
    getKnownGuildInfo: async () => null,
    calculateScores: async () => {
      wywolania.push("calculateScores");
    },
    exportClassification: async (arg) => {
      wywolania.push(arg);

      return generuj ? generuj(arg) : Buffer.from("udawany-xlsx");
    },
    isGuildMember: async () => false,
    pool: fakePool(event),
    requireGuildAdmin: () => (req, res, next) => next(),
  });

  return { handler: app.trasy.get(SCIEZKA), wywolania };
}

test("trasa jest zarejestrowana pod publicznym adresem", async () => {
  const { handler } = await zarejestruj({ event: ZARCHIWIZOWANY });

  assert.equal(typeof handler, "function");
});

test("zarchiwizowany turniej oddaje plik z wlasciwymi naglowkami", async () => {
  const { handler } = await zarejestruj({ event: ZARCHIWIZOWANY });

  const res = fakeRes();
  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.wyslane.toString(), "udawany-xlsx");

  assert.match(
    res.zapis.naglowki["content-type"],
    /spreadsheetml\.sheet$/,
    "przegladarka ma wiedziec, ze to arkusz",
  );

  assert.equal(
    res.zapis.naglowki["content-disposition"],
    'attachment; filename="pickem-iem-cologne-major-2026.xlsx"',
    "nazwa pliku ze sluga - nazwa turnieju ma spacje i polskie znaki",
  );
});

test("turniej W TOKU nie uruchamia eksportu w ogole", async () => {
  // Sedno. Nie chodzi o to, ze odpowiedz ma kod 409 - chodzi o to, ze
  // exportClassification (a przez nie calculateScores, dwanascie zapytan
  // piszacych) nie zostaje nawet wywolane.
  const { handler, wywolania } = await zarejestruj({
    event: { ...ZARCHIWIZOWANY, is_archived: 0 },
  });

  const res = fakeRes();
  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, res);

  assert.equal(res.zapis.kod, 409);
  assert.deepEqual(wywolania, [], "zero wywolan generatora");
  assert.match(res.zapis.tresc.error, /zakończeniu turnieju/);
});

test("nieznany turniej to 404, a nie pusty plik", async () => {
  const { handler, wywolania } = await zarejestruj({ event: null });

  const res = fakeRes();
  await handler({ params: { slug: "nie-ma-takiego" } }, res);

  assert.equal(res.zapis.kod, 404);
  assert.deepEqual(wywolania, []);
});

test("drugie pobranie nie generuje pliku ponownie", async () => {
  // Zmierzone na produkcji: pierwsze pobranie 7 s, drugie 0.18 s.
  const { handler, wywolania } = await zarejestruj({ event: ZARCHIWIZOWANY });

  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, fakeRes());
  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, fakeRes());

  assert.equal(wywolania.length, 1, "generowanie ma pojsc raz");
});

test("generator dostaje identyfikatory, nie sluga", async () => {
  // Slug da sie zmienic, a plik dotyczy konkretnego wiersza w events.
  const { handler, wywolania } = await zarejestruj({ event: ZARCHIWIZOWANY });

  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, fakeRes());

  assert.deepEqual(wywolania[0], { guildId: "111", eventId: 37 });
});

test("blad generowania konczy sie kodem 500, a nie zawieszeniem", async () => {
  const { handler } = await zarejestruj({
    event: ZARCHIWIZOWANY,
    generuj: () => {
      throw new Error("exceljs padl");
    },
  });

  const res = fakeRes();
  await handler({ params: { slug: ZARCHIWIZOWANY.slug } }, res);

  assert.equal(res.zapis.kod, 500);
  assert.match(res.zapis.tresc.error, /archiwum/i);
});
