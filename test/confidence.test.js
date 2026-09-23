// Pewnosc typu: 2:0 kontra 2:1 (server/lib/confidence.js).
//
// Wynik serii NIE DAJE ani jednego punktu - regulamin placi wylacznie za
// zwyciezce, a utils/matchScoring.js mowi to wprost. A mimo to niesie
// najmocniejszy sygnal w calej tabeli. Zmierzone na wszystkich turniejach:
// typy 2:0 trafiaja zwyciezce w 67.2%, typy 2:1 w 52.3% - na 3450 i 3509
// typach. Wsrod 102 osob z dziesiecioma typami kazdego rodzaju 88 trafia
// lepiej na swoich pewnych typach.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/confidence.js";

test("liczy dwie skutecznosci i roznice miedzy nimi", async () => {
  // Prawdziwe liczby BANDITA z produkcji: najwieksza roznica w bazie.
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 25, sureHits: 20, close: 34, closeHits: 11 });

  assert.equal(w.sure.accuracy, 80);
  assert.equal(w.close.accuracy, 32);
  assert.equal(w.gap, 48);
  assert.equal(w.inverted, false);
  assert.equal(w.enough, true);
});

test("ODWROCONA pewnosc jest osobnym stanem, bo to jedyna nowa informacja", async () => {
  // Prawdziwe liczby seby. Czternascie osob na sto dwie ma to odwrotnie:
  // ich "jestem pewien" znaczy mniej niz ich "chyba tak". Dla nich ta
  // sekcja mowi cos, czego nie wiedza - reszta dostaje potwierdzenie.
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 29, sureHits: 15, close: 12, closeHits: 8 });

  assert.equal(w.sure.accuracy, 52);
  assert.equal(w.close.accuracy, 67);
  assert.equal(w.gap, -15);
  assert.equal(w.inverted, true);
});

test("rowne skutecznosci to NIE jest odwrocenie", async () => {
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 20, sureHits: 10, close: 20, closeHits: 10 });

  assert.equal(w.gap, 0);
  assert.equal(w.inverted, false, "zero to brak roznicy, a nie roznica w tamta strone");
});

test("prog dotyczy OBU stron osobno", async () => {
  // Inaczej "100% na trzech pewnych typach" stanaloby obok czterdziestu
  // wyrownanych i wygladalo jak wynik.
  const { buildConfidence, MIN_TYPOW } = await import(MODUL);

  const malo = buildConfidence({ sure: 3, sureHits: 3, close: 40, closeHits: 20 });

  assert.equal(malo.enough, false);
  assert.equal(malo.inverted, false, "ponizej progu nie oglaszamy odwrocenia");

  const rowno = buildConfidence({
    sure: MIN_TYPOW,
    sureHits: MIN_TYPOW,
    close: MIN_TYPOW,
    closeHits: 0,
  });

  assert.equal(rowno.enough, true, "rowno na progu juz sie liczy");
  assert.equal(rowno.threshold, MIN_TYPOW, "prog idzie na front, zeby dalo sie go wyjasnic");
});

test("brak typow danego rodzaju to null, a nie zero procent", async () => {
  // Ktos, kto nigdy nie napisal 2:1, nie ma "zerowej skutecznosci na
  // wyrownanych" - on po prostu tak nie typowal.
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 20, sureHits: 14, close: 0, closeHits: 0 });

  assert.equal(w.close.accuracy, null);
  assert.equal(w.gap, null, "nie ma od czego odjac");
  assert.equal(w.enough, false);
});

test("roznica liczy sie z ZAOKRAGLONYCH odsetkow - tych z ekranu", async () => {
  // 2/3 to 66.67%, 1/2 to 50%. Z surowych ulamkow wyszloby 17, a kafelki
  // pokazuja 67% i 50%, czyli 17 - ale przy 67.4 i 52.6 surowe dalyby 15,
  // a ekran 67 i 53, czyli 14. Liczba pod kafelkami ma sie z nimi zgadzac.
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 1000, sureHits: 674, close: 1000, closeHits: 526 });

  assert.equal(w.sure.accuracy, 67);
  assert.equal(w.close.accuracy, 53);
  assert.equal(w.gap, 14, "67 - 53, a nie 67.4 - 52.6");
});

test("smieci z bazy nie daja skutecznosci ponad sto procent", async () => {
  const { buildConfidence } = await import(MODUL);

  const w = buildConfidence({ sure: 10, sureHits: 99, close: 10, closeHits: -5 });

  assert.equal(w.sure.accuracy, 100);
  assert.equal(w.close.accuracy, 0);
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildConfidence } = await import(MODUL);

  assert.equal(buildConfidence().enough, false);
  assert.equal(buildConfidence({}).gap, null);
  assert.equal(buildConfidence({ sure: null, close: undefined }).sure.picks, 0);
});
