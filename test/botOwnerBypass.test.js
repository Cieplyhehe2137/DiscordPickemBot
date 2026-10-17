// Wyjatek dla wlasciciela bota (BOT_OWNER_ID).
//
// PO CO ISTNIEJE. Discord nie daje wlascicielowi aplikacji zadnych uprawnien
// w gildiach - wlasnosc dotyczy aplikacji, nie serwerow, na ktorych bot
// siedzi. Bez tego wyjatku wlasciciel bota musi miec nadanego ADMINISTRATORA
// osobno na kazdym obslugiwanym serwerze, zeby otworzyc jego panel WWW.
//
// CZEGO TEN TEST PILNUJE. Wyjatek omija bramke przed wszystkimi trasami
// zapisujacymi panelu, wiec kazde jego poszerzenie jest ciche i grozne:
//
//   brak BOT_OWNER_ID a zmienione zachowanie -> wyjatek wlaczyl sie u
//       wszystkich, ktorzy go nie ustawili,
//   wyjatek bez zawezenia do obslugiwanych serwerow -> wlasciciel przechodzi
//       bramke dla DOWOLNEGO ciagu znakow w adresie, a czesc tras bierze
//       guild_id wprost stamtad (/api/guilds/:guildId/archive),
//   wyjatek siegajacy isGuildMember -> wlasciciel zapisuje typy na serwerze,
//       do ktorego nie nalezy, a to jest brama dla GRACZA, nie dla admina.
//
// Zaden z tych trzech nie wywala sie w zadnym istniejacym tescie: bez
// BOT_OWNER_ID wszystkie przechodza tak samo przed zmiana i po niej.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PERMISSIONS = "../server/lib/permissions.js";
const AUTH = "../server/routes/auth.js";

const OWNER_ID = "461851082570596352";
const OTHER_ID = "111222333444555666";

const ADMIN = "8";
const NO_ADMIN = "104324673";

const SERVED = "1161660208951607397";
const SERVED_2 = "1221762685595553834";
const NOT_SERVED = "999999999999999999";

const SERVED_GUILDS = [SERVED, SERVED_2];

const isServedGuild = (guildId) =>
  SERVED_GUILDS.some((id) => String(id) === String(guildId));

// Tak samo, jak domyka to server/app.js przy starcie.
function options(botOwnerId) {
  return { botOwnerId, isServedGuild };
}

function user(id, guilds = []) {
  return { id, guilds };
}

// ============================================================
// isBotOwner
// ============================================================

test("bez BOT_OWNER_ID wlascicielem nie jest NIKT", async () => {
  const { isBotOwner } = await import(PERMISSIONS);

  for (const blank of [undefined, null, "", "   "]) {
    assert.equal(
      isBotOwner(user(OWNER_ID), blank),
      false,
      `BOT_OWNER_ID=${JSON.stringify(blank)} nie moze nikogo wpuszczac`,
    );
  }
});

test("id porownuje sie jako tekst i z obcietymi spacjami", async () => {
  const { isBotOwner } = await import(PERMISSIONS);

  // Snowflake Discorda nie miesci sie w Number - porownanie liczbowe
  // zrownalo by ze soba dwa rozne konta.
  assert.equal(isBotOwner(user(OWNER_ID), OWNER_ID), true);
  assert.equal(isBotOwner(user(OWNER_ID), ` ${OWNER_ID} `), true);
  assert.equal(isBotOwner(user(OTHER_ID), OWNER_ID), false);
});

test("uzytkownik bez id nie jest wlascicielem", async () => {
  const { isBotOwner } = await import(PERMISSIONS);

  for (const withoutId of [null, undefined, {}, { id: "" }, { id: "  " }]) {
    assert.equal(isBotOwner(withoutId, OWNER_ID), false);
  }
});

// ============================================================
// hasAdminPermission
// ============================================================

test("bez BOT_OWNER_ID regula to nadal sama bitmaska", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  const withoutBit = user(OWNER_ID, [{ id: SERVED, permissions: NO_ADMIN }]);

  // Trzeci argument pominiety w ogole - tak wola ten modul test
  // porownujacy regule z kopia na froncie.
  assert.equal(hasAdminPermission(withoutBit, SERVED), false);

  // I jawnie z pustym wpisem w env.
  assert.equal(hasAdminPermission(withoutBit, SERVED, options("")), false);
});

test("wlasciciel wchodzi na obslugiwany serwer bez bitu ADMINISTRATOR", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  // Sedno sprawy: ani czlonkostwa, ani uprawnien - pusta lista gildii.
  const withoutMembership = user(OWNER_ID, []);

  for (const guildId of SERVED_GUILDS) {
    assert.equal(
      hasAdminPermission(withoutMembership, guildId, options(OWNER_ID)),
      true,
      `wlasciciel nie wszedl na ${guildId}`,
    );
  }
});

test("wyjatek NIE siega serwera, ktorego bot nie obsluguje", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  const owner = user(OWNER_ID, []);

  assert.equal(
    hasAdminPermission(owner, NOT_SERVED, options(OWNER_ID)),
    false,
    "wyjatek objal serwer spoza config/",
  );

  // Czesc tras bierze guild_id wprost z adresu, wiec to moze byc cokolwiek.
  for (const junk of ["../..", "0", "null", "DROP TABLE events"]) {
    assert.equal(
      hasAdminPermission(owner, junk, options(OWNER_ID)),
      false,
      `wyjatek objal ${JSON.stringify(junk)}`,
    );
  }
});

test("brak guildId to odmowa takze dla wlasciciela", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  for (const missing of [null, undefined, ""]) {
    assert.equal(
      hasAdminPermission(user(OWNER_ID, []), missing, options(OWNER_ID)),
      false,
    );
  }
});

test("predykat, ktory rzuca, konczy sie odmowa", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  // isServedGuild czyta pliki configow. Gdyby rzucil, wyjatek od reguly
  // opieralby sie na nieznanym stanie - wiec ma wyjsc odmowa.
  const throwing = {
    botOwnerId: OWNER_ID,
    isServedGuild() {
      throw new Error("config/ nie da sie odczytac");
    },
  };

  assert.equal(
    hasAdminPermission(user(OWNER_ID, []), SERVED, throwing),
    false,
  );
});

test("wyjatek nie zmienia nic dla pozostalych kont", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  const opts = options(OWNER_ID);

  const admin = user(OTHER_ID, [{ id: SERVED, permissions: ADMIN }]);
  const member = user(OTHER_ID, [{ id: SERVED, permissions: NO_ADMIN }]);

  assert.equal(hasAdminPermission(admin, SERVED, opts), true);
  assert.equal(hasAdminPermission(member, SERVED, opts), false);

  // Admin obslugiwanego serwera nie dostaje przy okazji drugiego.
  assert.equal(hasAdminPermission(admin, SERVED_2, opts), false);
});

test("wyjatek nie siega czlonkostwa - isGuildMember bez zmian", async () => {
  const { isGuildMember } = await import(PERMISSIONS);

  // isGuildMember pilnuje tras, ktorymi GRACZ zapisuje wlasne typy. Wlasciciel
  // bota nie ma czego typowac na serwerze, do ktorego nie nalezy, wiec ta
  // funkcja z zalozenia nie przyjmuje zadnych opcji.
  assert.equal(isGuildMember.length, 2, "isGuildMember przyjelo opcje");

  assert.equal(isGuildMember(user(OWNER_ID, []), SERVED), false);
});

// ============================================================
// requireGuildAdmin
// ============================================================

function fakeRes() {
  const recorded = { status: null, body: null };

  return {
    recorded,
    status(code) {
      recorded.status = code;
      return this;
    },
    json(body) {
      recorded.body = body;
      return this;
    },
  };
}

async function throughGate(sessionUser, guildId, botOwnerId) {
  const { requireGuildAdmin } = await import(PERMISSIONS);

  const gate = requireGuildAdmin(() => guildId, options(botOwnerId));

  const req = { session: { user: sessionUser } };
  const res = fakeRes();

  let passed = false;

  await gate(req, res, () => {
    passed = true;
  });

  return { passed, status: res.recorded.status, guildIdOnReq: req.guildId };
}

test("bramka: wlasciciel przechodzi i dostaje guildId w req", async () => {
  const result = await throughGate(user(OWNER_ID, []), SERVED, OWNER_ID);

  assert.equal(result.passed, true);
  assert.equal(result.status, null, "nie powinno byc zadnej odmowy");
  assert.equal(result.guildIdOnReq, SERVED);
});

test("bramka: wlasciciel na nieobslugiwanym serwerze dostaje 403", async () => {
  const result = await throughGate(user(OWNER_ID, []), NOT_SERVED, OWNER_ID);

  assert.equal(result.passed, false);
  assert.equal(result.status, 403);
});

test("bramka: bez BOT_OWNER_ID wlasciciel to zwykle konto", async () => {
  const result = await throughGate(user(OWNER_ID, []), SERVED, "");

  assert.equal(result.passed, false);
  assert.equal(result.status, 403);
});

// ============================================================
// /api/auth/me
// ============================================================

// Rejestruje trasy na atrapie `app` i oddaje sam handler /api/auth/me.
function registerMe(deps) {
  let captured = null;

  deps.register(
    {
      get(routePath, fn) {
        if (routePath === "/api/auth/me") captured = fn;
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
        getAllGuildIds: () => [...SERVED_GUILDS],
      },
      // Bez tego rejestruje sie dev-login, ktory loguje kogokolwiek bez hasla.
      isProduction: true,
      webOrigin: "https://example.test",
      administratorPermission: 0x8n,
      hasAdminPermission: deps.hasAdminPermission,
    },
  );

  assert.ok(captured, "trasa /api/auth/me nie zostala zarejestrowana");
  return captured;
}

async function meResponse(sessionUser, { botOwnerId = "" } = {}) {
  const { registerAuthRoutes } = await import(AUTH);
  const { hasAdminPermission } = await import(PERMISSIONS);

  const handler = registerMe({
    register: registerAuthRoutes,
    // Domkniete tak samo, jak robi to server/app.js. Trasa NIE dostaje zadnej
    // osobnej wiedzy o wlascicielu - caly wyjatek przychodzi wlasnie tedy.
    hasAdminPermission: (u, gid) =>
      hasAdminPermission(u, gid, options(botOwnerId)),
  });

  const res = fakeRes();

  handler({ session: sessionUser ? { user: sessionUser } : {} }, res);

  return res.recorded.body;
}

test("me: wlasciciel dostaje panel i WSZYSTKIE obslugiwane serwery", async () => {
  // To jest ta czesc, bez ktorej wyjatek jest bezuzyteczny: bramka by go
  // wpuscila, ale panel policzylby liste serwerow z bitmaski, czyli pusta,
  // i wlasciciel wszedlby na ekran "brak serwerow".
  const body = await meResponse(user(OWNER_ID, []), { botOwnerId: OWNER_ID });

  assert.equal(body.canAccessAdmin, true);
  assert.deepEqual(body.adminGuildIds.sort(), [...SERVED_GUILDS].sort());
});

test("me: zwykly admin dostaje tylko swoje serwery", async () => {
  const body = await meResponse(
    user(OTHER_ID, [
      { id: SERVED, permissions: ADMIN },
      { id: SERVED_2, permissions: NO_ADMIN },
      { id: NOT_SERVED, permissions: ADMIN },
    ]),
    { botOwnerId: OWNER_ID },
  );

  assert.equal(body.canAccessAdmin, true);
  assert.deepEqual(body.adminGuildIds, [SERVED]);
});

test("me: bez BOT_OWNER_ID wlasciciel nie dostaje nic ekstra", async () => {
  const body = await meResponse(user(OWNER_ID, []), { botOwnerId: "" });

  assert.equal(body.canAccessAdmin, false);
  assert.deepEqual(body.adminGuildIds, []);
});

test("me: caly wyjatek przychodzi przez hasAdminPermission", async () => {
  // routes/auth.js NIE ma wlasnej wiedzy o wlascicielu i ma jej nie dostac:
  // drugie zrodlo prawdy rozjechaloby sie z bramka przy trasach. Dowod jest
  // taki, ze podmiana samej tej jednej funkcji na "nikt nie jest adminem"
  // zabiera wlascicielowi cala liste, mimo ustawionego BOT_OWNER_ID.
  const { registerAuthRoutes } = await import(AUTH);

  const handler = registerMe({
    register: registerAuthRoutes,
    hasAdminPermission: () => false,
  });

  const res = fakeRes();

  handler({ session: { user: user(OWNER_ID, []) } }, res);

  assert.equal(res.recorded.body.canAccessAdmin, false);
  assert.deepEqual(res.recorded.body.adminGuildIds, []);
});

test("me: niezalogowany dostaje pusta liste, nie wyjatek", async () => {
  const body = await meResponse(null, { botOwnerId: OWNER_ID });

  assert.equal(body.user, null);
  assert.equal(body.canAccessAdmin, false);
  assert.deepEqual(body.adminGuildIds, []);
});

// ============================================================
// PANEL: skad bierze liste serwerow
// ============================================================

test("panel bierze liste serwerow z API, a bitmaske traktuje jako zapas", () => {
  // Tego nie widac ani w tescie jednostkowym, ani na zrzucie ekranu: dla
  // ZWYKLEGO admina obie drogi daja ten sam wynik, wiec powrot do liczenia
  // z bitmaski wyglada poprawnie wszedzie poza jednym przypadkiem - konta
  // wlasciciela bota, ktore nie jest nigdzie adminem i dostaloby panel
  // z pusta lista serwerow.
  const panel = fs.readFileSync(
    path.join(__dirname, "..", "web", "src", "pages", "AdminPage.jsx"),
    "utf8",
  );

  assert.match(
    panel,
    /adminGuildIds:\s*adminGuildIdsFromApi/,
    "panel nie bierze listy serwerow z /api/auth/me",
  );

  // Kolejnosc ma znaczenie: lista z API PRZED bitmaska, nie odwrotnie.
  assert.match(
    panel,
    /adminGuildIdsFromApi\s*\n?\s*\?\s*new Set\(adminGuildIdsFromApi\)\s*\n?\s*:\s*adminGuildIds\(user\)/,
    "bitmaska nie jest zapasem, tylko pierwszym zrodlem",
  );
});
