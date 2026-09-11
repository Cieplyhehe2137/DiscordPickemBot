// Uprawnienia administratora serwera Discorda.
//
// To jest bramka przed 38 trasami zapisujacymi w API, a do tej pory nie miala
// ani jednego testu, bo siedziala w srodku 12-tysiecznego app.js. Po wydzieleniu
// do server/lib/permissions.js da sie ja sprawdzic bez uruchamiania serwera.
//
// Najwazniejsze sa tu dwie rzeczy: ze uprawnienia licza sie na BigInt (pole
// bitowe Discorda jest szersze niz 32 bity) i ze kazda sciezka odmowy zwraca
// wlasciwy kod, a nie przepuszcza dalej.

const test = require("node:test");
const assert = require("node:assert/strict");

const PERMISSIONS = "../server/lib/permissions.js";

const ADMIN = "8";
const BRAK_ADMINA = "104324673"; // sporo uprawnien, ale bez ADMINISTRATOR

function user(guilds) {
  return { id: "1", guilds };
}

function fakeRes() {
  const zapis = { kod: null, tresc: null };

  return {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return this;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return this;
    },
  };
}

test("admin gildii przechodzi, zwykly czlonek nie", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  assert.equal(
    hasAdminPermission(user([{ id: "111", permissions: ADMIN }]), "111"),
    true,
  );

  assert.equal(
    hasAdminPermission(user([{ id: "111", permissions: BRAK_ADMINA }]), "111"),
    false,
    "duzo uprawnien to nie to samo co ADMINISTRATOR",
  );
});

test("uprawnienia z innej gildii nie przenosza sie na te", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  const u = user([{ id: "222", permissions: ADMIN }]);

  assert.equal(hasAdminPermission(u, "111"), false, "admin gdzie indziej");
  assert.equal(hasAdminPermission(u, "222"), true);
});

test("bit ADMINISTRATOR jest widoczny takze w szerokich polach bitowych", async () => {
  const { hasAdminPermission } = await import(PERMISSIONS);

  // Powod, dla ktorego porownanie idzie na BigInt: Number odcialby wyzsze bity.
  const szerokie = (BigInt("0x8") | (1n << 40n)).toString();

  assert.equal(
    hasAdminPermission(user([{ id: "111", permissions: szerokie }]), "111"),
    true,
  );

  const szerokieBezAdmina = (1n << 40n).toString();

  assert.equal(
    hasAdminPermission(user([{ id: "111", permissions: szerokieBezAdmina }]), "111"),
    false,
  );
});

test("guildId porownuje sie jako tekst, wiec liczba tez dziala", async () => {
  const { hasAdminPermission, isGuildMember } = await import(PERMISSIONS);

  const u = user([{ id: "111", permissions: ADMIN }]);

  assert.equal(hasAdminPermission(u, 111), true);
  assert.equal(isGuildMember(u, 111), true);
});

test("braki i smieci koncza sie odmowa, a nie wyjatkiem", async () => {
  const { hasAdminPermission, isGuildMember } = await import(PERMISSIONS);

  assert.equal(hasAdminPermission(null, "111"), false);
  assert.equal(hasAdminPermission(user([]), null), false);
  assert.equal(hasAdminPermission({}, "111"), false, "user bez listy gildii");
  assert.equal(
    hasAdminPermission(user([{ id: "111", permissions: "nie liczba" }]), "111"),
    false,
    "BigInt by tu rzucil - ma wyjsc odmowa",
  );

  assert.equal(isGuildMember(null, "111"), false);
  assert.equal(isGuildMember({}, "111"), false);
});

test("requireGuildAdmin: bez zalogowania 401 i bez pytania bazy", async () => {
  const { requireGuildAdmin } = await import(PERMISSIONS);

  let pytanoBaze = false;

  const middleware = requireGuildAdmin(() => {
    pytanoBaze = true;
    return "111";
  });

  const res = fakeRes();
  let poszloDalej = false;

  await middleware({ session: {} }, res, () => {
    poszloDalej = true;
  });

  assert.equal(res.zapis.kod, 401);
  assert.equal(poszloDalej, false);
  assert.equal(pytanoBaze, false, "resolver nie ma prawa ruszyc przed logowaniem");
});

test("requireGuildAdmin: brak gildii to 404, brak uprawnien to 403", async () => {
  const { requireGuildAdmin } = await import(PERMISSIONS);

  const zalogowany = { session: { user: user([{ id: "111", permissions: ADMIN }]) } };

  const brakGildii = fakeRes();
  await requireGuildAdmin(() => null)(zalogowany, brakGildii, () => {});
  assert.equal(brakGildii.zapis.kod, 404);

  const obcaGildia = fakeRes();
  let poszloDalej = false;
  await requireGuildAdmin(() => "999")(zalogowany, obcaGildia, () => {
    poszloDalej = true;
  });
  assert.equal(obcaGildia.zapis.kod, 403);
  assert.equal(poszloDalej, false);
});

test("requireGuildAdmin: admin przechodzi dalej i dostaje guildId w req", async () => {
  const { requireGuildAdmin } = await import(PERMISSIONS);

  const req = { session: { user: user([{ id: "111", permissions: ADMIN }]) } };
  const res = fakeRes();
  let poszloDalej = false;

  // Resolver moze byc asynchroniczny - w app.js czesc z nich pyta baze.
  await requireGuildAdmin(async () => 111)(req, res, () => {
    poszloDalej = true;
  });

  assert.equal(poszloDalej, true);
  assert.equal(res.zapis.kod, null, "nic nie zostalo odrzucone");
  assert.equal(req.guildId, "111", "zawsze tekstem, nawet gdy resolver dal liczbe");
});

test("requireGuildAdmin: blad resolvera to 500, nie przepuszczenie", async () => {
  const { requireGuildAdmin } = await import(PERMISSIONS);

  const oryginalny = console.error;
  console.error = () => {};

  try {
    const res = fakeRes();
    let poszloDalej = false;

    await requireGuildAdmin(async () => {
      throw new Error("baza padla");
    })({ session: { user: user([]) } }, res, () => {
      poszloDalej = true;
    });

    assert.equal(res.zapis.kod, 500);
    assert.equal(poszloDalej, false, "awaria nie moze otwierac bramki");
  } finally {
    console.error = oryginalny;
  }
});
