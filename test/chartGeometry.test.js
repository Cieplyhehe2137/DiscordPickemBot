// Geometria wykresu punktow (web/src/lib/chartGeometry.js).
//
// Testy pilnuja przypadkow, w ktorych mianownik jest zerem. Kazdy z nich
// konczy sie NaN w atrybucie SVG, a przegladarka na NaN nie zglasza bledu -
// po prostu nie rysuje. Wykres znika, konsola milczy.
//
// Zero punktow nie jest przypadkiem brzegowym: tak wyglada kazdy, kto zapisal
// sie na turniej i nie trafil nic.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/chartGeometry.js";

function ciag(...sumy) {
  return sumy.map((total, i) => ({ n: i + 1, total }));
}

// Czy wszystkie liczby w wspolrzednych sa prawdziwymi liczbami.
function bezNaN(punkty) {
  return punkty.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

test("jeden mecz nie daje NaN, mimo zerowej rozpietosci osi", async () => {
  // Dzielenie przez (length - 1) to tutaj dzielenie przez zero.
  const { wspolrzedne, obszar } = await import(MODUL);

  const punkty = wspolrzedne(ciag(5), 10);

  assert.equal(punkty.length, 1);
  assert.ok(bezNaN(punkty));
  assert.equal(punkty[0].x, obszar().left);
});

test("zero punktow u wszystkich nie daje NaN", async () => {
  // Gracz, ktory nie trafil nic. Gora skali wynosi zero.
  const { wspolrzedne, obszar } = await import(MODUL);

  const punkty = wspolrzedne(ciag(0, 0, 0), 0);

  assert.ok(bezNaN(punkty));

  // Linia lezy na dnie, a nie znika i nie wychodzi poza wykres.
  for (const p of punkty) assert.equal(p.y, obszar().bottom);
});

test("pusty ciag daje pusta liste, a nie wyjatek", async () => {
  const { wspolrzedne, sciezka, sciezkaPola } = await import(MODUL);

  assert.deepEqual(wspolrzedne([], 10), []);
  assert.deepEqual(wspolrzedne(null, 10), []);
  assert.equal(sciezka([]), "");
  assert.equal(sciezkaPola([]), "");
});

test("wieksza suma stoi wyzej", async () => {
  // W SVG mniejszy y znaczy wyzej - latwo to odwrocic i nie zauwazyc,
  // bo wykres nadal wyglada jak wykres.
  const { wspolrzedne } = await import(MODUL);

  const [maly, duzy] = wspolrzedne(ciag(10, 90), 100);

  assert.ok(duzy.y < maly.y, "90 punktow ma byc wyzej niz 10");
});

test("punkty rozkladaja sie rowno od lewej do prawej krawedzi", async () => {
  const { wspolrzedne, obszar } = await import(MODUL);

  const o = obszar();
  const punkty = wspolrzedne(ciag(1, 2, 3, 4, 5), 5);

  assert.equal(punkty[0].x, o.left);
  assert.equal(punkty[4].x, o.right);

  const odstepy = punkty.slice(1).map((p, i) => p.x - punkty[i].x);

  for (const d of odstepy) {
    assert.ok(Math.abs(d - odstepy[0]) < 1e-9, "odstepy maja byc rowne");
  }
});

test("dwa ciagi na tej samej skali zachowuja przewage", async () => {
  // Gora skali podaje sie z zewnatrz wlasnie po to. Liczona osobno dla
  // kazdego ciagu, obie linie konczylyby na tej samej wysokosci i wykres
  // klamalby dokladnie w tym, po co powstal.
  const { wspolrzedne } = await import(MODUL);

  const lepszy = wspolrzedne(ciag(50, 100), 100);
  const gorszy = wspolrzedne(ciag(20, 40), 100);

  assert.ok(gorszy[1].y > lepszy[1].y, "40 punktow ma byc nizej niz 100");
});

test("podzialka idzie okraglymi krokami", async () => {
  const { podzialka } = await import(MODUL);

  assert.deepEqual(podzialka(100).wartosci, [0, 25, 50, 75, 100]);
  assert.deepEqual(podzialka(10).wartosci, [0, 5, 10]);
  assert.deepEqual(podzialka(141).wartosci, [0, 50, 100, 150]);
});

test("podzialka ma same liczby calkowite", async () => {
  // Punktow ulamkowych nie ma, wiec os z "2,5 pkt" bylaby falszem.
  const { podzialka } = await import(MODUL);

  for (const max of [1, 3, 7, 10, 23, 47, 100, 141, 156, 212, 500]) {
    for (const v of podzialka(max).wartosci) {
      assert.ok(Number.isInteger(v), `${v} na osi przy max ${max}`);
    }
  }
});

test("podzialka siega ponad najwyzsza wartosc, a nie urywa sie pod nia", async () => {
  const { podzialka } = await import(MODUL);

  const { gora } = podzialka(156);

  assert.ok(gora >= 156, `gora skali ${gora} musi zmiescic 156`);
});

test("podzialka dla zera nie wpada w nieskonczonosc", async () => {
  // log10(0) to minus nieskonczonosc - krok wyszedlby zerem i petla
  // budujaca wartosci nigdy by sie nie skonczyla.
  const { podzialka, krokPodzialki } = await import(MODUL);

  assert.equal(krokPodzialki(0), 1);

  const { wartosci } = podzialka(0);

  assert.ok(wartosci.length > 0 && wartosci.length < 10);
  assert.equal(wartosci[0], 0);
});

test("sciezka zaczyna sie od M i dalej ma same L", async () => {
  const { wspolrzedne, sciezka } = await import(MODUL);

  const d = sciezka(wspolrzedne(ciag(1, 2, 3), 3));

  assert.ok(d.startsWith("M"));
  assert.equal((d.match(/M/g) || []).length, 1);
  assert.equal((d.match(/L/g) || []).length, 2);
  assert.ok(!d.includes("NaN"));
});

test("wypelnienie jest domkniete do dna", async () => {
  const { wspolrzedne, sciezkaPola, obszar } = await import(MODUL);

  const d = sciezkaPola(wspolrzedne(ciag(1, 5), 5));

  assert.ok(d.endsWith("Z"), "sciezka pola musi byc zamknieta");
  assert.ok(d.includes(String(obszar().bottom)));
  assert.ok(!d.includes("NaN"));
});
