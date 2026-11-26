// Czy mecze do obstawienia stoja na gorze listy - na stronie i w bocie.
//
// Obie listy szly dotad po numerze meczu, czyli w kolejnosci rozgrywania.
// Im dalej w turniej, tym wiecej rozstrzygnietych spotkan trzeba bylo
// przewinac, zeby zobaczyc cokolwiek otwartego. Zmierzone w Swiss Stage 1
// PGL Major Singapore: 33 mecze, 30 rozegranych - otwarte wisialy na samym
// koncu, a w bocie dodatkowo na ostatniej STRONIE listy.
//
// Dwa osobne mechanizmy, bo dwa rozne ograniczenia:
//   - strona pobiera caly etap naraz i filtruje u siebie, wiec sortuje w JS;
//   - bot stronicuje w SQL, wiec sortowanie MUSI byc w zapytaniu - ulozenie
//     juz pobranej strony przestawialoby tylko jej wnetrze.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const FILTRY = path.join(ROOT, "web", "src", "lib", "matchFilters.js");

async function zaladuj() {
  return import(`file:///${FILTRY.replace(/\\/g, "/")}`);
}

const mecz = (match_no, stan, extra = {}) => ({
  id: 1000 + match_no,
  match_no,
  team_a: "A",
  team_b: "B",
  ...(stan === "finished"
    ? { ui_status: "FINAL", predictions_allowed: false }
    : stan === "locked"
      ? { ui_status: "LOCKED", predictions_allowed: false }
      : { ui_status: "OPEN", predictions_allowed: true }),
  ...extra,
});

/* ===============================
   STRONA
   =============================== */

test("otwarte mecze ida przed zablokowanymi i rozstrzygnietymi", async () => {
  const { sortMatches } = await zaladuj();

  // Kolejnosc wejsciowa to kolejnosc rozgrywania - dokladnie ta, na ktora
  // narzekal uzytkownik.
  const wejscie = [
    mecz(1, "finished"),
    mecz(2, "finished"),
    mecz(3, "locked"),
    mecz(4, "open"),
    mecz(5, "open"),
  ];

  const wynik = sortMatches(wejscie);

  assert.deepEqual(
    wynik.map((m) => m.match_no),
    [4, 5, 3, 1, 2],
  );
});

test("w obrebie jednej grupy zostaje kolejnosc numerow", async () => {
  const { sortMatches } = await zaladuj();

  const wynik = sortMatches([
    mecz(9, "open"),
    mecz(2, "open"),
    mecz(5, "open"),
  ]);

  assert.deepEqual(
    wynik.map((m) => m.match_no),
    [2, 5, 9],
  );
});

test("zablokowany stoi nad rozstrzygnietym", async () => {
  const { sortMatches } = await zaladuj();

  // Zablokowany, ale bez wyniku, jest ciekawszy od zakonczonego: za chwile
  // pojawi sie przy nim wynik.
  const wynik = sortMatches([mecz(1, "finished"), mecz(9, "locked")]);

  assert.deepEqual(
    wynik.map((m) => m.match_no),
    [9, 1],
  );
});

test("mecz bez numeru ląduje na koncu swojej grupy, nie na poczatku", async () => {
  const { sortMatches } = await zaladuj();

  const wynik = sortMatches([
    mecz(null, "open"),
    mecz(3, "open"),
    mecz(1, "open"),
  ]);

  assert.deepEqual(
    wynik.map((m) => m.match_no),
    [1, 3, null],
  );
});

test("sortowanie nie zmienia zawartosci ani oryginalnej tablicy", async () => {
  const { sortMatches } = await zaladuj();

  const wejscie = [mecz(1, "finished"), mecz(2, "open")];
  const kopia = wejscie.map((m) => m.match_no);

  const wynik = sortMatches(wejscie);

  assert.equal(wynik.length, wejscie.length);
  assert.deepEqual(
    wejscie.map((m) => m.match_no),
    kopia,
    "oryginalna tablica zostala przestawiona w miejscu",
  );
});

test("brak listy nie wysypuje sortowania", async () => {
  const { sortMatches } = await zaladuj();

  assert.deepEqual(sortMatches(null), []);
  assert.deepEqual(sortMatches(undefined), []);
  assert.deepEqual(sortMatches([]), []);
});

test("stan liczy sie z predictions_allowed, nie z samej etykiety", async () => {
  const { sortMatches, matchState } = await zaladuj();

  // Mecz opisany jako LOCKED, ale wciaz otwarty do typowania - bramka ma
  // pierwszenstwo przed etykieta.
  const dziwny = {
    id: 1,
    match_no: 9,
    ui_status: "LOCKED",
    predictions_allowed: true,
  };

  assert.equal(matchState(dziwny), "open");

  const wynik = sortMatches([mecz(1, "finished"), dziwny]);

  assert.equal(wynik[0].match_no, 9);
});

/* ===============================
   BOT
   =============================== */

test("zapytanie bota sortuje stanem przed numerem meczu", () => {
  const tresc = fs.readFileSync(
    path.join(ROOT, "handlers", "matches", "openMatchPick.js"),
    "utf8",
  );

  // Sortowanie MUSI byc w SQL, bo lista jest stronicowana.
  const orderBy = tresc.slice(tresc.indexOf("ORDER BY"), tresc.indexOf("LIMIT ? OFFSET ?"));

  assert.ok(
    /CASE[\s\S]*END\s+ASC/.test(orderBy),
    "ORDER BY nie zaczyna sie od stanu meczu:\n" + orderBy,
  );

  assert.ok(
    orderBy.indexOf("CASE") < orderBy.indexOf("match_no"),
    "numer meczu wyprzedza stan - otwarte znow wylądują na dole",
  );

  for (const warunek of [
    "mr.match_id IS NOT NULL",
    "m.lock_override = 0",
    "m.lock_override = 1",
    "m.is_locked = 1",
  ]) {
    assert.ok(orderBy.includes(warunek), `brak warunku: ${warunek}`);
  }
});

test("bot pobiera kolumny, bez ktorych nie da sie orzec stanu", () => {
  const tresc = fs.readFileSync(
    path.join(ROOT, "handlers", "matches", "openMatchPick.js"),
    "utf8",
  );

  const select = tresc.slice(tresc.indexOf("SELECT"), tresc.indexOf("FROM matches m"));

  // lock_override bez tego bylo pomijane, wiec isMatchLocked() rysowalo
  // klodke przy meczu otwartym recznie z panelu.
  assert.ok(select.includes("m.lock_override"), "brak lock_override w SELECT");
  assert.ok(select.includes("m.is_locked"), "brak is_locked w SELECT");

  assert.ok(
    /LEFT JOIN\s+match_results\s+mr/.test(tresc),
    "brak zlaczenia z wynikami - rozstrzygniete nie zejda na dol",
  );
});
