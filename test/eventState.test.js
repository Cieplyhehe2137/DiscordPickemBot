// Stan turnieju widziany przez odwiedzajacego (web/src/lib/eventState.js).
//
// Baza opisuje go czterema polami naraz - status, is_open, is_active,
// is_archived - a API dokłada wyliczone is_live. Widok potrzebuje jednej
// z trzech odpowiedzi i wczesniej kazda strona liczyla ja po swojemu:
// strona glowna miala trzy stany i opierala sie na is_archived, lista
// eventow miala dwa i wszystko poza live nazywala zakonczonym.
//
// Skutek tego drugiego: turniej utworzony przez /start_pickem, ale bez
// opublikowanego panelu fazy, trafial na liste pod naglowek "Archiwum -
// Zakonczone", zanim sie w ogole zaczal.

const test = require("node:test");
const assert = require("node:assert/strict");

const STAN = "../web/src/lib/eventState.js";

test("otwarty turniej to live", async () => {
  const { eventState } = await import(STAN);

  assert.equal(
    eventState({ is_live: true, status: "OPEN", is_archived: false }),
    "live",
  );
});

test("utworzony, ale bez panelu fazy, to wkrotce", async () => {
  const { eventState } = await import(STAN);

  // Dokladnie to, co zostawia /start_pickem: wiersz w events istnieje,
  // ale publisher jeszcze go nie aktywowal.
  assert.equal(
    eventState({
      is_live: false,
      status: "UPCOMING",
      is_open: 0,
      is_active: 0,
      is_archived: false,
    }),
    "upcoming",
  );
});

test("zamkniety i zakonczony to zakonczony", async () => {
  const { eventState } = await import(STAN);

  for (const status of ["CLOSED", "FINISHED"]) {
    assert.equal(eventState({ is_live: false, status }), "finished", status);
  }
});

test("archiwum bije status, takze gdy status zostal na UPCOMING", async () => {
  const { eventState } = await import(STAN);

  // Zarchiwizowany turniej zachowuje swoj historyczny status, wiec potrafi
  // miec UPCOMING. Archiwum jest ostateczne - inaczej stary turniej wrocilby
  // na strone jako zapowiedz.
  assert.equal(
    eventState({ is_live: false, status: "UPCOMING", is_archived: true }),
    "finished",
  );
});

test("live wygrywa nawet z archiwum", async () => {
  const { eventState } = await import(STAN);

  // Stan niespojny, ale gdyby zaistnial: "trwa" jest informacja pilniejsza
  // niz "zarchiwizowany", a i tak widac go tylko wtedy, gdy API policzylo
  // is_live jako prawda.
  assert.equal(
    eventState({ is_live: true, status: "UPCOMING", is_archived: true }),
    "live",
  );
});

test("braki i smieci nie wywracaja widoku", async () => {
  const { eventState } = await import(STAN);

  for (const wejscie of [null, undefined, {}, { status: null }, { status: 7 }]) {
    assert.equal(eventState(wejscie), "finished", JSON.stringify(wejscie));
  }
});

test("status rozpoznawany bez wzgledu na wielkosc liter", async () => {
  const { eventState } = await import(STAN);

  assert.equal(eventState({ status: "upcoming" }), "upcoming");
  assert.equal(eventState({ status: "Upcoming" }), "upcoming");
});

test("kazdy stan ma etykiete i ton plakietki", async () => {
  const { EVENT_STATE_LABEL, EVENT_STATE_BADGE } = await import(STAN);

  for (const stan of ["live", "upcoming", "finished"]) {
    assert.ok(EVENT_STATE_LABEL[stan], `brak etykiety dla ${stan}`);
    assert.match(
      EVENT_STATE_BADGE[stan],
      /^ui-badge\b/,
      `ton dla ${stan} ma zaczynac sie od ui-badge`,
    );
  }
});
