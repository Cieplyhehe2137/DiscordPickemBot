// Komunikat o ZAMKNIETYM typowaniu fazy (server/lib/phaseLock.js).
//
// Cztery formularze faz odrzucaly zapis wlasna kopia tego samego bloku
// pieciu linii. Po podziale publicPickem.js na moduly wszystkie cztery
// wolaja jedna funkcje - i wlasnie dlatego powstal ten test: wczesniej
// pomylka dotyczyla jednej fazy, teraz dotyczylaby wszystkich naraz.
//
// Sprawdzane sa dwie rzeczy, ktorych nie pilnowalo nic innego:
//
//   1. Kod wraca TYLKO przy naszym zdaniu zapasowym. Gdy administrator
//      serwera wpisal wlasny powod, kodu nie ma - bo cudzego zdania nie ma
//      w zadnym slowniku, a podmiana na nasze ogolne zjadlaby informacje,
//      ktora napisal specjalnie.
//
//   2. Pole nazywa sie `error` w odpowiedzi 403, a `message` w polu `lock`
//      formularza. To dwa rozne kontrakty na ten sam tekst i dlatego sa to
//      dwie funkcje - pomylka ktoregokolwiek pola daje ekran bez komunikatu.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/phaseLock.js";

// Taki toWebMessage, jaki podaje serwer: wlasny powod wygrywa, inaczej
// zdanie zapasowe.
const toWebMessage = (message, domyslne) => message ?? domyslne;

const FAZY = ["phase", "playin", "playoffs", "doubleelim"];

test("brak powodu od administratora: zdanie zapasowe razem z kodem", async () => {
  const { phaseLockNotice } = await import(MODUL);

  for (const faza of FAZY) {
    const wynik = phaseLockNotice({ allowed: false, message: null }, toWebMessage, faza);

    assert.ok(wynik.message, `${faza}: brak zdania`);
    assert.ok(
      wynik.code && wynik.code.startsWith("server.lock."),
      `${faza}: kod zdania zapasowego musi prowadzic do tlumaczenia, jest ${wynik.code}`,
    );
  }
});

test("wlasny powod administratora idzie na ekran BEZ kodu", async () => {
  const { phaseLockNotice } = await import(MODUL);

  const powod = "Zamykam o 18:00, bo gramy wczesniej.";

  for (const faza of FAZY) {
    const wynik = phaseLockNotice({ allowed: false, message: powod }, toWebMessage, faza);

    assert.equal(wynik.message, powod, `${faza}: zdanie administratora zjedzone`);
    assert.equal(
      wynik.code,
      null,
      `${faza}: kod przy cudzym zdaniu podmienilby je na nasze ogolne`,
    );
  }
});

test("kazda faza ma WLASNY kod i wlasne zdanie", async () => {
  // Blok byl kopiowany miedzy fazami, wiec najbardziej prawdopodobna pomylka
  // to zostawiony kod poprzedniej fazy - gracz Play-In zobaczylby wtedy
  // zdanie o Playoffs.
  const { phaseLockNotice } = await import(MODUL);

  const kody = new Set();
  const zdania = new Set();

  for (const faza of FAZY) {
    const wynik = phaseLockNotice({ allowed: false, message: null }, toWebMessage, faza);

    kody.add(wynik.code);
    zdania.add(wynik.message);
  }

  assert.equal(kody.size, FAZY.length, `powtorzony kod: ${[...kody].join(", ")}`);
  assert.equal(zdania.size, FAZY.length, `powtorzone zdanie: ${[...zdania].join(" | ")}`);
});

test("odpowiedz 403 niesie tekst w polu error, a nie message", async () => {
  const { phaseLockNotice, phaseLockResponse } = await import(MODUL);

  const gate = { allowed: false, message: null };

  const notka = phaseLockNotice(gate, toWebMessage, "playoffs");
  const odpowiedz = phaseLockResponse(gate, toWebMessage, "playoffs");

  assert.deepEqual(odpowiedz, { error: notka.message, code: notka.code });

  assert.equal(
    "message" in odpowiedz,
    false,
    "front czyta bledy z pola error - message w tym miejscu zostawi ekran bez komunikatu",
  );
});
