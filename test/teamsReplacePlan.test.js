// Czy import słownika drużyn zachowuje id drużyn, które na liście zostały.
//
// PO CO AŻ TYLE TESTÓW NA JEDNĄ FUNKCJĘ. Od migracji 0014 `event_teams`
// wskazuje drużynę przez `team_id` i ma `ON DELETE CASCADE`. Id jest więc
// jedyną rzeczą, która trzyma roster turnieju przy życiu - a id nie widać
// w żadnym komunikacie i w żadnym zrzucie ekranu. Błąd w dopasowaniu nie
// wywala niczego: po prostu turniej cicho wraca na roster serwera, czyli
// pokazuje szesnaście dziś aktywnych drużyn zamiast tych, które w nim grały.
//
// Drugi powód jest subtelniejszy. Kolejność dwóch przebiegów (najpierw
// dokładna nazwa, potem `teamKey`) jest tym, co sprawia, że zmiany nazw nie
// mogą się zderzyć z kluczem `uniq_guild_name`. Przestawienie przebiegów
// przeszłoby wszystkie testy "czy roster przeżył", a wywaliłoby import
// bazodanowym ER_DUP_ENTRY dopiero na konkretnej liście nazw.

const test = require("node:test");
const assert = require("node:assert/strict");

const { planTeamsReplace } = require("../utils/teamsReplacePlan");

async function klucz() {
  const { teamKey } = await import("../server/lib/teamLogos.js");

  return teamKey;
}

// Słownik w kolejności słownika, z id, które mają przeżyć.
const SLOWNIK = [
  { id: 101, name: "Vitality" },
  { id: 102, name: "BETBOOM" },
  { id: 103, name: "Natus Vincere" },
  { id: 104, name: "MOUZ" },
];

async function plan(nowe, stare = SLOWNIK) {
  return planTeamsReplace({ stare, nowe, klucz: await klucz() });
}

test("ta sama lista nazw nie rusza ani jednego wiersza", async () => {
  const wynik = await plan(["Vitality", "BETBOOM", "Natus Vincere", "MOUZ"]);

  assert.deepEqual(
    wynik.zostaja.map((w) => w.id),
    [101, 102, 103, 104],
  );

  assert.deepEqual(wynik.doUsuniecia, []);
  assert.deepEqual(wynik.doWstawienia, []);
  assert.equal(
    wynik.zostaja.filter((w) => w.rename).length,
    0,
    "nic nie powinno byc przemianowane",
  );
});

test("dodanie nazwy zostawia stare id i wstawia tylko nowa", async () => {
  const wynik = await plan([
    "Vitality",
    "BETBOOM",
    "Natus Vincere",
    "MOUZ",
    "Astralis",
  ]);

  assert.deepEqual(
    wynik.zostaja.map((w) => w.id),
    [101, 102, 103, 104],
  );

  assert.deepEqual(wynik.doWstawienia, [{ name: "Astralis", sortOrder: 5 }]);
  assert.deepEqual(wynik.doUsuniecia, []);
});

test("usuniecie nazwy kasuje JEDEN wiersz, reszta zostaje ze swoim id", async () => {
  const wynik = await plan(["Vitality", "BETBOOM", "Natus Vincere"]);

  assert.deepEqual(
    wynik.zostaja.map((w) => w.id),
    [101, 102, 103],
  );

  assert.deepEqual(
    wynik.doUsuniecia.map((w) => w.name),
    ["MOUZ"],
  );
});

test("inna pisownia tej samej druzyny to zmiana nazwy, nie wymiana wiersza", async () => {
  // Dokladnie ten przypadek wychodzi przy re-imporcie z nazw z MECZOW:
  // mecze maja "BetBoom", slownik "BETBOOM".
  const wynik = await plan(["Vitality", "BetBoom", "Natus Vincere", "MOUZ"]);

  const betboom = wynik.zostaja.find((w) => w.name === "BetBoom");

  assert.equal(betboom.id, 102, "to musi byc TEN SAM wiersz");
  assert.equal(betboom.rename, true);
  assert.deepEqual(wynik.doUsuniecia, []);
  assert.deepEqual(wynik.doWstawienia, []);
});

test("sklejenia z TEAM_KEY_MERGES tez trzymaja wiersz", async () => {
  // "NAVI" i "Natus Vincere" to jedna organizacja - teamKey scala je
  // w `navi`, i tak samo liczy je strona.
  const wynik = await plan(["Vitality", "BETBOOM", "NAVI", "MOUZ"]);

  const navi = wynik.zostaja.find((w) => w.name === "NAVI");

  assert.equal(navi.id, 103);
  assert.equal(navi.rename, true);
  assert.deepEqual(wynik.doUsuniecia, []);
});

test("dopasowanie DOKLADNE wygrywa nad dopasowaniem po kluczu", async () => {
  // To jest test tej wlasnosci, z ktorej wynika brak kolizji z
  // uniq_guild_name: gdy obie nazwy jednej organizacji sa i w slowniku,
  // i na liscie, kazda trafia na swoj wlasny wiersz i NIC sie nie
  // przemianowuje. Przy odwrotnej kolejnosci przebiegow "Natus Vincere"
  // zajeloby wiersz 103 po kluczu, a "NAVI" probowaloby sie przemianowac
  // na nazwe, ktora wciaz trzyma inny wiersz.
  const stare = [
    { id: 201, name: "NAVI" },
    { id: 202, name: "Natus Vincere" },
  ];

  const wynik = await plan(["Natus Vincere", "NAVI"], stare);

  assert.deepEqual(
    wynik.zostaja.map((w) => [w.name, w.id, w.rename]),
    [
      ["Natus Vincere", 202, false],
      ["NAVI", 201, false],
    ],
  );

  assert.deepEqual(wynik.doUsuniecia, []);
  assert.deepEqual(wynik.doWstawienia, []);
});

test("zaden wiersz nie zostaje przypisany dwa razy", async () => {
  // Dwie nazwy o tym samym kluczu na jednej liscie: pierwsza bierze wiersz,
  // druga musi byc wstawieniem. Inaczej wyszedlby plan, w ktorym dwie
  // pozycje celuja w jedno id.
  const stare = [{ id: 301, name: "FaZe" }];

  const wynik = await plan(["FaZe", "FaZe Clan"], stare);

  assert.deepEqual(
    wynik.zostaja.map((w) => [w.name, w.id]),
    [["FaZe", 301]],
  );

  assert.deepEqual(wynik.doWstawienia, [{ name: "FaZe Clan", sortOrder: 2 }]);

  const uzyte = wynik.zostaja.map((w) => w.id);

  assert.equal(new Set(uzyte).size, uzyte.length, "id powtorzone w planie");
});

test("sort_order bierze sie z pozycji na liscie importu", async () => {
  const wynik = await plan(["MOUZ", "Vitality", "BETBOOM", "Natus Vincere"]);

  assert.deepEqual(
    wynik.zostaja.map((w) => [w.name, w.sortOrder]),
    [
      ["MOUZ", 1],
      ["Vitality", 2],
      ["BETBOOM", 3],
      ["Natus Vincere", 4],
    ],
  );

  // Przestawienie kolejnosci nie jest wymiana wierszy.
  assert.deepEqual(wynik.doUsuniecia, []);
  assert.deepEqual(wynik.doWstawienia, []);
});

test("pusta lista kasuje caly slownik i nic nie wstawia", async () => {
  const wynik = await plan([]);

  assert.deepEqual(
    wynik.doUsuniecia.map((w) => w.id),
    [101, 102, 103, 104],
  );

  assert.deepEqual(wynik.zostaja, []);
  assert.deepEqual(wynik.doWstawienia, []);
});

test("nazwa bez liter i cyfr nie dopasowuje sie do niczego", async () => {
  // teamKey("???") to pusty napis - gdyby pusty klucz dopasowywal, taka
  // nazwa porwalaby pierwszy wolny wiersz slownika.
  const wynik = await plan(["Vitality", "???"]);

  assert.deepEqual(
    wynik.zostaja.map((w) => w.id),
    [101],
  );

  assert.deepEqual(wynik.doWstawienia, [{ name: "???", sortOrder: 2 }]);
});

test("plan nigdy nie zmienia nazwy na taka, ktora trzyma inny zachowany wiersz", async () => {
  // Wlasnosc, z ktorej wynika bezpieczenstwo kolejnosci zapytan w
  // utils/teamsStore.js. Sprawdzana na kilku listach naraz, bo chodzi
  // o regule, nie o jeden przypadek.
  const listy = [
    ["Vitality", "BetBoom", "NAVI", "MOUZ"],
    ["NAVI", "Natus Vincere"],
    ["BETBOOM", "BetBoom Team"],
    ["mouz", "MOUZ"],
    ["Vitality"],
  ];

  for (const lista of listy) {
    const wynik = await plan(lista);

    const staraNazwaZachowanych = new Map(
      wynik.zostaja.map((w) => [w.oldName, w.id]),
    );

    for (const w of wynik.zostaja) {
      if (!w.rename) continue;

      const kolizja = staraNazwaZachowanych.get(w.name);

      assert.ok(
        kolizja === undefined || kolizja === w.id,
        `[${lista.join(", ")}] nazwa "${w.name}" jest celem zmiany, ` +
          `a trzyma ja zachowany wiersz ${kolizja}`,
      );
    }
  }
});
