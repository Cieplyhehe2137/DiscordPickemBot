// Umowa miedzy rules/scoring.js a frontem.
//
// rules/scoring.js opisuje sam siebie jako jedyne zrodlo stalych punktowych.
// Przez dluzszy czas nim nie byl: te same jedenascie liczb stalo wpisanych
// wprost w web/src/components/PhaseResults.jsx. Naglowek rules/scoring.js
// opisuje, jak konczy sie taki uklad - plik pokazywal regulamin, ktorego bot
// nie stosowal (Swiss 4/4/2 zamiast 3/3/1, Playoffs 1/2/3/2 zamiast 2/3/5/2).
//
// Rozjazd stawek nie daje bledu ani wpisu w logach. Daje ekran z inna liczba
// punktow niz ranking, wiec wychodzi dopiero z reklamacji gracza. Te testy sa
// jedynym miejscem, ktore go widzi.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SCORING = require("../rules/scoring");

const MODUL = "../web/src/lib/scoring.js";

const PHASE_RESULTS = path.join(
  __dirname,
  "..",
  "web",
  "src",
  "components",
  "PhaseResults.jsx",
);

// Wszystkie stawki z regulaminu jako plaskie sciezki "KATEGORIA.KLUCZ".
function sciezkiRegulaminu() {
  const wynik = [];

  for (const [kategoria, stawki] of Object.entries(SCORING)) {
    for (const klucz of Object.keys(stawki)) {
      wynik.push(`${kategoria}.${klucz}`);
    }
  }

  return wynik;
}

// --- pointsAt --------------------------------------------------------------

test("pointsAt odroznia zero od braku stawki", async () => {
  // To jest cala trudnosc tej funkcji. MAP.MISS wynosi zero i jest prawdziwa
  // pozycja regulaminu, wiec "nie znalazlem" nie moze zwrocic tej samej
  // wartosci - inaczej literowka w nazwie klucza wyswietla sie na stronie
  // jako regulaminowe 0 pkt, czyli jako informacja zamiast jako brak.
  const { pointsAt } = await import(MODUL);

  assert.equal(pointsAt(SCORING, "MAP.MISS"), 0);
  assert.equal(pointsAt(SCORING, "MAP.NIE_MA_TAKIEGO"), null);
  assert.equal(pointsAt(SCORING, "NIE_MA.WCALE"), null);
});

test("pointsAt znosi brak calej punktacji", async () => {
  // Strona wola ta funkcje zanim odpowiedz z serwera dojdzie, a PhaseResults
  // takze wtedy, gdy strzal po punktacje sie nie udal. Wyjatek w tym miejscu
  // wywalilby caly widok wyniku fazy.
  const { pointsAt } = await import(MODUL);

  assert.equal(pointsAt(null, "MAP.EXACT"), null);
  assert.equal(pointsAt(undefined, "MAP.EXACT"), null);
  assert.equal(pointsAt({}, "MAP.EXACT"), null);
});

// --- tabela na stronie -----------------------------------------------------

test("kazda pozycja tabeli wskazuje na istniejaca stawke", async () => {
  const { SECTIONS, pointsAt } = await import(MODUL);

  for (const sekcja of SECTIONS) {
    for (const zasada of sekcja.rows) {
      assert.notEqual(
        pointsAt(SCORING, zasada.path),
        null,
        `sekcja "${sekcja.key}": ${zasada.path} nie istnieje w rules/scoring.js`,
      );
    }
  }
});

test("zadna stawka z regulaminu nie zostaje poza strona", async () => {
  // Kierunek odwrotny do poprzedniego testu. Bez niego stawka dopisana do
  // rules/scoring.js po prostu nie pojawia sie na stronie z zasadami i nic
  // tego nie zglasza - regulamin znowu zaczyna byc niepelny, tylko inaczej.
  const { SECTIONS } = await import(MODUL);

  const pokazane = new Set(
    SECTIONS.flatMap((sekcja) => sekcja.rows.map((zasada) => zasada.path)),
  );

  for (const sciezka of sciezkiRegulaminu()) {
    assert.ok(
      pokazane.has(sciezka),
      `${sciezka} jest w rules/scoring.js, ale nie ma go w SECTIONS`,
    );
  }
});

// --- wyniki fazy -----------------------------------------------------------

test("wyniki fazy nie maja wpisanej ani jednej stawki", async () => {
  // Dokladnie ten zapis stal tu wczesniej: punktyZa={4}, punktyZa={2},
  // punktyZa={3}, punktyZa={1} - jedenascie liczb bedacych druga kopia
  // regulaminu. Ten test jest jedynym, co powstrzymuje powrot takiej kopii.
  const kod = fs.readFileSync(PHASE_RESULTS, "utf8");

  const wpisane = kod.match(/punktyZa=\{\d+\}/g);

  assert.equal(
    wpisane,
    null,
    `stawki wpisane wprost zamiast z serwera: ${(wpisane || []).join(", ")}`,
  );
});

test("kazda stawka w wynikach fazy wskazuje na istniejaca pozycje", async () => {
  // Nazwa klucza jest tu zwyklym napisem, wiec literowka nie daje bledu -
  // daje wiersz bez dopisku o punktach, ktory wyglada jak faza bez punktacji.
  const { pointsAt } = await import(MODUL);

  const kod = fs.readFileSync(PHASE_RESULTS, "utf8");

  const uzyte = [...kod.matchAll(/punkty\("([^"]+)"\)/g)].map((m) => m[1]);

  assert.ok(uzyte.length > 0, "nie znalazlem ani jednego odczytu stawki");

  for (const sciezka of uzyte) {
    assert.notEqual(
      pointsAt(SCORING, sciezka),
      null,
      `${sciezka} nie istnieje w rules/scoring.js`,
    );
  }
});

// --- Regulaminy juz nieobowiazujace ----------------------------------------

test("kazda zmiana w historii wskazuje na istniejaca pozycje tabeli", async () => {
  // Literowka w sciezce nie daje bledu - daje wiersz, ktory po cichu znika
  // z sekcji "co obowiazywalo wczesniej". Czyli dokladnie ten sam rodzaj
  // milczacej straty, ktorego pilnuje ten plik przy biezacych stawkach.
  const HISTORIA = require("../rules/scoringHistory");
  const { SECTIONS } = await import(MODUL);

  const znane = new Set(SECTIONS.flatMap((s) => s.rows.map((r) => r.path)));

  for (const regulamin of HISTORIA) {
    for (const zmiana of regulamin.changes) {
      assert.ok(
        znane.has(zmiana.path),
        `${regulamin.id}: sciezka "${zmiana.path}" nie ma odpowiednika w SECTIONS`,
      );
    }
  }
});

test("historia opisuje ZMIANY, a nie powtarza dzisiejszych stawek", async () => {
  // Wpis, ktory mowi to samo co dzisiejsza tabela, nie jest historia -
  // jest druga kopia biezacych stawek i to on rozjedzie sie jako pierwszy.
  //
  // Wyjatek: MAP.EXACT zostaje w liscie mimo tej samej wartosci, bo bez
  // niego sekcja mowilaby, ze mapy dawaly 0 pkt za wszystko. Dlatego test
  // wymaga, zeby CO NAJMNIEJ JEDNA pozycja regulaminu byla inna.
  const HISTORIA = require("../rules/scoringHistory");
  const { pointsAt } = await import(MODUL);

  for (const regulamin of HISTORIA) {
    const rozne = regulamin.changes.filter(
      (z) => z.was !== pointsAt(SCORING, z.path),
    );

    assert.ok(
      rozne.length > 0,
      `${regulamin.id}: zaden wiersz nie rozni sie od dzisiejszych stawek`,
    );
  }
});

test("kazdy regulamin mowi, ktorych turniejow dotyczy", async () => {
  // Bez tego sekcja brzmi "kiedys bylo inaczej" i nie da sie sprawdzic
  // wlasnego wyniku - a po to ona jest.
  const HISTORIA = require("../rules/scoringHistory");

  for (const regulamin of HISTORIA) {
    assert.ok(regulamin.id, "regulamin bez identyfikatora");
    assert.ok(regulamin.events?.length > 0, `${regulamin.id}: pusta lista turniejow`);

    for (const e of regulamin.events) {
      assert.ok(e.slug, `${regulamin.id}: turniej bez sluga`);
      assert.ok(e.name, `${regulamin.id}: turniej bez nazwy`);
    }
  }
});

test("buildScoringHistory sklada dawna stawke z dzisiejsza", async () => {
  const { buildScoringHistory } = await import(MODUL);

  const [regulamin] = buildScoringHistory(
    [
      {
        id: "x",
        events: [{ slug: "e", name: "E" }],
        changes: [{ path: "MATCH.WINNER", was: 4 }],
      },
    ],
    { MATCH: { WINNER: 2 } },
  );

  assert.equal(regulamin.changes[0].was, 4);
  assert.equal(regulamin.changes[0].now, 2);
  assert.equal(regulamin.changes[0].labelKey, "scoring.matchWinner.label");
});

test("zmiana bez odpowiednika w tabeli jest pomijana, a nie pokazywana bez nazwy", async () => {
  const { buildScoringHistory } = await import(MODUL);

  const wynik = buildScoringHistory(
    [{ id: "x", events: [{ slug: "e", name: "E" }], changes: [{ path: "NIE.MA", was: 9 }] }],
    SCORING,
  );

  assert.deepEqual(wynik, [], "regulamin bez czytelnych wierszy nie jest sekcja");
});

test("brak historii to pusta lista, a nie wywrotka", async () => {
  const { buildScoringHistory } = await import(MODUL);

  for (const wejscie of [[], null, undefined]) {
    assert.deepEqual(buildScoringHistory(wejscie, SCORING), []);
  }

  // Brak stawek biezacych tez nie moze wywrocic strony - "dzis" jest
  // wtedy nieznane, ale "wtedy" nadal ma sens.
  const [r] = buildScoringHistory(
    [{ id: "x", events: [{ slug: "e", name: "E" }], changes: [{ path: "MATCH.WINNER", was: 4 }] }],
    null,
  );

  assert.equal(r.changes[0].was, 4);
  assert.equal(r.changes[0].now, null);
});

test("druga stawka tej samej pozycji przechodzi razem z opisem", async () => {
  // W Cologne sam trafiony zwyciezca dawal co innego niz zwyciezca
  // z dokladnym wynikiem - jedna liczba nie opisuje tamtej reguly.
  const { buildScoringHistory } = await import(MODUL);

  const [r] = buildScoringHistory(
    [
      {
        id: "x",
        events: [{ slug: "e", name: "E" }],
        changes: [
          {
            path: "MATCH.WINNER",
            was: 4,
            alsoKey: "scoringHistory.cologne.seriesWinnerOnly",
            alsoValue: 1,
          },
        ],
      },
    ],
    SCORING,
  );

  assert.equal(r.changes[0].alsoValue, 1);
  assert.equal(r.changes[0].alsoKey, "scoringHistory.cologne.seriesWinnerOnly");
});

test("kazdy klucz napisu z historii istnieje w slowniku", async () => {
  // alsoKey trafia prosto do t(). Literowka pokazalaby graczowi goly klucz -
  // dokladnie to, co wyszlo przy chart.empty.
  const HISTORIA = require("../rules/scoringHistory");
  const { SLOWNIKI } = await import("../web/src/i18n/index.js");

  for (const regulamin of HISTORIA) {
    for (const zmiana of regulamin.changes) {
      if (!zmiana.alsoKey) continue;

      assert.ok(
        zmiana.alsoKey in SLOWNIKI.pl,
        `brak napisu "${zmiana.alsoKey}" w slowniku`,
      );
    }
  }
});

test("cena nieobecnosci bierze stawke z rules, a nie z wlasnej kopii", () => {
  // server/lib/absence.js mnozy trafienia tlumu przez stawke za zwyciezce
  // serii. Wpisanie jej tam na sztywno dawaloby DRUGIE miejsce, w ktorym
  // trzeba pamietac o zmianie regulaminu - a rozjazd stawek nie daje bledu
  // ani wpisu w logach, tylko ekran z inna liczba punktow niz ranking.
  const modul = fs.readFileSync(
    path.join(__dirname, "..", "server", "lib", "absence.js"),
    "utf8",
  );

  // Stawka wchodzi wylacznie parametrem.
  assert.ok(
    modul.includes("pointsPerWinner"),
    "absence.js nie przyjmuje juz stawki z zewnatrz",
  );

  // I nie ma w nim zadnej liczby mnozacej trafienia.
  const podejrzane = modul.match(/tlumTrafil\s*\*\s*\d/);

  assert.equal(
    podejrzane,
    null,
    `absence.js mnozy przez liczbe wpisana wprost: ${podejrzane && podejrzane[0]}`,
  );

  const trasa = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "playerProfile.js"),
    "utf8",
  );

  assert.ok(
    trasa.includes("scoring?.MATCH?.WINNER"),
    "trasa profilu nie podaje juz stawki z rules/scoring.js",
  );
});
