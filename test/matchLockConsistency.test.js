// Czy WSZYSTKIE strony zgadzaja sie co do tego, czy mecz jest zablokowany.
//
// Blokada ma w tej bazie DWIE kolumny: `is_locked` (tryb automatyczny,
// ustawia ja zegar przez matchLockWatcher) i `lock_override` (reczna decyzja
// admina: 1 zamkniete, 0 otwarte, NULL oddaj decyzje zegarowi). Autorytetem
// jest utils/matchLock.js - i on patrzy NAJPIERW na override.
//
// Zgloszenie z 2026-11-26: "odblokowalem na www dwa mecze, a dalej pokazuje,
// ze sa zablokowane". Zmierzone na produkcji - mecze 630 i 631 mialy
// `is_locked = 1` i `lock_override = 0`, czyli byly otwarte do typowania,
// ale kazde miejsce czytajace surowa kolumne pokazywalo klodke, a przycisk
// blokady w bocie wrecz odmawial dzialania slowami "mecz juz wystartowal".
//
// Te testy pilnuja trzech rzeczy:
//   1. widok liczy blokade tak samo jak bramka typowania,
//   2. zapis z panelu i z bota zostawia OBIE kolumny zgodne,
//   3. zaden z tych plikow nie wraca do czytania samego `is_locked`.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { isMatchLocked } = require("../utils/matchLock");

const ROOT = path.join(__dirname, "..");

const PUBLIC_MATCH = path.join(ROOT, "server", "lib", "publicMatch.js");

async function zaladujPublicMatch() {
  return import(`file:///${PUBLIC_MATCH.replace(/\\/g, "/")}`);
}

// Mecz, ktory juz wystartowal - zegar sam z siebie by go zamknal.
const PO_STARCIE = {
  id: 630,
  team_a: "Lynn Vision",
  team_b: "PARIVISION",
  start_time_utc: "2020-01-01T00:00:00.000Z",
};

/* ===============================
   WIDOK = BRAMKA
   =============================== */

test("odblokowany recznie mecz po starcie NIE jest zablokowany", async () => {
  // Dokladnie stan meczow 630 i 631 z produkcji.
  const match = { ...PO_STARCIE, is_locked: 1, lock_override: 0 };

  assert.equal(isMatchLocked(match), false, "bramka typowania: otwarty");

  const { getPublicMatchStatus } = await zaladujPublicMatch();

  assert.equal(
    getPublicMatchStatus(match),
    "OPEN",
    "widok musi mowic to samo, co bramka",
  );
});

test("zablokowany recznie mecz przed startem JEST zablokowany", async () => {
  const match = {
    ...PO_STARCIE,
    start_time_utc: "2099-01-01T00:00:00.000Z",
    is_locked: 0,
    lock_override: 1,
  };

  assert.equal(isMatchLocked(match), true);

  const { getPublicMatchStatus } = await zaladujPublicMatch();

  assert.equal(getPublicMatchStatus(match), "LOCKED");
});

test("bez recznej decyzji rozstrzyga kolumna i zegar", async () => {
  const { getPublicMatchStatus } = await zaladujPublicMatch();

  const zamkniety = { ...PO_STARCIE, is_locked: 1, lock_override: null };
  const trwajacy = { ...PO_STARCIE, is_locked: 0, lock_override: null };

  const przedStartem = {
    ...PO_STARCIE,
    start_time_utc: "2099-01-01T00:00:00.000Z",
    is_locked: 0,
    lock_override: null,
  };

  assert.equal(getPublicMatchStatus(zamkniety), "LOCKED");
  assert.equal(isMatchLocked(zamkniety), true);

  // Widok ma WIECEJ stanow niz bramka: mecz, ktory sie zaczal, a nie zostal
  // zamkniety recznie, opisuje sie jako LIVE. Dla typowania jest zamkniety
  // (zegar), ale nazwanie go "LOCKED" mowiloby widzowi co innego, niz widzi
  // na ekranie. To nie jest rozjazd, tylko inny poziom szczegolowosci.
  assert.equal(getPublicMatchStatus(trwajacy), "LIVE");
  assert.equal(isMatchLocked(trwajacy), true, "dla typowania zamkniety");

  assert.equal(getPublicMatchStatus(przedStartem), "OPEN");
  assert.equal(isMatchLocked(przedStartem), false);
});

test("reczna decyzja wygrywa z kolumna i z zegarem, zawsze", async () => {
  const { getPublicMatchStatus } = await zaladujPublicMatch();

  // Tu widok i bramka MUSZA sie zgadzac co do joty: override to jawna
  // decyzja czlowieka i nie ma jej jak interpretowac inaczej.
  for (const is_locked of [0, 1]) {
    for (const lock_override of [0, 1]) {
      for (const start of [
        "2020-01-01T00:00:00.000Z",
        "2099-01-01T00:00:00.000Z",
        null,
      ]) {
        const match = {
          ...PO_STARCIE,
          is_locked,
          lock_override,
          start_time_utc: start,
        };

        const zBramki = isMatchLocked(match) ? "LOCKED" : "OPEN";

        assert.equal(
          getPublicMatchStatus(match),
          zBramki,
          `rozjazd dla is_locked=${is_locked} override=${lock_override} start=${start}`,
        );
      }
    }
  }
});

/* ===============================
   ZAPIS ZOSTAWIA KOLUMNY ZGODNE
   =============================== */

test("setMatchLock zapisuje OBIE kolumny, nie sama is_locked", async () => {
  const { setMatchLock } = require("../utils/matchesStore");

  const zapytania = [];

  const pool = {
    async query(sql, params) {
      zapytania.push({ sql, params });

      return [{ affectedRows: 1 }, []];
    },
  };

  await setMatchLock(pool, "123", 630, false);

  const { sql, params } = zapytania[0];

  assert.ok(sql.includes("is_locked"), "brak is_locked");
  assert.ok(sql.includes("lock_override"), "brak lock_override w zapisie");

  // odblokowanie: obie kolumny na 0
  assert.equal(params[0], 0);
  assert.equal(params[1], 0);

  zapytania.length = 0;

  await setMatchLock(pool, "123", 630, true);

  assert.equal(zapytania[0].params[0], 1);
  assert.equal(zapytania[0].params[1], 1);
});

/* ===============================
   STRAZNIK: zaden powrot do surowej kolumny
   =============================== */

test("kazde miejsce decydujace o blokadzie zna lock_override", () => {
  // Sama wzmianka o `is_locked` nie jest bledem - w publicMatch.js to
  // poprawna gałąź ZAPASOWA, uzywana dopiero gdy recznej decyzji nie ma.
  // Bledem jest nieznajomosc override, i tego pilnuje ten test: plik ma
  // albo sam sprawdzac lock_override, albo oddawac decyzje isMatchLocked.
  const PLIKI = [
    "server/lib/publicMatch.js",
    "handlers/matches/matchAdminLockToggle.js",
    "handlers/admin/eventAuditMatch.js",
  ];

  for (const rel of PLIKI) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), "utf8");

    const zna =
      tresc.includes("lock_override") || tresc.includes("isMatchLocked");

    assert.ok(
      zna,
      `${rel}: decyduje o blokadzie, a nie zna lock_override ani isMatchLocked`,
    );
  }
});

test("przelacznik w bocie nie odmawia odblokowania po starcie meczu", () => {
  // Panel WWW pozwala otworzyc mecz po starcie - po to jest override.
  // Bot odmawiajacy tego samego stawial oba wejscia w sprzecznosci
  // i to bylo zgloszenie: "odblokowalem na www, a bot dalej mowi,
  // ze zablokowany".
  const tresc = fs.readFileSync(
    path.join(ROOT, "handlers", "matches", "matchAdminLockToggle.js"),
    "utf8",
  );

  assert.ok(
    !/Nie można odblokować/.test(tresc),
    "wrocila odmowa odblokowania po starcie meczu",
  );
});

test("publiczny przeglad liczy status z uwzglednieniem override", () => {
  const tresc = fs.readFileSync(
    path.join(ROOT, "server", "routes", "publicOverview.js"),
    "utf8",
  );

  assert.ok(
    /m\.lock_override\s*=\s*1\s+THEN\s+'LOCKED'/i.test(tresc),
    "CASE nie zna lock_override = 1",
  );

  assert.ok(
    /m\.lock_override\s*=\s*0\s+THEN\s+'OPEN'/i.test(tresc),
    "CASE nie zna lock_override = 0",
  );

  assert.ok(
    /SELECT[\s\S]*m\.lock_override/i.test(tresc),
    "kolumna lock_override nie jest w ogole pobierana",
  );
});
