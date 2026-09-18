// Niespodzianki (server/lib/upsets.js).
//
// Caly ciezar tych funkcji jest w REGULE, nie w pobraniu danych, wiec testy
// pilnuja reguly. Kazdy odpowiada na pytanie, ktore realnie padnie przy tym
// zestawieniu: czemu ten mecz jest wyzej, czemu tego gracza nie ma na
// liscie, czemu ta druzyna uchodzi za przeceniana.
//
// Najwazniejsze jest to, ze ranking "wbrew wszystkim" stoi na SKUTECZNOSCI,
// a nie na liczbie trafien. Zmierzone na produkcji: 431 graczy, od 1 do 33
// okazji, srednio 5.5. Liczba trafien nagradzalaby frekwencje.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/upsets.js";

// Jeden mecz z wynikiem i podzialem glosow. Domyslnie sto typow, zeby
// for_a czytalo sie wprost jako procent.
function mecz({
  id = 1,
  team_a = "A",
  team_b = "B",
  res_a = 2,
  res_b = 0,
  for_a = 50,
  for_b = 50,
  total = 100,
  phase = "PLAYOFFS",
  event_name = "Turniej",
  event_slug = "turniej",
} = {}) {
  return {
    id,
    event_id: 1,
    phase,
    team_a,
    team_b,
    res_a,
    res_b,
    for_a,
    for_b,
    total,
    event_name,
    event_slug,
  };
}

// --- ktore mecze sa niespodziankami -----------------------------------------

test("mecz, w ktorym wiekszosc miala racje, nie jest niespodzianka", async () => {
  const { buildUpsets } = await import(MODUL);

  // Wygrywa A, na A stawialo 80 ze 100.
  const lista = buildUpsets([mecz({ for_a: 80, for_b: 20 })]);

  assert.equal(lista.length, 0);
});

test("mecz, w ktorym prawie nikt nie trafil, jest niespodzianka", async () => {
  const { buildUpsets } = await import(MODUL);

  // Wygrywa B, na B stawialo 10 ze 100.
  const lista = buildUpsets([mecz({ for_a: 90, for_b: 10, res_a: 0, res_b: 2 })]);

  assert.equal(lista.length, 1);
  assert.equal(lista[0].winner, "B");
  assert.equal(lista[0].loser, "A");
  assert.equal(lista[0].winner_share, 10);
});

test("granica progu nalezy do meczow ZWYCZAJNYCH", async () => {
  // Dokladnie 25% to jeszcze nie pomylka ogolu. Inaczej prog nie mialby
  // jednoznacznego znaczenia i "ponizej cwiartki" w opisie strony byloby
  // nieprawda.
  const { buildUpsets } = await import(MODUL);

  const rowno = buildUpsets([
    mecz({ for_a: 75, for_b: 25, res_a: 0, res_b: 2 }),
  ]);

  assert.equal(rowno.length, 0, "25% to nie niespodzianka");

  const ponizej = buildUpsets([
    mecz({ for_a: 76, for_b: 24, res_a: 0, res_b: 2 }),
  ]);

  assert.equal(ponizej.length, 1, "24% juz tak");
});

test("prog liczy sie z dokladnej wartosci, a nie z zaokraglonej", async () => {
  // 24.6% zaokragla sie do 25, ale niespodzianka juz jest. Gdyby prog
  // porownywal liczbe zaokraglona, mecz zniknalby przez sposob wyswietlania.
  const { buildUpsets } = await import(MODUL);

  // 123 typy, 30 na zwyciezce: 24.39%.
  const lista = buildUpsets([
    mecz({ for_a: 93, for_b: 30, total: 123, res_a: 0, res_b: 2 }),
  ]);

  assert.equal(lista.length, 1);
  assert.equal(lista[0].winner_share, 24);
});

test("mecz z garstka typow nie liczy sie wcale", async () => {
  // Trzy osoby to nie jest spolecznosc, a "0% trafilo" wsrod trzech nie
  // znaczy nic.
  const { buildUpsets } = await import(MODUL);

  const lista = buildUpsets([
    mecz({ for_a: 3, for_b: 0, total: 3, res_a: 0, res_b: 2 }),
  ]);

  assert.equal(lista.length, 0);
});

test("mecz bez wyniku nie jest niespodzianka", async () => {
  // Number(null) to zero, wiec bez sprawdzenia na null nierozegrany mecz
  // wygladalby na remis 0:0 i wpadl tu jako "nikt nie trafil".
  const { buildUpsets } = await import(MODUL);

  const brak = buildUpsets([mecz({ res_a: null, res_b: null })]);

  assert.equal(brak.length, 0);

  const polowa = buildUpsets([mecz({ res_a: 2, res_b: null })]);

  assert.equal(polowa.length, 0);
});

test("remis nie jest niespodzianka, tylko meczem bez zwyciezcy", async () => {
  // W bazie nie ma dzis ani jednego, ale BO2 remis dopuszcza - a mecz bez
  // zwyciezcy wpadlby tu jako najwieksza niespodzianka w historii serwisu.
  const { buildUpsets } = await import(MODUL);

  const lista = buildUpsets([mecz({ res_a: 1, res_b: 1 })]);

  assert.equal(lista.length, 0);
});

// --- kolejnosc --------------------------------------------------------------

test("mniej trafien znaczy wyzej", async () => {
  const { buildUpsets } = await import(MODUL);

  const lista = buildUpsets([
    mecz({ id: 1, for_a: 80, for_b: 20, res_a: 0, res_b: 2 }),
    mecz({ id: 2, for_a: 95, for_b: 5, res_a: 0, res_b: 2 }),
    mecz({ id: 3, for_a: 90, for_b: 10, res_a: 0, res_b: 2 }),
  ]);

  assert.deepEqual(
    lista.map((m) => m.match_id),
    [2, 3, 1],
  );

  assert.deepEqual(
    lista.map((m) => m.rank),
    [1, 2, 3],
  );
});

test("przy tym samym procencie wyzej jest mecz, w ktorym pomylilo sie WIECEJ ludzi", async () => {
  // Zero trafien wsrod stu czterdziestu dziewieciu wazy wiecej niz zero
  // wsrod dwudziestu - to ta sama pomylka, ale calej spolecznosci.
  const { buildUpsets } = await import(MODUL);

  const lista = buildUpsets([
    mecz({ id: 1, for_a: 20, for_b: 0, total: 20, res_a: 0, res_b: 2 }),
    mecz({ id: 2, for_a: 149, for_b: 0, total: 149, res_a: 0, res_b: 2 }),
  ]);

  assert.deepEqual(
    lista.map((m) => m.match_id),
    [2, 1],
  );
});

// --- tlo --------------------------------------------------------------------

test("tlo to skutecznosc calej spolecznosci w tych meczach", async () => {
  // Bez tej liczby "trafil 42%" brzmi przecietnie, a jest trzykrotnoscia
  // tego, co osiagnal ogol.
  const { buildUpsets, crowdRate } = await import(MODUL);

  const lista = buildUpsets([
    mecz({ id: 1, for_a: 90, for_b: 10, res_a: 0, res_b: 2 }),
    mecz({ id: 2, for_a: 80, for_b: 20, res_a: 0, res_b: 2 }),
  ]);

  // 30 trafien na 200 typow.
  assert.equal(crowdRate(lista), 15);
});

test("brak niespodzianek daje null, a nie zero", async () => {
  // Zero znaczy "nikt nigdy nie trafil", a to co innego niz "nie bylo
  // jeszcze zadnego takiego meczu".
  const { crowdRate } = await import(MODUL);

  assert.equal(crowdRate([]), null);
});

// --- kto trafia wbrew wszystkim ---------------------------------------------

function typ(user_id, match_id, strona) {
  return {
    user_id,
    match_id,
    pred_a: strona === "a" ? 2 : 0,
    pred_b: strona === "a" ? 0 : 2,
  };
}

// Cztery niespodzianki, w kazdej wygrywa B.
function niespodzianki() {
  return [1, 2, 3, 4].map((id) =>
    mecz({ id, for_a: 90, for_b: 10, res_a: 0, res_b: 2 }),
  );
}

test("LICZBA TRAFIEN nie decyduje o kolejnosci", async () => {
  // To jest cala istota tego zestawienia. Zmierzone na produkcji: okazji
  // jest od 1 do 33, wiec ktos z trzydziestoma trzema zbierze wiecej
  // trafien od kogos z dwunastoma, nie bedac od niego lepszym.
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets(niespodzianki());

  const typy = [
    // Wytrwaly: cztery okazje, dwa trafienia - 50%.
    typ("wytrwaly", 1, "b"),
    typ("wytrwaly", 2, "b"),
    typ("wytrwaly", 3, "a"),
    typ("wytrwaly", 4, "a"),

    // Celny: dwie okazje, dwa trafienia - 100%.
    typ("celny", 1, "b"),
    typ("celny", 2, "b"),
  ];

  const lista = buildContrarians(typy, upsets, [], { minChances: 2 });

  assert.deepEqual(
    lista.map((g) => g.user_id),
    ["celny", "wytrwaly"],
    "wyzej ma byc skuteczniejszy, mimo mniejszej liczby trafien",
  );

  assert.equal(lista[0].hit_rate, 100);
  assert.equal(lista[0].hits, 2);
  assert.equal(lista[1].hit_rate, 50);
  assert.equal(lista[1].hits, 2);
});

test("przy rownej skutecznosci wyzej jest ten z wieksza liczba trafien", async () => {
  // Wieksza liczba trafien przy tym samym procencie to po prostu wiecej
  // dowodow na to samo.
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets(niespodzianki());

  const typy = [
    typ("czworo", 1, "b"),
    typ("czworo", 2, "b"),
    typ("czworo", 3, "a"),
    typ("czworo", 4, "a"),

    typ("dwoje", 1, "b"),
    typ("dwoje", 2, "a"),
  ];

  const lista = buildContrarians(typy, upsets, [], { minChances: 2 });

  assert.deepEqual(
    lista.map((g) => g.user_id),
    ["czworo", "dwoje"],
  );
});

test("typy na zwyczajne mecze nie licza sie do okazji", async () => {
  // Inaczej skutecznosc rozpuszczalaby sie w meczach, w ktorych nie trzeba
  // bylo isc pod prad.
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets([
    mecz({ id: 1, for_a: 90, for_b: 10, res_a: 0, res_b: 2 }),
    mecz({ id: 2, for_a: 80, for_b: 20 }),
  ]);

  assert.equal(upsets.length, 1, "drugi mecz wygral faworyt");

  const lista = buildContrarians(
    [typ("kto", 1, "b"), typ("kto", 2, "a")],
    upsets,
    [],
    { minChances: 1 },
  );

  assert.equal(lista[0].chances, 1);
  assert.equal(lista[0].hits, 1);
});

test("za malo okazji znaczy brak miejsca w zestawieniu", async () => {
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets(niespodzianki());

  const lista = buildContrarians([typ("jeden", 1, "b")], upsets, [], {
    minChances: 12,
  });

  assert.equal(lista.length, 0);
});

test("nazwa gracza dochodzi z profilu, a brak profilu nie wywala wiersza", async () => {
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets(niespodzianki());

  const typy = [typ("znany", 1, "b"), typ("nieznany", 1, "b")];

  const lista = buildContrarians(
    typy,
    upsets,
    [{ user_id: "znany", displayname: "Znany", avatar: "abc" }],
    { minChances: 1 },
  );

  const poId = new Map(lista.map((g) => [g.user_id, g]));

  assert.equal(poId.get("znany").displayname, "Znany");
  assert.equal(poId.get("znany").avatar, "abc");
  assert.equal(poId.get("nieznany").displayname, null);
});

test("pierwsze zrodlo nazwy wygrywa z kolejnym", async () => {
  // Nazwy przychodza z dwoch miejsc: z profili (tylko ci, ktorzy zalogowali
  // sie na stronie - za to z awatarem) i z tabel faz, gdzie bot zapisuje nick
  // przy oddawaniu typu. Zmierzone na produkcji: z 638 typujacych 212 nie ma
  // profilu wcale, a trzej pierwsi w tym zestawieniu byli wlasnie tacy -
  // czolo tabeli stanowily trzy dziewietnastocyfrowe liczby.
  //
  // Zapis z fazy pamieta nick z dnia typowania, wiec NIE moze nadpisywac
  // profilu, ktory odswieza sie przy kazdym logowaniu.
  const { buildContrarians, buildUpsets } = await import(MODUL);

  const upsets = buildUpsets(niespodzianki());

  const typy = [typ("zProfilem", 1, "b"), typ("tylkoDiscord", 1, "b")];

  const lista = buildContrarians(
    typy,
    upsets,
    [
      // Najpierw profile...
      { user_id: "zProfilem", displayname: "Nick dzisiejszy", avatar: "abc" },
      // ...potem nazwy z faz.
      { user_id: "zProfilem", displayname: "Nick sprzed roku" },
      { user_id: "tylkoDiscord", displayname: "Tylko Discord" },
    ],
    { minChances: 1 },
  );

  const poId = new Map(lista.map((g) => [g.user_id, g]));

  assert.equal(poId.get("zProfilem").displayname, "Nick dzisiejszy");
  assert.equal(poId.get("zProfilem").avatar, "abc");

  // Gracz bez profilu dostaje nazwe z fazy i pusty awatar - zamiast
  // dziewietnastocyfrowego identyfikatora na podium.
  assert.equal(poId.get("tylkoDiscord").displayname, "Tylko Discord");
  assert.equal(poId.get("tylkoDiscord").avatar, null);
});

// --- druzyny przeceniane ----------------------------------------------------

function druzyna({
  key = "a",
  name = "A",
  settled = 10,
  trust = 50,
  win_rate = 50,
} = {}) {
  return {
    key,
    name,
    logo: null,
    matches: settled,
    settled,
    wins: Math.round((settled * win_rate) / 100),
    losses: settled - Math.round((settled * win_rate) / 100),
    trust,
    trust_hit: null,
    win_rate,
  };
}

test("przeceniane stoja nad niedocenianymi", async () => {
  const { buildMisjudged } = await import(MODUL);

  const lista = buildMisjudged([
    druzyna({ key: "rowno", name: "Rowno", trust: 50, win_rate: 50 }),
    druzyna({ key: "nieco", name: "Niedoceniana", trust: 20, win_rate: 60 }),
    druzyna({ key: "prze", name: "Przeceniana", trust: 81, win_rate: 40 }),
  ]);

  assert.deepEqual(
    lista.map((d) => d.name),
    ["Przeceniana", "Rowno", "Niedoceniana"],
  );

  assert.equal(lista[0].gap, 41);
  assert.equal(lista[2].gap, -40);
});

test("druzyna z paroma meczami nie trafia do zestawienia", async () => {
  // Jeden mecz daje zaufanie i skutecznosc rowne 0% albo 100%, czyli
  // rozjazd, ktory nie mowi nic o druzynie.
  const { buildMisjudged } = await import(MODUL);

  const lista = buildMisjudged(
    [
      druzyna({ key: "nowa", name: "Nowa", settled: 1, trust: 90, win_rate: 0 }),
      druzyna({ key: "stara", name: "Stara", settled: 10 }),
    ],
    { minSettled: 5 },
  );

  assert.deepEqual(
    lista.map((d) => d.name),
    ["Stara"],
  );
});

test("druzyna, ktorej nikt nie typowal, nie udaje niedocenianej", async () => {
  // trust rowne null znaczy "nikt nie typowal", a nie "nikt na nia nie
  // postawil" - odejmowanie od null dalo by liczbe wziata z powietrza.
  const { buildMisjudged } = await import(MODUL);

  const lista = buildMisjudged([
    { ...druzyna({ key: "cicha", name: "Cicha" }), trust: null },
    { ...druzyna({ key: "nowa", name: "Bez wyniku" }), win_rate: null },
    druzyna({ key: "ok", name: "Normalna" }),
  ]);

  assert.deepEqual(
    lista.map((d) => d.name),
    ["Normalna"],
  );
});

test("zaufanie i skutecznosc ida dalej w niezmienionej postaci", async () => {
  // Te dwie liczby stoja juz na stronie druzyny. Gdyby ten modul liczyl je
  // od nowa, dwa miejsca mowilyby dwie rzeczy o tej samej druzynie.
  const { buildMisjudged } = await import(MODUL);

  const [d] = buildMisjudged([
    druzyna({ key: "gl", name: "GamerLegion", trust: 81, win_rate: 40 }),
  ]);

  assert.equal(d.trust, 81);
  assert.equal(d.win_rate, 40);
  assert.equal(d.gap, 41);
});
