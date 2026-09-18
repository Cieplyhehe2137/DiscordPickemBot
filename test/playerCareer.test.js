// Gracz ponad turniejami (server/lib/playerCareer.js).
//
// Najwazniejsze w tych testach nie jest to, CO modul liczy, tylko to, ze NIE
// LICZY NICZEGO OD NOWA. Podsumowanie startow ma byc dokladnie tym samym,
// co pokazuje klasyfikacja wszech czasow, a lista startow tym samym, co
// profil w turnieju. Dwie formuly znaczylyby dwie prawdy o tym samym starcie:
// raz w tabeli, raz u gracza.
//
// Drugi watek to prog przy druzynach. Zmierzone na produkcji: mediana gracza
// ma 16 typow na mecze, a par gracz-druzyna z trzema typami jest 1377 na 638
// graczy. Bez progu sekcja "na kogo stawiasz" bylaby lista jednorazowych
// przypadkow.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/playerCareer.js";

// Jeden start gracza w klasyfikacji. Stawka 100 osob, zeby miejsce czytalo
// sie wprost jako procent.
function start({
  event_id = 1,
  rank = 50,
  uczestnicy = 100,
  points = 0,
  name = "Turniej",
  slug = "turniej",
  is_archived = 0,
} = {}) {
  return {
    user_id: "gracz",
    event_id,
    name,
    slug,
    is_archived,
    rank_position: rank,
    uczestnicy,
    total_points: points,
  };
}

// --- podsumowanie -----------------------------------------------------------

test("podsumowanie to TA SAMA liczba, ktora pokazuje klasyfikacja wszech czasow", async () => {
  // Gdyby ta strona liczyla percentyl po swojemu, gracz widzialby "TOP 3.5%"
  // w tabeli i cos innego u siebie - a obie liczby opisywalyby te same dwa
  // starty.
  const { buildCareer } = await import(MODUL);
  const { buildAllTime } = await import("../server/lib/allTime.js");

  const wiersze = [
    start({ event_id: 1, rank: 5, uczestnicy: 523, points: 328 }),
    start({ event_id: 2, rank: 30, uczestnicy: 509, points: 100 }),
  ];

  const { summary } = buildCareer(wiersze);

  const [wTabeli] = buildAllTime(wiersze, { minStarts: 1 });

  assert.equal(summary.avg_top_percent, wTabeli.avg_top_percent);
  assert.equal(summary.starts, wTabeli.starts);
  assert.equal(summary.total_points, wTabeli.total_points);
  assert.deepEqual(summary.best, wTabeli.best);
});

test("jeden start tez daje podsumowanie", async () => {
  // Prog dwoch startow jest regula TABELI, nie wlasnoscia gracza: w tabeli
  // chodzi o porownywanie ludzi ze soba, a na wlasnej stronie nie ma z kim.
  // Zmierzone na produkcji: 946 z 1110 graczy zagralo dokladnie raz.
  const { buildCareer } = await import(MODUL);

  const { summary } = buildCareer([
    start({ rank: 10, uczestnicy: 200, points: 50 }),
  ]);

  assert.equal(summary.starts, 1);
  assert.equal(summary.avg_top_percent, 5);
});

test("brak startow daje puste podsumowanie, a nie wyjatek", async () => {
  // Zdarza sie: ktos typowal mecze, ale turniej nie doczekal sie jeszcze
  // klasyfikacji.
  const { buildCareer } = await import(MODUL);

  const { summary, starts } = buildCareer([]);

  assert.equal(summary, null);
  assert.deepEqual(starts, []);
});

test("lista startow obejmuje WSZYSTKIE turnieje", async () => {
  // Na profilu w turnieju jeden start wypada z listy - ten, ktory gracz
  // wlasnie oglada. Tutaj nie ma takiego startu, bo ta strona nie jest
  // w srodku zadnego turnieju.
  const { buildCareer } = await import(MODUL);

  const { starts } = buildCareer([
    start({ event_id: 1, slug: "pierwszy" }),
    start({ event_id: 2, slug: "drugi" }),
    start({ event_id: 3, slug: "trzeci" }),
  ]);

  assert.deepEqual(
    starts.map((s) => s.slug),
    ["pierwszy", "drugi", "trzeci"],
  );
});

test("lista startow niesie to samo, co historia na profilu w turnieju", async () => {
  const { buildCareer } = await import(MODUL);
  const { buildPlayerHistory } = await import("../server/lib/playerHistory.js");

  const wiersze = [start({ event_id: 1, rank: 5, uczestnicy: 523 })];

  const { starts } = buildCareer(wiersze);

  assert.deepEqual(starts, buildPlayerHistory(wiersze, null));
});

// --- na kogo stawia ---------------------------------------------------------

// Jeden typ gracza. Domyslnie stawia na A i A wygrywa.
function typ({
  team_a = "A",
  team_b = "B",
  na = "a",
  res_a = 2,
  res_b = 0,
} = {}) {
  return {
    team_a,
    team_b,
    pred_a: na === "a" ? 2 : 0,
    pred_b: na === "a" ? 0 : 2,
    res_a,
    res_b,
  };
}

test("liczy sie druzyna, ktora gracz WSKAZAL, a nie ta, ktora wygrala", async () => {
  const { buildTeamBias } = await import(MODUL);

  // Trzy razy postawil na B, B przegralo za kazdym razem.
  const lista = buildTeamBias([typ({ na: "b" }), typ({ na: "b" }), typ({ na: "b" })], []);

  assert.equal(lista.length, 1);
  assert.equal(lista[0].team, "B");
  assert.equal(lista[0].picks, 3);
  assert.equal(lista[0].wins, 0);
  assert.equal(lista[0].win_rate, 0);
});

test("druzyna typowana raz czy dwa razy nie trafia do zestawienia", async () => {
  // "Wygrali 0%" przy jednym typie nie mowi, komu gracz ufa - mowi tylko,
  // ze raz zagral.
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [
      typ({ team_a: "Raz" }),
      typ({ team_a: "Dwa" }),
      typ({ team_a: "Dwa" }),
      typ({ team_a: "Trzy" }),
      typ({ team_a: "Trzy" }),
      typ({ team_a: "Trzy" }),
    ],
    [],
    { minPicks: 3 },
  );

  assert.deepEqual(
    lista.map((d) => d.team),
    ["Trzy"],
  );
});

test("wyzej stoi druzyna typowana CZESCIEJ, a nie skuteczniejsza", async () => {
  // Pytanie brzmi "komu ufasz", a skutecznosc jest dopiero odpowiedzia na to,
  // czy slusznie.
  const { buildTeamBias } = await import(MODUL);

  const typy = [];

  // Ulubiona: piec typow, dwie wygrane.
  for (let i = 0; i < 2; i += 1) typy.push(typ({ team_a: "Ulubiona" }));
  for (let i = 0; i < 3; i += 1)
    typy.push(typ({ team_a: "Ulubiona", res_a: 0, res_b: 2 }));

  // Pewniak: trzy typy, trzy wygrane.
  for (let i = 0; i < 3; i += 1) typy.push(typ({ team_a: "Pewniak" }));

  const lista = buildTeamBias(typy, []);

  assert.deepEqual(
    lista.map((d) => `${d.team} ${d.picks} ${d.win_rate}%`),
    ["Ulubiona 5 40%", "Pewniak 3 100%"],
  );
});

test("mecz bez wyniku nie liczy sie jako przegrana", async () => {
  // Number(null) to zero, wiec bez sprawdzenia na null nierozegrany mecz
  // wygladalby na remis 0:0 i psul kazdy procent na tej liscie.
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [
      typ(),
      typ(),
      typ(),
      typ({ res_a: null, res_b: null }),
      typ({ res_a: 2, res_b: null }),
    ],
    [],
    { minPicks: 3 },
  );

  assert.equal(lista[0].picks, 3, "dwa mecze bez wyniku maja wypasc");
  assert.equal(lista[0].wins, 3);
});

test("remis nie jest ani wygrana, ani typem na kogokolwiek", async () => {
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [typ(), typ(), typ(), typ({ res_a: 1, res_b: 1 })],
    [],
    { minPicks: 3 },
  );

  assert.equal(lista[0].picks, 3);
});

test("typ bez wskazania nikogo nie liczy sie do zadnej druzyny", async () => {
  const { buildTeamBias } = await import(MODUL);

  const rowny = { team_a: "A", team_b: "B", pred_a: 1, pred_b: 1, res_a: 2, res_b: 0 };

  const lista = buildTeamBias([typ(), typ(), typ(), rowny], [], { minPicks: 3 });

  assert.equal(lista.length, 1);
  assert.equal(lista[0].picks, 3);
});

test("ta sama druzyna po obu stronach meczu to jeden wpis", async () => {
  // Druzyna raz stoi jako team_a, raz jako team_b - to ta sama druzyna
  // i ma sie zsumowac, a nie rozpasc na dwa wiersze.
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [
      typ({ team_a: "Nasza", team_b: "Obca", na: "a" }),
      typ({ team_a: "Obca", team_b: "Nasza", na: "b", res_a: 0, res_b: 2 }),
      typ({ team_a: "Nasza", team_b: "Inna", na: "a" }),
    ],
    [],
    { minPicks: 3 },
  );

  assert.equal(lista.length, 1);
  assert.equal(lista[0].team, "Nasza");
  assert.equal(lista[0].picks, 3);
  assert.equal(lista[0].wins, 3);
});

test("dwa zapisy tej samej organizacji to jeden wpis", async () => {
  // "FUT" i "FUT Esports" to ta sama druzyna, a nazwa jest w tej bazie
  // zwyklym tekstem. Przy grupowaniu po napisie typy jednego gracza
  // rozpadlyby sie na dwa wiersze, z ktorych zaden nie przekroczylby progu -
  // i sekcja bylaby pusta mimo trzech typow. Sklejenie robi teamKey, to samo,
  // na ktorym stoi strona druzyny.
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [
      typ({ team_a: "FUT" }),
      typ({ team_a: "FUT Esports" }),
      typ({ team_a: "FUT" }),
    ],
    [],
    { minPicks: 3 },
  );

  assert.equal(lista.length, 1);
  assert.equal(lista[0].picks, 3);

  // Dluzszy zapis zostaje nazwa wyswietlana - ten sam wybor, co w teamStats.
  assert.equal(lista[0].team, "FUT Esports");
});

test("logotyp dochodzi po tym samym kluczu, co na stronie druzyny", async () => {
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [typ({ team_a: "FaZe" }), typ({ team_a: "FaZe" }), typ({ team_a: "FaZe" })],
    [{ name_key: "faze", logo_url: "https://x/f.png" }],
    { minPicks: 3 },
  );

  assert.equal(lista[0].logo, "https://x/f.png");
});

test("brak logotypu daje null, a nie pusty napis", async () => {
  const { buildTeamBias } = await import(MODUL);

  const lista = buildTeamBias(
    [typ({ team_a: "Nikomu" }), typ({ team_a: "Nikomu" }), typ({ team_a: "Nikomu" })],
    [],
    { minPicks: 3 },
  );

  assert.equal(lista[0].logo, null);
});

test("brak typow daje pusta liste, a nie wyjatek", async () => {
  const { buildTeamBias } = await import(MODUL);

  assert.deepEqual(buildTeamBias([], []), []);
  assert.deepEqual(buildTeamBias(null, null), []);
});
