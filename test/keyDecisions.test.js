// Mecze, ktore zrobily roznice (server/lib/keyDecisions.js).
//
// Profil mowi "+2 wobec tlumu" i na tym konczy. Suma jest prawdziwa, ale
// bierze sie z kilku decyzji, nie ze stu szesciu - zmierzone w IEM Cologne:
// tylko 8% typow (504 z 6405) oddano wbrew trzem czwartym stawki.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/keyDecisions.js";
const TLUM = "../server/lib/crowdBaseline.js";

function mecz({
  id = 1,
  a = "Spirit",
  b = "MIBR",
  naA = false,
  wygralA = false,
  on_a = 50,
  on_b = 10,
  phase = "PLAYOFFS",
} = {}) {
  return {
    match_id: id,
    team_a: a,
    team_b: b,
    phase,
    mine_a: naA ? 1 : 0,
    winner_a: wygralA ? 1 : 0,
    on_a,
    on_b,
  };
}

test("decyzja opisuje sie NAZWA druzyny, nie strona", async () => {
  // "Postawil na A" nie znaczy nic dla kogos, kto oglada tabele pol roku
  // pozniej.
  const { buildKeyDecisions } = await import(MODUL);

  const w = buildKeyDecisions([
    mecz({ a: "B8", b: "M80", naA: false, wygralA: false, on_a: 49, on_b: 4 }),
  ]);

  assert.equal(w.best.length, 1);
  assert.equal(w.best[0].picked, "M80");
  assert.equal(w.best[0].team_a, "B8");
  assert.equal(w.best[0].team_b, "M80");
});

test("wlasny glos NIE liczy sie do poparcia", async () => {
  // Bez odjecia kazdy mialby po swojej stronie zawsze o jeden glos wiecej,
  // i tym bardziej znaczaco, im mniej osob typowalo dany mecz.
  const { buildKeyDecisions } = await import(MODUL);

  // Gracz na B. Z nim po tej stronie jest 1 osoba, wiec bez niego zero.
  const w = buildKeyDecisions([
    mecz({ naA: false, wygralA: false, on_a: 53, on_b: 1 }),
  ]);

  assert.equal(w.best[0].support, 0, "byl jedynym, ktory tak obstawil");
  assert.equal(w.best[0].voters, 53, "i to wsrod pieciudziesieciu trzech innych");
});

test("odjecie wlasnego glosu jest TA SAMA regula, co przy tlumie", async () => {
  // Dwie kopie tej reguly to dwie okazje, zeby jedna po cichu przestala
  // odejmowac. Test pilnuje, ze obie biblioteki widza ten sam mecz
  // identycznie.
  const { buildKeyDecisions } = await import(MODUL);
  const { bezTwojegoGlosu, buildPlayerVsCrowd } = await import(TLUM);

  const wiersz = mecz({ naA: true, wygralA: true, on_a: 21, on_b: 20 });

  const { naA, naB } = bezTwojegoGlosu(wiersz);

  assert.equal(naA, 20, "jego glos odjety od strony A");
  assert.equal(naB, 20);

  // Dla tlumu ten mecz wypada z porownania (remis bez jego glosu)...
  assert.equal(buildPlayerVsCrowd([wiersz]).tied, 1);

  // ...ale decyzja i tak jest opisywalna: polowa stawki byla z nim.
  assert.equal(buildKeyDecisions([wiersz]).best[0].support, 50);
});

test("mecz z mala widownia w ogole nie wchodzi", async () => {
  // "Byles sam przeciw trzem" nie jest samotnoscia, tylko mala probka.
  const { buildKeyDecisions, MIN_GLOSUJACYCH } = await import(MODUL);

  const maly = buildKeyDecisions([
    mecz({ naA: true, wygralA: true, on_a: 3, on_b: 2 }),
  ]);

  assert.deepEqual(maly.best, []);
  assert.deepEqual(maly.worst, []);

  const duzy = buildKeyDecisions([
    mecz({ naA: true, wygralA: true, on_a: MIN_GLOSUJACYCH + 1, on_b: 0 }),
  ]);

  assert.equal(duzy.best.length, 1, "rowno na progu juz sie liczy");
  assert.equal(duzy.voters, MIN_GLOSUJACYCH, "prog idzie na front");
});

test("najlepsze to trafienia OD NAJRZADSZEJ", async () => {
  const { buildKeyDecisions } = await import(MODUL);

  const w = buildKeyDecisions([
    mecz({ id: 1, naA: true, wygralA: true, on_a: 30, on_b: 30 }), // ~49%
    mecz({ id: 2, naA: true, wygralA: true, on_a: 6, on_b: 50 }), // ~9%
    mecz({ id: 3, naA: true, wygralA: true, on_a: 20, on_b: 30 }), // ~39%
  ]);

  assert.deepEqual(
    w.best.map((r) => r.match_id),
    [2, 3, 1],
  );
});

test("NAJGORSZE to pomylka w samotnosci, a nie pomylka z tlumem", async () => {
  // To jest decyzja, ktora ta sekcja stoi. Pierwsza, oczywista definicja -
  // "mylileś sie, choc wiekszosc wiedziala" - daje WSZYSTKIM te same trzy
  // mecze (w Kolonii: Vitality-9z, MIBR-THUNDER, B8-M80), czyli strone
  // Niespodzianki powtorzona na profilu. Fakt o czlowieku zaczyna sie tam,
  // gdzie czlowiek odszedl od reszty.
  const { buildKeyDecisions } = await import(MODUL);

  const w = buildKeyDecisions([
    // Pomylka RAZEM z tlumem - wszyscy tak obstawili.
    mecz({ id: 1, a: "Vitality", b: "9z", naA: true, wygralA: false, on_a: 40, on_b: 0 }),
    // Pomylka W SAMOTNOSCI - postawil wbrew wszystkim i przegral.
    mecz({ id: 2, a: "Spirit", b: "MIBR", naA: false, wygralA: true, on_a: 53, on_b: 1 }),
  ]);

  assert.equal(w.worst[0].match_id, 2, "samotna pomylka stoi pierwsza");
  assert.equal(w.worst[0].picked, "MIBR");
  assert.equal(w.worst[0].support, 0);
});

test("przy rownym poparciu wyzej stoi mecz z WIEKSZA widownia", async () => {
  // Bycie samemu wsrod stu piecdziesieciu znaczy wiecej niz wsrod
  // dwudziestu jeden.
  const { buildKeyDecisions } = await import(MODUL);

  const w = buildKeyDecisions([
    mecz({ id: 1, naA: true, wygralA: true, on_a: 1, on_b: 20 }),
    mecz({ id: 2, naA: true, wygralA: true, on_a: 1, on_b: 150 }),
  ]);

  assert.deepEqual(
    w.best.map((r) => [r.match_id, r.voters]),
    [
      [2, 150],
      [1, 20],
    ],
  );
});

test("pokazujemy po trzy z kazdej strony", async () => {
  const { buildKeyDecisions, ILE_POKAZUJEMY } = await import(MODUL);

  const duzo = Array.from({ length: 10 }, (_, i) =>
    mecz({ id: i + 1, naA: true, wygralA: true, on_a: i + 1, on_b: 40 }),
  );

  assert.equal(buildKeyDecisions(duzo).best.length, ILE_POKAZUJEMY);
});

test("mecz bez nazw druzyn wypada - nie ma czego pokazac", async () => {
  const { buildKeyDecisions } = await import(MODUL);

  const w = buildKeyDecisions([
    mecz({ id: 1, a: null, b: "M80", naA: false, wygralA: false, on_a: 49, on_b: 4 }),
    mecz({ id: 2, a: "  ", b: "M80", naA: false, wygralA: false, on_a: 49, on_b: 4 }),
    mecz({ id: 3, a: "B8", b: "M80", naA: false, wygralA: false, on_a: 49, on_b: 4 }),
  ]);

  assert.deepEqual(
    w.best.map((r) => r.match_id),
    [3],
  );
});

test("brak wejscia nie wywraca liczenia", async () => {
  const { buildKeyDecisions } = await import(MODUL);

  assert.deepEqual(buildKeyDecisions().best, []);
  assert.deepEqual(buildKeyDecisions([]).worst, []);
  assert.deepEqual(buildKeyDecisions([null]).best, []);
});
