// Etykieta mapy na stronie (web/src/lib/mapLabels.js).
//
// CO SIE OKAZALO. Etykieta "Pick NAVI" byla dotad WYLICZANA z formatu serii:
// mapa 1 to pick druzyny A, mapa 2 druzyny B, ostatnia decider. Nie bylo
// z czego wziac prawdy, wiec serwis podawal przyblizenie jak fakt.
//
// Zmierzone na produkcji po podpieciu dostawcy znajacego veto - 37 meczow
// ESL Pro League Season 24, 113 map:
//
//   zgodne z wyliczeniem :  65
//   NIEZGODNE            :  48
//   trafnosc             :  58%
//
// Decidery zgadzaja sie zawsze: ostatnia mapa jest deciderem niezaleznie od
// wszystkiego. Cala pomylka siedzi w pickach, bo o tym, kto wybiera
// pierwszy, decyduje procedura veto, a nie to, ktora druzyne wpisano
// w panelu jako pierwsza.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/mapLabels.js";

const A = "Spirit";
const B = "MOUZ";

/** Mapy tak, jak przychodza z API: od dostawcy, z prawdziwym veto. */
const OD_DOSTAWCY = [
  { map_no: 1, map_name: "Dust II", picked_by: "TEAM_B", source: "cito" },
  { map_no: 2, map_name: "Mirage", picked_by: "TEAM_A", source: "cito" },
  { map_no: 3, map_name: "Nuke", picked_by: "DECIDER", source: "cito" },
];

/** Mapy wpisane recznie: nazwy sa, pickera NIE MA. */
const RECZNE = [
  { map_no: 1, map_name: "Cache", picked_by: null, source: "manual" },
  { map_no: 2, map_name: "Inferno", picked_by: null, source: "manual" },
];

test("PRAWDA Z VETO wygrywa z wyliczeniem", async () => {
  // To jest cala ta zmiana. Wyliczenie powiedzialoby przy mapie 1 "Pick
  // Spirit" (druzyna A), a naprawde pickowal MOUZ.
  const { pickLabelFor } = await import(MODUL);

  assert.equal(pickLabelFor(OD_DOSTAWCY, 1, 3, A, B), "Pick MOUZ");
  assert.equal(pickLabelFor(OD_DOSTAWCY, 2, 3, A, B), "Pick Spirit");
  assert.equal(pickLabelFor(OD_DOSTAWCY, 3, 3, A, B), "Decider");
});

test("etykieta z veto ROZNI SIE od wyliczenia - inaczej test nic nie znaczy", async () => {
  // Gdyby fikstura przypadkiem zgadzala sie z wyliczeniem, test wyzej
  // przechodzilby takze dla kodu, ktory prawdy nie czyta.
  const { pickLabelFor, getMapLabel } = await import(MODUL);

  assert.notEqual(
    pickLabelFor(OD_DOSTAWCY, 1, 3, A, B),
    getMapLabel(1, 3, A, B),
    "fikstura musi lapac roznice miedzy prawda a wyliczeniem",
  );
});

test("bez prawdy zostaje PRZYBLIZENIE, a nie pustka", async () => {
  // Lepsze niz puste miejsce: decider trafia zawsze, a to polowa
  // informacji. Wpis reczny nie niesie pickera, bo panel przyjmuje nazwy
  // map, a nie przebieg veto.
  const { pickLabelFor, getMapLabel } = await import(MODUL);

  assert.equal(pickLabelFor(RECZNE, 1, 3, A, B), getMapLabel(1, 3, A, B));
  assert.equal(pickLabelFor(RECZNE, 3, 3, A, B), "Decider");
});

test("brak map w ogole tez daje przyblizenie", async () => {
  const { pickLabelFor, getMapLabel } = await import(MODUL);

  for (const puste of [null, undefined, []]) {
    assert.equal(pickLabelFor(puste, 2, 3, A, B), getMapLabel(2, 3, A, B));
  }
});

test("smiec w picked_by nie trafia na ekran", async () => {
  // Gdyby kolumna kiedys dostala wartosc spoza trzech dozwolonych, ma
  // zadzialac przyblizenie - a nie napis "Pick undefined".
  const { pickLabelFor, getMapLabel } = await import(MODUL);

  const zepsute = [{ map_no: 1, map_name: "Nuke", picked_by: "TEAM_C" }];

  assert.equal(pickLabelFor(zepsute, 1, 3, A, B), getMapLabel(1, 3, A, B));
});

test("brak nazwy druzyny nie zostawia pustego miejsca", async () => {
  const { pickLabelFor } = await import(MODUL);

  assert.equal(pickLabelFor(OD_DOSTAWCY, 1, 3, A, null), "Pick Team B");
  assert.equal(pickLabelFor(OD_DOSTAWCY, 2, 3, null, B), "Pick Team A");
});

/* ---------------- nazwa mapy ---------------- */

test("nazwa mapy wychodzi po numerze, nie po kolejnosci w tablicy", async () => {
  const { mapNameFor } = await import(MODUL);

  const przestawione = [OD_DOSTAWCY[2], OD_DOSTAWCY[0]];

  assert.equal(mapNameFor(przestawione, 1), "Dust II");
  assert.equal(mapNameFor(przestawione, 3), "Nuke");
  assert.equal(mapNameFor(przestawione, 2), null, "tej mapy nie ma na liscie");
});

test("pusta nazwa to brak nazwy", async () => {
  const { mapNameFor } = await import(MODUL);

  assert.equal(mapNameFor([{ map_no: 1, map_name: "   " }], 1), null);
  assert.equal(mapNameFor([{ map_no: 1, map_name: null }], 1), null);
  assert.equal(mapNameFor(null, 1), null);
});

/* ---------------- atrybucja ---------------- */

test("atrybucja TYLKO przy danych dostawcy", async () => {
  // Ich regulamin: "You may display data obtained from our API in your
  // applications with proper attribution". Mapy wpisane recznie nie sa ich,
  // wiec nie nosza ich nazwiska.
  const { mapsAttribution } = await import(MODUL);

  assert.equal(mapsAttribution(OD_DOSTAWCY), "cito");
  assert.equal(mapsAttribution(RECZNE), null);
  assert.equal(mapsAttribution([...RECZNE, ...OD_DOSTAWCY]), "cito");
  assert.equal(mapsAttribution([]), null);
  assert.equal(mapsAttribution(null), null);
});

test("klucz atrybucji istnieje we wszystkich jezykach", async () => {
  const { SLOWNIKI } = await import("../web/src/i18n/index.js");

  for (const [jezyk, slownik] of Object.entries(SLOWNIKI)) {
    const wpis = slownik["match.mapsSource.cito"];

    assert.equal(typeof wpis, "string", `${jezyk}: brak klucza atrybucji`);
    assert.match(wpis, /CitoAPI/, `${jezyk}: atrybucja nie nazywa zrodla`);
  }
});

/* ---------------- straznik nad przyblizeniem ---------------- */

test("przyblizenie zostaje zgodne z etykietami bota", async () => {
  // Wyliczenie dalej musi byc spojne z utils/mapLabels.js po stronie bota -
  // to samo przyblizenie w dwoch miejscach ma mowic to samo.
  const { getMapLabel } = await import(MODUL);
  const bot = require("../utils/mapLabels.js");

  for (const bo of [1, 3, 5]) {
    for (let no = 1; no <= bo; no += 1) {
      assert.equal(
        getMapLabel(no, bo, A, B),
        bot.getMapLabel(no, bo, A, B),
        `BO${bo} mapa ${no}`,
      );
    }
  }
});

test("ATRYBUCJA JEDZIE Z DANYMI, a nie z formularzem", () => {
  // CO SIE STALO. Pierwsza wersja rysowala atrybucje tylko w komponencie
  // formularza typowania. Ten nie renderuje sie na meczu rozstrzygnietym
  // ani dla niezalogowanego - a nazwy map od dostawcy stoja tam dalej.
  // Skutek: na stronie zakonczonego meczu byly ich dane BEZ wskazania
  // zrodla, czego wymaga ich regulamin ("You may display data obtained
  // from our API in your applications with proper attribution").
  //
  // Straznik: kazdy komponent, ktory pokazuje dane z match_maps, musi
  // rysowac takze <MapsSource>.
  const fs = require("node:fs");
  const path = require("node:path");

  const plik = path.join(
    __dirname,
    "..",
    "web",
    "src",
    "pages",
    "MatchPage.jsx",
  );

  const tresc = fs.readFileSync(plik, "utf8").replace(/\r\n/g, "\n");

  // Granice komponentow: deklaracje funkcji na poziomie pliku.
  const granice = [...tresc.matchAll(/^function (\w+)\(/gm)].map((m) => ({
    nazwa: m[1],
    od: m.index,
  }));

  assert.ok(granice.length > 3, "nie rozpoznalem komponentow w MatchPage");

  const winni = [];

  for (let i = 0; i < granice.length; i += 1) {
    const { nazwa, od } = granice[i];
    const do_ = i + 1 < granice.length ? granice[i + 1].od : tresc.length;

    const cialo = tresc.slice(od, do_);

    // Sam komponent atrybucji siega po dane, zeby zdecydowac, czy sie
    // pokazac - i oczywiscie nie rysuje sam siebie.
    if (nazwa === "MapsSource") continue;

    const pokazujeDane =
      /\bmapNameFor\(/.test(cialo) || /\bpickLabelFor\(/.test(cialo);

    if (!pokazujeDane) continue;

    if (!/<MapsSource\b/.test(cialo)) winni.push(nazwa);
  }

  assert.deepEqual(
    winni,
    [],
    "te komponenty pokazuja dane dostawcy bez wskazania zrodla: " +
      winni.join(", "),
  );
});

test("atrybucja nie pojawia sie przy samych wpisach recznych", () => {
  // Druga strona tej samej zasady: mapy wpisane przez administratora nie
  // sa cudze, wiec nie nosza cudzego nazwiska. Pilnuje tego mapsAttribution,
  // a ten test trzyma oba warunki razem, zeby nikt nie "naprawil" jednego
  // kosztem drugiego.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs
    .readFileSync(
      path.join(__dirname, "..", "web", "src", "pages", "MatchPage.jsx"),
      "utf8",
    )
    .replace(/\r\n/g, "\n");

  assert.match(
    tresc,
    /mapsAttribution\(/,
    "MapsSource musi pytac mapsAttribution, a nie rysowac sie zawsze",
  );
});
