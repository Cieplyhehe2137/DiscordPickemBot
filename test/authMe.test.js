// Widocznosc panelu administracyjnego: /api/auth/me.
//
// Zakladka "Panel" pojawiala sie kazdemu, kto ma bit ADMINISTRATOR NA
// DOWOLNYM serwerze Discorda - takze na wlasnym, prywatnym, na ktorym bota
// nigdy nie bylo. Taki ktos klikal i ladowal na pustej liscie serwerow.
//
// Rozstrzyga to serwer, bo tylko on zna guildRegistry: front sam z bitmaski
// nie odrozni serwera obslugiwanego przez bota od dowolnego innego.
//
// To warstwa prezentacji - o tym, czy akcja przejdzie, decyduje
// requireGuildAdmin przy kazdej trasie z osobna. Ale falszywie pokazana
// zakladka prowadzi donikad, a falszywie ukryta odbiera panel prawdziwemu
// adminowi, wiec obie strony maja tu test.

const test = require("node:test");
const assert = require("node:assert/strict");

const AUTH = "../server/routes/auth.js";
const PERMISSIONS = "../server/lib/permissions.js";

const ADMIN = "8";
const BRAK_ADMINA = "104324673";

const ZNANY = "111";
const OBCY = "999";

function fakeRes() {
  const zapis = { tresc: null };

  return {
    zapis,
    json(tresc) {
      zapis.tresc = tresc;
      return this;
    },
    status() {
      return this;
    },
  };
}

// Rejestruje trasy na atrapie `app` i oddaje sam handler /api/auth/me.
// Reszta tras (OAuth, wylogowanie) ladzie w koszu - tutaj nie sa potrzebne.
async function handlerMe() {
  const { registerAuthRoutes } = await import(AUTH);
  const { hasAdminPermission } = await import(PERMISSIONS);

  let zlapany = null;

  registerAuthRoutes(
    {
      get(sciezka, fn) {
        if (sciezka === "/api/auth/me") zlapany = fn;
      },
      post() {},
    },
    {
      pool: {
        async query() {
          return [[]];
        },
      },
      guildRegistry: {
        getAllGuildIds: () => [ZNANY],
      },
      // Bez tego rejestruje sie dev-login, ktory loguje kogokolwiek bez hasla.
      isProduction: true,
      webOrigin: "https://example.test",
      administratorPermission: 0x8n,
      // Ta sama funkcja, ktora pilnuje 38 tras zapisujacych - zeby regula
      // porownywania bitmaski nie istniala tu w drugiej kopii.
      hasAdminPermission,
    },
  );

  assert.ok(zlapany, "trasa /api/auth/me nie zostala zarejestrowana");
  return zlapany;
}

async function odpowiedz(guilds) {
  const fn = await handlerMe();
  const res = fakeRes();

  fn({ session: guilds === null ? {} : { user: { id: "1", guilds } } }, res);

  return res.zapis.tresc;
}

test("admin serwera obslugiwanego przez bota widzi panel", async () => {
  const tresc = await odpowiedz([{ id: ZNANY, permissions: ADMIN }]);

  assert.equal(tresc.canAccessAdmin, true);
});

test("admin obcego serwera panelu nie widzi", async () => {
  // Sedno sprawy: bit ADMINISTRATOR jest, ale na serwerze, ktorego bot nie
  // zna. Wczesniej wystarczalo to, zeby pokazac zakladke do pustej listy.
  const tresc = await odpowiedz([{ id: OBCY, permissions: ADMIN }]);

  assert.equal(tresc.canAccessAdmin, false);
});

test("zwykly czlonek znanego serwera panelu nie widzi", async () => {
  const tresc = await odpowiedz([{ id: ZNANY, permissions: BRAK_ADMINA }]);

  assert.equal(tresc.canAccessAdmin, false);
});

test("jeden znany serwer wystarczy, obce nie przeszkadzaja", async () => {
  // Typowe konto: kilka serwerow z admina (wlasne, znajomych) i jeden
  // obslugiwany przez bota. Kazde id wystepuje raz - Discord podaje kazdy
  // serwer pojedynczo, a hasAdminPermission rozstrzyga wlasnie po id.
  const tresc = await odpowiedz([
    { id: OBCY, permissions: ADMIN },
    { id: "222", permissions: ADMIN },
    { id: "333", permissions: BRAK_ADMINA },
    { id: ZNANY, permissions: ADMIN },
  ]);

  assert.equal(tresc.canAccessAdmin, true);
});

test("niezalogowany dostaje null i zamkniety panel", async () => {
  const tresc = await odpowiedz(null);

  assert.equal(tresc.user, null);
  assert.equal(tresc.canAccessAdmin, false);
});

test("brak listy serwerow nie wywraca odpowiedzi", async () => {
  // Pobranie listy gildii po zalogowaniu moze sie nie udac - wtedy w sesji
  // zostaje pusta tablica, a w starszych sesjach moze nie byc jej wcale.
  for (const guilds of [[], undefined]) {
    const tresc = await odpowiedz(guilds);

    assert.equal(tresc.canAccessAdmin, false);
  }
});

test("smieci w bitmasce to odmowa, nie wywrotka", async () => {
  const tresc = await odpowiedz([{ id: ZNANY, permissions: "nie liczba" }]);

  assert.equal(tresc.canAccessAdmin, false);
});
