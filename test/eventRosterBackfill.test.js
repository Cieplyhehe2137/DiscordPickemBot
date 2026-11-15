// Czy backfill rostera turnieju wie, czego NIE wolno tknąć.
//
// Ten test pilnuje decyzji, nie zapisu. Zapis to trzy linie w
// scripts/backfillEventTeams.mjs; cała treść siedzi w tym, które turnieje
// skrypt przepuszcza - a każdy fałszywy przepust kończy się rosterem
// węższym od rzeczywistości, czyli zablokowanym zapisem typu albo wyniku
// na produkcji.
//
// Trzy rzeczy, które mogą tu zepsuć turniej po cichu:
//
//   1. KOLEJNOŚĆ. `sort_order` zapisuje się jako pozycja w tablicy i czytają
//      go dropdowny wyników admina. Lista musi wyjść w kolejności SŁOWNIKA,
//      nie w kolejności napotkania nazw w meczach - a jedno i drugie wygląda
//      w logu identycznie.
//
//   2. TURNIEJ W TRAKCIE. Jego mecze są niepełne, więc roster z nich jest
//      węższy od rzeczywistości i blokuje typ na drużynę, która jeszcze nie
//      zagrała. Widać to dopiero wtedy, gdy gracz dostanie 400.
//
//   3. NADPISANIE PANELU. Roster wskazany ręcznie jest decyzją człowieka
//      i skrypt nie ma prawa go ruszyć - inaczej ponowny przebieg cofa
//      czyjąś pracę.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const KORZEN = path.join(__dirname, "..");

const MODUL = path.join(KORZEN, "server", "lib", "eventRosterBackfill.js");
const SKRYPT = path.join(KORZEN, "scripts", "backfillEventTeams.mjs");

async function zaladuj() {
  return import(`file:///${MODUL.replace(/\\/g, "/")}`);
}

// Słownik w KOLEJNOŚCI SŁOWNIKA (sort_order, potem nazwa) - tak go czyta
// skrypt i tak go czyta trasa panelu.
const SLOWNIK = [
  { id: 10, name: "Vitality", active: 0 },
  { id: 11, name: "Natus Vincere", active: 1 },
  { id: 12, name: "BETBOOM", active: 1 },
  { id: 13, name: "MOUZ", active: 1 },
  { id: 14, name: "Falcons", active: 1 },
];

const ZAKONCZONY = {
  id: 7,
  status: "FINISHED",
  is_archived: 1,
  is_open: 0,
  is_active: 0,
};

function plan(mod, nadpisania = {}) {
  return mod.planEventRoster({
    event: ZAKONCZONY,
    slownik: SLOWNIK,
    nazwyZMeczow: [],
    nazwyZWynikow: [],
    wierszyRostera: 0,
    ...nadpisania,
  });
}

test("roster wychodzi w kolejnosci SLOWNIKA, nie w kolejnosci meczow", async () => {
  const mod = await zaladuj();

  // Nazwy podane od konca slownika - gdyby liczyla sie kolejnosc napotkania,
  // wyszloby [14, 13, 12].
  const wynik = plan(mod, {
    nazwyZMeczow: ["Falcons", "MOUZ", "BETBOOM"],
  });

  assert.equal(wynik.zapisac, true);
  assert.deepEqual(wynik.teamIds, [12, 13, 14]);
});

test("dopasowanie idzie przez teamKey, a nie przez rownosc napisow", async () => {
  const mod = await zaladuj();

  // "BetBoom" przy slownikowym "BETBOOM" i "NAVI" przy "Natus Vincere" -
  // oba przypadki wziete z meczow IEM Cologne na produkcji.
  const wynik = plan(mod, { nazwyZMeczow: ["BetBoom", "NAVI"] });

  assert.equal(wynik.zapisac, true);
  assert.deepEqual(wynik.nieznane, []);
  assert.deepEqual(wynik.teamIds, [11, 12]);
});

test("dwie nazwy tej samej druzyny daja JEDEN wiersz", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    nazwyZMeczow: ["NAVI", "Natus Vincere", "navi"],
  });

  assert.deepEqual(wynik.teamIds, [11]);
});

test("opublikowany wynik doklada druzyne, ktorej nie ma w meczach", async () => {
  const mod = await zaladuj();

  // Roster bramkuje tez zapis WYNIKU (server/routes/phaseResults.js), wiec
  // druzyna z oficjalnej odpowiedzi musi w nim byc, nawet gdy mecze o niej
  // nie wiedza.
  const wynik = plan(mod, {
    nazwyZMeczow: ["MOUZ"],
    nazwyZWynikow: ["Falcons"],
  });

  assert.deepEqual(wynik.teamIds, [13, 14]);
});

test("same wyniki, bez ani jednego meczu, NIE daja rostera", async () => {
  const mod = await zaladuj();

  // Wyniki wymieniaja tych, ktorzy awansowali - to lista niepelna. Taki
  // turniej jest na produkcji: StarLadder Budapest Major 2025, 1055 typow
  // i zero meczow.
  const wynik = plan(mod, {
    nazwyZMeczow: [],
    nazwyZWynikow: ["MOUZ", "Falcons"],
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.BRAK_MECZOW);
  assert.deepEqual(wynik.teamIds, []);
});

test("turniej, ktory ma juz roster, zostaje nietkniety", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    nazwyZMeczow: ["MOUZ"],
    wierszyRostera: 24,
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.MA_ROSTER);
});

test("turniej, ktory sie nie skonczyl, zostaje nietkniety", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    event: { id: 9, status: "UPCOMING", is_archived: 0, is_open: 0, is_active: 0 },
    nazwyZMeczow: ["MOUZ", "Falcons"],
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.NIE_ZAKONCZONY);
});

test("otwarte typowanie wygrywa nawet przy turnieju zarchiwizowanym", async () => {
  const mod = await zaladuj();

  // Zgodnosc wszystkich trzech pol lifecycle to warunek z
  // utils/protectionsGuards.js. Flaga archiwum przepuszcza, ale typowanie
  // trwa - i wtedy roster blokowalby zapis.
  const wynik = plan(mod, {
    event: { id: 9, status: "OPEN", is_archived: 1, is_open: 1, is_active: 1 },
    nazwyZMeczow: ["MOUZ", "Falcons"],
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.OTWARTE_TYPOWANIE);
});

test("nazwa bez wiersza w slowniku odmawia calego turnieju", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    nazwyZMeczow: ["MOUZ", "The MongolZ", "Astralis"],
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.NIEPELNY);
  assert.deepEqual(wynik.nieznane, ["The MongolZ", "Astralis"]);
  assert.deepEqual(wynik.teamIds, []);
});

test("--allow-incomplete zapisuje liste niepelna i nadal wymienia braki", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    nazwyZMeczow: ["MOUZ", "The MongolZ"],
    dopuscNiepelny: true,
  });

  assert.equal(wynik.zapisac, true);
  assert.deepEqual(wynik.teamIds, [13]);
  assert.deepEqual(wynik.nieznane, ["The MongolZ"]);
});

test("sam brak wiersza w slowniku nie robi z pustej listy rostera", async () => {
  const mod = await zaladuj();

  // Przypadek z produkcji: IEM Krakow ma 24 nazwy z meczow i ZERO trafien
  // w slowniku tego serwera. Pusty INSERT nie moze przejsc nawet z flaga.
  const wynik = plan(mod, {
    nazwyZMeczow: ["The MongolZ", "Astralis", "paiN"],
    dopuscNiepelny: true,
  });

  assert.equal(wynik.zapisac, false);
  assert.equal(wynik.powod, mod.POWODY.NIEPELNY);
});

test("raport mowi, co dochodzi i co wypada wzgledem dzisiejszego zapasu", async () => {
  const mod = await zaladuj();

  const wynik = plan(mod, {
    nazwyZMeczow: ["Vitality", "MOUZ", "BETBOOM", "Natus Vincere"],
  });

  // Vitality jest wylaczona, a zagrala - dochodzi. Falcons jest aktywna,
  // a nie zagrala - wypada.
  assert.deepEqual(wynik.dodane, ["Vitality"]);
  assert.deepEqual(wynik.zabrane, ["Falcons"]);
});

test("roster nie wciaga ani jednego id spoza slownika", async () => {
  const mod = await zaladuj();

  const znane = new Set(SLOWNIK.map((d) => d.id));

  const wynik = plan(mod, {
    nazwyZMeczow: ["MOUZ", "BetBoom", "NAVI", "Falcons", "Vitality"],
  });

  for (const id of wynik.teamIds) {
    assert.ok(znane.has(id), `id ${id} nie jest ze slownika`);
  }
});

test("typy poza rosterem: zglasza druzyne slownikowa, milczy o nieznanej", async () => {
  const mod = await zaladuj();

  const poza = mod.typyPozaRosterem({
    // "Falcons" jest w slowniku i NIE jest w rosterze - wypadnie z listy.
    // "The MongolZ" nie ma wiersza, czyli na liscie nie ma jej juz dzis.
    nazwyZTypow: ["MOUZ", "Falcons", "The MongolZ"],
    slownik: SLOWNIK,
    teamIds: [13],
  });

  assert.deepEqual(poza, ["Falcons"]);
});

test("typy poza rosterem rozpoznaja te sama druzyne pod inna nazwa", async () => {
  const mod = await zaladuj();

  const poza = mod.typyPozaRosterem({
    nazwyZTypow: ["NAVI"],
    slownik: SLOWNIK,
    teamIds: [11],
  });

  assert.deepEqual(poza, [], "NAVI to wiersz 11, ktory JEST w rosterze");
});

// --- straznik tekstowy skryptu -----------------------------------------
//
// Planer oddaje kolejnosc slownika, ale to skrypt zamienia ja na
// `sort_order`. Posortowanie albo przestawienie tej tablicy po drodze nie
// wywolaloby zadnego bledu - zmienilo by tylko rozstawienie turnieju.

test("skrypt zapisuje sort_order jako pozycje w tablicy planera", async () => {
  const tekst = fs.readFileSync(SKRYPT, "utf8");

  assert.match(
    tekst,
    /plan\.teamIds\.map\(\(id, index\) => \[ev\.id, id, index \+ 1\]\)/,
    "sort_order nie jest pozycja w tablicy planera",
  );

  for (const wzor of [/plan\.teamIds\.sort/, /plan\.teamIds\.reverse/]) {
    assert.doesNotMatch(tekst, wzor, "skrypt przestawia kolejnosc planera");
  }
});

test("skrypt domyslnie nie zapisuje", async () => {
  const tekst = fs.readFileSync(SKRYPT, "utf8");

  assert.match(
    tekst,
    /const ZAPISZ = process\.argv\.includes\("--apply"\)/,
    "zapis nie jest zapiety na --apply",
  );

  assert.match(
    tekst,
    /FOR UPDATE/,
    "brak powtornego sprawdzenia rostera w transakcji",
  );
});
