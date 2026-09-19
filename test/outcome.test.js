// Wynik turnieju (server/lib/outcome.js).
//
// Zmierzone na produkcji, trzy turnieje i trzy rozne historie:
//
//   IEM Cologne Major 2026    mistrz Falcons     4 z  99  ( 4%)
//   StarLadder Budapest 2025  mistrz Vitality   22 z 218  (10%)
//   IEM Kraków 2026           mistrz Vitality   39 z  49  (80%)
//
// Dwie rzeczy te testy pilnuja najmocniej: myslnika w miejscu trzeciego
// miejsca (kazdy turniej zapisuje jego brak inaczej) i sklejania roznych
// zapisow tej samej nazwy przy liczeniu faworyta.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/outcome.js";

/** Wiersz playoffs_results. */
function wynik({
  correct_semifinalists = "FURIA, Aurora, Falcons, Spirit",
  correct_finalists = "FURIA, Falcons",
  correct_winner = "Falcons",
  correct_third_place_winner = null,
} = {}) {
  return {
    correct_semifinalists,
    correct_finalists,
    correct_winner,
    correct_third_place_winner,
  };
}

/** N identycznych typow. */
function typy(ile, typ) {
  return Array.from({ length: ile }, () => ({ ...typ }));
}

// --- drabinka ----------------------------------------------------------------

test("mistrz, przegrany finalista i przegrani polfinalisci", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), []);

  assert.equal(o.settled, true);
  assert.equal(o.winner.name, "Falcons");

  // Finalista, ktory nie jest mistrzem - zeby strona nie musiala liczyc
  // roznicy zbiorow.
  assert.equal(o.runner_up.name, "FURIA");

  // Polfinalisci BEZ tych, ktorzy weszli do finalu: ci dwaj inaczej nie
  // padliby nigdzie.
  assert.deepEqual(
    o.lost_semis.map((d) => d.name),
    ["Aurora", "Spirit"],
  );
});

test("brak wyniku to turniej nierozstrzygniety, a nie blad", async () => {
  const { buildOutcome } = await import(MODUL);

  for (const brak of [null, undefined, wynik({ correct_winner: null })]) {
    const o = buildOutcome(brak, typy(5, { winner: "Falcons" }));

    assert.equal(o.settled, false, JSON.stringify(brak));
    assert.equal(o.winner, null);
    assert.equal(o.total, 0);
  }
});

// --- trzecie miejsce ---------------------------------------------------------

test("myslnik w miejscu trzeciego miejsca znaczy BRAK, nie nazwe druzyny", async () => {
  // Trzy turnieje zapisuja to samo na trzy sposoby: Cologne "—",
  // Budapeszt NULL, Krakow prawdziwa nazwe. Bez tego filtra myslnik
  // trafialby na strone jako druzyna, z litera "—" w kolku herbu.
  const { buildOutcome } = await import(MODUL);

  for (const puste of ["—", "-", "–", "  ", "", null, undefined]) {
    const o = buildOutcome(wynik({ correct_third_place_winner: puste }), []);

    assert.equal(o.third_place, null, `dla ${JSON.stringify(puste)}`);
  }

  const zNazwa = buildOutcome(
    wynik({ correct_third_place_winner: "Spirit" }),
    [],
  );

  assert.equal(zNazwa.third_place.name, "Spirit");
});

test("zdobywca trzeciego miejsca nie dubluje sie na liscie polfinalistow", async () => {
  // Na IEM Krakow 2026 Spirit jest trzeci I przegral polfinal. Bez tego
  // wykluczenia sekcja czytala sie "trzecie miejsce: Spirit" tuz nad
  // "polfinalisci: Spirit, MOUZ".
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(
    wynik({
      correct_semifinalists: "FURIA, Spirit, Vitality, MOUZ",
      correct_finalists: "FURIA, Vitality",
      correct_winner: "Vitality",
      correct_third_place_winner: "Spirit",
    }),
    [],
  );

  assert.equal(o.third_place.name, "Spirit");

  assert.deepEqual(
    o.lost_semis.map((d) => d.name),
    ["MOUZ"],
    "zostaje sam czwarty",
  );
});

test("myslnik nie wchodzi tez na liste polfinalistow", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(
    wynik({ correct_semifinalists: "FURIA, —, Falcons, Spirit" }),
    [],
  );

  assert.deepEqual(
    o.lost_semis.map((d) => d.name),
    ["Spirit"],
  );
});

// --- trafnosc ----------------------------------------------------------------

test("liczy trafionego mistrza, obu finalistow i komplet polfinalistow", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [
    // Trafil wszystko.
    {
      winner: "Falcons",
      finalists: "Falcons, FURIA",
      semifinalists: "FURIA, Aurora, Falcons, Spirit",
    },

    // Trafil finalistow, ale postawil na drugiego z nich.
    { winner: "FURIA", finalists: "FURIA, Falcons", semifinalists: "" },

    // Nie trafil niczego.
    { winner: "Spirit", finalists: "Spirit, Aurora", semifinalists: "Spirit" },
  ]);

  assert.equal(o.total, 3);
  assert.equal(o.called.winner, 1);
  assert.equal(o.called.finalists, 2, "kolejnosc w liscie nie ma znaczenia");
  assert.equal(o.called.semifinalists, 1);
});

test("komplet polfinalistow wymaga WSZYSTKICH czterech", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [
    { semifinalists: "FURIA, Aurora, Falcons" },
    { semifinalists: "FURIA, Aurora, Falcons, Spirit" },
    { semifinalists: "FURIA, Aurora, Falcons, Spirit, MOUZ" },
  ]);

  // Trzech to za malo; piatka zawiera komplet, wiec sie liczy.
  assert.equal(o.called.semifinalists, 2);
});

test("procenty licza sie z typujacych playoffy", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [
    ...typy(4, { winner: "Falcons" }),
    ...typy(96, { winner: "Spirit" }),
  ]);

  assert.equal(o.total, 100);
  assert.equal(o.called.winner, 4);
  assert.equal(o.called_percent.winner, 4);
});

test("pusta stawka nie dzieli przez zero", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), []);

  assert.equal(o.total, 0);
  assert.equal(o.called_percent.winner, 0);
  assert.equal(o.favourite, null);
});

// --- faworyt -----------------------------------------------------------------

test("faworyt to najczesciej typowany mistrz", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [
    ...typy(42, { winner: "Spirit" }),
    ...typy(33, { winner: "Vitality" }),
    ...typy(4, { winner: "Falcons" }),
  ]);

  assert.equal(o.favourite.name, "Spirit");
  assert.equal(o.favourite.count, 42);
  assert.equal(o.favourite.percent, 53, "42 z 79");

  // Tlum postawil na kogos innego niz zwyciezca - i to jest zdanie,
  // dla ktorego ta sekcja istnieje.
  assert.equal(o.favourite.was_right, false);
});

test("faworyt sklada sie z roznych zapisow tej samej nazwy", async () => {
  // Na produkcji Budapeszt ma "Furia", a Cologne "FURIA". Liczone osobno
  // dalyby dwoch mniejszych faworytow zamiast jednego prawdziwego.
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik({ correct_winner: "Falcons" }), [
    ...typy(30, { winner: "Furia" }),
    ...typy(27, { winner: "FURIA" }),
    ...typy(20, { winner: "Falcons" }),
  ]);

  assert.equal(o.favourite.count, 57, "30 + 27 to ta sama druzyna");

  // Pokazywany jest zapis WIEKSZOSCI. "Furia" i "FURIA" maja tyle samo
  // znakow, wiec regula "najdluzszy wygrywa" nie rozstrzygalaby ich wcale
  // i zostawalby ten, ktory baza zwrocila pierwszy.
  assert.equal(o.favourite.name, "Furia", "30 wobec 27");
});

test("zapis wiekszosci nie zalezy od kolejnosci wierszy", async () => {
  const { buildOutcome } = await import(MODUL);

  const rows = [
    ...typy(30, { winner: "Furia" }),
    ...typy(27, { winner: "FURIA" }),
  ];

  const pierwszy = buildOutcome(wynik(), rows);
  const drugi = buildOutcome(wynik(), [...rows].reverse());

  assert.equal(pierwszy.favourite.name, drugi.favourite.name);
  assert.equal(pierwszy.favourite.count, drugi.favourite.count);
});

test("faworyt, ktory faktycznie wygral, jest oznaczony jako trafiony", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik({ correct_winner: "Vitality" }), [
    ...typy(39, { winner: "Vitality" }),
    ...typy(10, { winner: "FURIA" }),
  ]);

  assert.equal(o.favourite.name, "Vitality");
  assert.equal(o.favourite.was_right, true);
  assert.equal(o.called_percent.winner, 80, "39 z 49");
});

test("typ bez wskazanego mistrza nie tworzy faworyta z pustki", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [
    { winner: null },
    { winner: "" },
    { winner: "—" },
    { winner: "Falcons" },
  ]);

  assert.equal(o.favourite.name, "Falcons");
  assert.equal(o.favourite.count, 1);

  // Mianownik to WSZYSCY typujacy playoffy, takze ci bez wskazania.
  assert.equal(o.total, 4);
  assert.equal(o.favourite.percent, 25);
});

test("przy remisie faworyta rozstrzyga nazwa, zeby kolejnosc byla powtarzalna", async () => {
  const { buildOutcome } = await import(MODUL);

  const rows = [...typy(5, { winner: "Zeta" }), ...typy(5, { winner: "Alfa" })];

  const pierwszy = buildOutcome(wynik(), rows);
  const drugi = buildOutcome(wynik(), [...rows].reverse());

  assert.equal(pierwszy.favourite.name, "Alfa");
  assert.equal(drugi.favourite.name, "Alfa");
});

// --- logotypy ----------------------------------------------------------------

test("logotyp wiaze sie przez klucz druzyny, nie przez sam zapis nazwy", async () => {
  const { buildOutcome } = await import(MODUL);
  const { teamKey } = await import("../server/lib/teamLogos.js");

  const o = buildOutcome(wynik({ correct_winner: "FaZe Clan" }), [], {
    logos: [{ name_key: teamKey("Faze Clan"), logo_url: "https://x/faze.png" }],
  });

  assert.equal(o.winner.logo, "https://x/faze.png");
});

test("brak logotypu to null, a nie puste miejsce w odpowiedzi", async () => {
  const { buildOutcome } = await import(MODUL);

  const o = buildOutcome(wynik(), [], { logos: [] });

  assert.equal(o.winner.logo, null);
});

// --- skrot dla listy turniejow ----------------------------------------------

test("skrot dla listy liczy kazdy turniej osobno", async () => {
  const { buildOutcomeByEvent } = await import(MODUL);

  const skroty = buildOutcomeByEvent(
    [
      { event_id: 37, ...wynik({ correct_winner: "Falcons" }) },
      { event_id: 88, ...wynik({ correct_winner: "Vitality" }) },
    ],
    [
      // Cologne: 1 z 4 trafil.
      { event_id: 37, winner: "Falcons" },
      ...typy(3, { winner: "Spirit" }).map((t) => ({ ...t, event_id: 37 })),

      // Krakow: 4 z 5 trafilo.
      ...typy(4, { winner: "Vitality" }).map((t) => ({ ...t, event_id: 88 })),
      { event_id: 88, winner: "FURIA" },
    ],
  );

  assert.equal(skroty.get(37).winner.name, "Falcons");
  assert.equal(skroty.get(37).called_percent, 25);
  assert.equal(skroty.get(37).total, 4);

  assert.equal(skroty.get(88).winner.name, "Vitality");
  assert.equal(skroty.get(88).called_percent, 80);
});

test("turniej bez rozstrzygniecia nie trafia do skrotow", async () => {
  // Kafelek pokazuje wtedy to, co dotad - bez pustego miejsca po mistrzu.
  const { buildOutcomeByEvent } = await import(MODUL);

  const skroty = buildOutcomeByEvent(
    [{ event_id: 1, ...wynik({ correct_winner: null }) }],
    [{ event_id: 1, winner: "Falcons" }],
  );

  assert.equal(skroty.has(1), false);
  assert.equal(skroty.size, 0);
});

test("skrot niesie sam wynik, bez calej drabinki", async () => {
  // Na liscie nie ma gdzie pokazac polfinalistow, a przesylanie ich byloby
  // ladowaniem danych na zapas.
  const { buildOutcomeByEvent } = await import(MODUL);

  const skroty = buildOutcomeByEvent(
    [{ event_id: 5, ...wynik() }],
    [{ event_id: 5, winner: "Falcons" }],
  );

  assert.deepEqual(
    Object.keys(skroty.get(5)).sort(),
    ["called_percent", "total", "winner"],
  );
});

test("brak wierszy nie wywraca skrotow", async () => {
  const { buildOutcomeByEvent } = await import(MODUL);

  assert.equal(buildOutcomeByEvent([], []).size, 0);
  assert.equal(buildOutcomeByEvent(null, null).size, 0);
});
