// Lista ostatniej aktywnosci (server/lib/activityFeed.js).
//
// Trzy rzeczy, ktore moglyby tu sklamac, nie rzucajac bledu:
//
//   1. KOLEJNOSC. Zdarzenia przychodza z szesciu tabel, kazda posortowana
//      osobno. Scalenie bez ponownego sortowania ulozyloby liste wedlug
//      tabel, a nie czasu - i wygladaloby wiarygodnie.
//
//   2. WIERSZ BEZ CZASU. Turnieje wgrane importem maja puste submitted_at
//      w KAZDYM wierszu faz (zmierzone: Cologne 583, Budapest 837, a
//      turnieje grane na zywo zero). Takiego wiersza nie da sie postawic
//      na osi, ale zniknac po cichu tez nie moze.
//
//   3. DANE Z IMPORTU. Cologne ma 6424 typy na 15 roznych znacznikow -
//      wszystkie w 14 sekund. Bez ostrzezenia wygladaja jak nagly wysyp
//      typowania.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const MODUL = path.join(__dirname, "..", "server", "lib", "activityFeed.js");

async function zaladuj() {
  return import(`file:///${MODUL.replace(/\\/g, "/")}`);
}

const T = (iso) => new Date(iso);

/* ===============================
   KOLEJNOSC
   =============================== */

test("zdarzenia z roznych tabel ida wedlug czasu, nie wedlug zrodla", async () => {
  const { buildActivityFeed } = await zaladuj();

  const { items } = buildActivityFeed({
    sources: [
      [
        { kind: "matchPick", at: T("2026-11-24T10:00:00Z"), user_id: "a" },
        { kind: "matchPick", at: T("2026-11-24T08:00:00Z"), user_id: "a" },
      ],
      [{ kind: "swissPick", at: T("2026-11-24T09:00:00Z"), user_id: "b" }],
      [{ kind: "matchResult", at: T("2026-11-24T11:00:00Z") }],
    ],
  });

  assert.deepEqual(
    items.map((i) => i.at),
    [
      "2026-11-24T11:00:00.000Z",
      "2026-11-24T10:00:00.000Z",
      "2026-11-24T09:00:00.000Z",
      "2026-11-24T08:00:00.000Z",
    ],
  );
});

test("limit tnie najstarsze, nie najnowsze", async () => {
  const { buildActivityFeed } = await zaladuj();

  const zrodlo = [1, 2, 3, 4, 5].map((h) => ({
    kind: "matchPick",
    at: T(`2026-11-24T0${h}:00:00Z`),
    user_id: "a",
  }));

  const { items, considered } = buildActivityFeed({
    sources: [zrodlo],
    limit: 2,
  });

  assert.equal(considered, 5, "rozpatrzone wszystkie");
  assert.equal(items.length, 2);
  assert.equal(items[0].at, "2026-11-24T05:00:00.000Z");
  assert.equal(items[1].at, "2026-11-24T04:00:00.000Z");
});

/* ===============================
   WIERSZE, KTORYCH NIE DA SIE POKAZAC
   =============================== */

test("wiersz bez czasu wypada, ale zostaje policzony", async () => {
  const { buildActivityFeed } = await zaladuj();

  const wynik = buildActivityFeed({
    sources: [
      [
        { kind: "swissPick", at: null, user_id: "a" },
        { kind: "swissPick", at: undefined, user_id: "b" },
        { kind: "swissPick", at: "", user_id: "c" },
        { kind: "swissPick", at: T("2026-11-24T10:00:00Z"), user_id: "d" },
      ],
    ],
  });

  assert.equal(wynik.items.length, 1);
  assert.equal(wynik.skippedWithoutTime, 3);
});

test("niepoprawna data traktuje sie jak brak czasu", async () => {
  const { buildActivityFeed } = await zaladuj();

  const wynik = buildActivityFeed({
    sources: [[{ kind: "matchPick", at: "to nie jest data", user_id: "a" }]],
  });

  assert.equal(wynik.items.length, 0);
  assert.equal(wynik.skippedWithoutTime, 1);
});

test("nieznany rodzaj zdarzenia nie trafia na liste", async () => {
  const { buildActivityFeed } = await zaladuj();

  const wynik = buildActivityFeed({
    sources: [
      [
        { kind: "cosNowego", at: T("2026-11-24T10:00:00Z") },
        { kind: "matchPick", at: T("2026-11-24T09:00:00Z"), user_id: "a" },
      ],
    ],
  });

  assert.equal(wynik.items.length, 1);
  assert.equal(wynik.skippedUnknownKind, 1);
});

/* ===============================
   NAZWY GRACZY
   =============================== */

test("nick bierze sie z profilu, a w zapasie z samego wiersza", async () => {
  const { buildActivityFeed } = await zaladuj();

  const names = new Map([["a", { displayname: "Czapla", username: "czapla1" }]]);

  const { items } = buildActivityFeed({
    sources: [
      [
        { kind: "matchPick", at: T("2026-11-24T10:00:00Z"), user_id: "a" },
        // match_predictions nie niesie nicku, tabele faz niosa wlasna kopie
        {
          kind: "swissPick",
          at: T("2026-11-24T09:00:00Z"),
          user_id: "b",
          displayname: "Zapasowy",
        },
        { kind: "matchPick", at: T("2026-11-24T08:00:00Z"), user_id: "c" },
      ],
    ],
    names,
  });

  assert.equal(items[0].displayname, "Czapla", "z profilu");
  assert.equal(items[1].displayname, "Zapasowy", "z wiersza");
  assert.equal(items[2].displayname, null, "nie ma skad wziac");
});

test("identyfikator gracza zawsze wychodzi jako tekst", async () => {
  const { buildActivityFeed } = await zaladuj();

  // MySQL potrafi oddac BIGINT jako liczbe, a Map kluczuje po tekscie.
  const names = new Map([["123", { displayname: "Ktos" }]]);

  const { items } = buildActivityFeed({
    sources: [[{ kind: "matchPick", at: T("2026-11-24T10:00:00Z"), user_id: 123 }]],
    names,
  });

  assert.equal(items[0].user_id, "123");
  assert.equal(items[0].displayname, "Ktos");
});

test("zdarzenie bez gracza (wynik meczu) nie wysypuje nazw", async () => {
  const { buildActivityFeed } = await zaladuj();

  const { items } = buildActivityFeed({
    sources: [[{ kind: "matchResult", at: T("2026-11-24T10:00:00Z"), user_id: null }]],
    names: new Map([["a", { displayname: "X" }]]),
  });

  assert.equal(items[0].user_id, null);
  assert.equal(items[0].displayname, null);
});

/* ===============================
   DANE Z IMPORTU
   =============================== */

test("setki wierszy na kilkanascie znacznikow rozpoznaje sie jako import", async () => {
  const { looksImported } = await zaladuj();

  // Cologne: 6424 typy, 15 roznych czasow, wszystkie w 14 sekund.
  const cologne = Array.from({ length: 300 }, (_, i) => ({
    at: T(`2026-09-10T15:41:${String(37 + (i % 15)).padStart(2, "0")}Z`),
  }));

  assert.equal(looksImported(cologne), true);
});

test("typowanie na zywo nie jest brane za import", async () => {
  const { looksImported } = await zaladuj();

  // Singapore: 1444 typy, 1418 roznych czasow.
  const zywe = Array.from({ length: 300 }, (_, i) => ({
    at: new Date(Date.UTC(2026, 10, 24, 10, 0, 0) + i * 37000),
  }));

  assert.equal(looksImported(zywe), false);
});

test("garstka zdarzen nie jest oceniana - za malo, zeby cokolwiek orzec", async () => {
  const { looksImported } = await zaladuj();

  const malo = Array.from({ length: 5 }, () => ({
    at: T("2026-11-24T10:00:00Z"),
  }));

  assert.equal(looksImported(malo), false);
});

test("flaga importu wychodzi w wyniku", async () => {
  const { buildActivityFeed } = await zaladuj();

  const import300 = Array.from({ length: 300 }, () => ({
    kind: "matchPick",
    at: T("2026-09-10T15:41:40Z"),
    user_id: "a",
  }));

  assert.equal(buildActivityFeed({ sources: [import300] }).importLooking, true);
});

/* ===============================
   SKRAJNOSCI
   =============================== */

test("brak zrodel oddaje pusta liste, a nie wyjatek", async () => {
  const { buildActivityFeed } = await zaladuj();

  const wynik = buildActivityFeed();

  assert.deepEqual(wynik.items, []);
  assert.equal(wynik.considered, 0);
  assert.equal(wynik.newest, null);
  assert.equal(wynik.oldest, null);
  assert.equal(wynik.importLooking, false);
});

test("zakres czasu opisuje to, co na liscie, a nie to, co odrzucono", async () => {
  const { buildActivityFeed } = await zaladuj();

  const zrodlo = [1, 2, 3].map((h) => ({
    kind: "matchPick",
    at: T(`2026-11-24T0${h}:00:00Z`),
    user_id: "a",
  }));

  const { newest, oldest } = buildActivityFeed({ sources: [zrodlo], limit: 2 });

  assert.equal(newest, "2026-11-24T03:00:00.000Z");
  assert.equal(oldest, "2026-11-24T02:00:00.000Z", "nie 01:00 - ten wypadl");
});

test("wszystkie rodzaje zdarzen sa dopuszczone", async () => {
  const { buildActivityFeed, ACTIVITY_KINDS } = await zaladuj();

  const zrodlo = ACTIVITY_KINDS.map((kind, i) => ({
    kind,
    at: new Date(Date.UTC(2026, 10, 24, 10, i)),
    user_id: "a",
  }));

  const wynik = buildActivityFeed({ sources: [zrodlo] });

  assert.equal(wynik.items.length, ACTIVITY_KINDS.length);
  assert.equal(wynik.skippedUnknownKind, 0);
});
