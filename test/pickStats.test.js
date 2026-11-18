// Czy liczenie oddanych typow liczy to, co obiecuje.
//
// Trzy rzeczy, ktore moga tu skłamac po cichu - kazda daje liczbe
// wygladajaca na prawdziwa:
//
//   1. WARIANTY NAZW. Druzyny w swiss/playoffs/play-in sa tekstem wpisanym
//      przez czlowieka. "NAVI" i "Natus Vincere" to jedna druzyna, a "FaZe"
//      i "FaZe Clan" tez - grupowanie po surowej nazwie rozbija je na dwie
//      i obie polowki wygladaja wiarygodnie.
//
//   2. TYPY KONTRA GRACZE. Jeden gracz ma w match_predictions tyle wierszy,
//      ile meczow obstawil. Suma wierszy to aktywnosc, nie frekwencja -
//      pomylenie tego zawyza "ilu ludzi typuje" kilkukrotnie.
//
//   3. KTO ZOSTAL WYTYPOWANY. match_predictions nie trzyma nazwy druzyny,
//      tylko wynik pred_a:pred_b. Zwyciezca wynika z porownania tych dwoch
//      liczb Z USTAWIENIEM DRUZYN W MECZU - odwrocenie tego cicho przypisuje
//      glosy przeciwnikowi.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const KORZEN = path.join(__dirname, "..");

const MODUL = path.join(KORZEN, "server", "lib", "pickStats.js");
const LOGA = path.join(KORZEN, "server", "lib", "teamLogos.js");

async function zaladuj() {
  return import(`file:///${MODUL.replace(/\\/g, "/")}`);
}

async function zaladujTeamKey() {
  const mod = await import(`file:///${LOGA.replace(/\\/g, "/")}`);

  return mod.teamKey;
}

// Prosty klucz na potrzeby testow, ktore nie sprawdzaja scalania nazw.
const prostyKlucz = (n) =>
  String(n ?? "")
    .trim()
    .toLowerCase();

const MECZE = [
  { id: 1, team_a: "NAVI", team_b: "FaZe", best_of: 1, phase: "SWISS_STAGE1" },
  { id: 2, team_a: "Spirit", team_b: "Vitality", best_of: 3, phase: "PLAYOFFS" },
];

/* ===============================
   ROZBIJANIE NAZW
   =============================== */

test("rozbijNazwy dzieli po przecinku i obcina biale znaki", async () => {
  const { rozbijNazwy } = await zaladuj();

  assert.deepEqual(rozbijNazwy("PARIVISION, 100 Thieves"), [
    "PARIVISION",
    "100 Thieves",
  ]);
});

test("rozbijNazwy pomija puste wpisy", async () => {
  const { rozbijNazwy } = await zaladuj();

  // "A, , B" i "A,B" to ten sam typ.
  assert.deepEqual(rozbijNazwy("A, , B"), ["A", "B"]);
  assert.deepEqual(rozbijNazwy(",,"), []);
});

test("rozbijNazwy znosi brak wartosci", async () => {
  const { rozbijNazwy } = await zaladuj();

  for (const wejscie of [null, undefined, ""]) {
    assert.deepEqual(rozbijNazwy(wejscie), []);
  }
});

/* ===============================
   KTO ZOSTAL WYTYPOWANY NA ZWYCIEZCE
   =============================== */

test("zwyciezca meczu wynika z ustawienia druzyn, nie z kolejnosci typu", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    // pred_a > pred_b znaczy "wygra team_a", czyli NAVI w meczu 1.
    typyMeczow: [
      { user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u2", match_id: 1, pred_a: 5, pred_b: 13 },
      { user_id: "u3", match_id: 1, pred_a: 16, pred_b: 14 },
    ],
    teamKey: prostyKlucz,
  });

  const navi = wynik.naDruzyny.find((d) => d.klucz === "navi");
  const faze = wynik.naDruzyny.find((d) => d.klucz === "faze");

  assert.equal(navi.zwyciezcaMeczu, 2, "NAVI mialo dwa glosy");
  assert.equal(faze.zwyciezcaMeczu, 1, "FaZe mialo jeden glos");
});

test("remis w typie nie przypisuje glosu zadnej druzynie", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [{ user_id: "u1", match_id: 1, pred_a: 13, pred_b: 13 }],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny.length, 0);
  assert.equal(wynik.fazy.mecze.typow, 1, "typ nadal sie liczy w sumie");
});

test("typ na mecz spoza turnieju nie wywala liczenia", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [{ user_id: "u1", match_id: 999, pred_a: 13, pred_b: 7 }],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny.length, 0);
});

test("niepoprawny wynik typu nie przypisuje glosu", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [
      { user_id: "u1", match_id: 1, pred_a: null, pred_b: 7 },
      { user_id: "u2", match_id: 1, pred_a: "x", pred_b: "y" },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny.length, 0);
});

/* ===============================
   SCALANIE WARIANTOW NAZW
   =============================== */

test("warianty tej samej nazwy licza sie jako jedna druzyna", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const teamKey = await zaladujTeamKey();

  const wynik = policzStatystykiTypow({
    typySwiss: [
      { user_id: "u1", pick_3_0: "NAVI", pick_0_3: "", advancing: "FaZe" },
      {
        user_id: "u2",
        pick_3_0: "Natus Vincere",
        pick_0_3: "",
        advancing: "FaZe Clan",
      },
    ],
    teamKey,
  });

  const navi = wynik.naDruzyny.filter((d) => d.klucz === teamKey("NAVI"));
  const faze = wynik.naDruzyny.filter((d) => d.klucz === teamKey("FaZe"));

  assert.equal(navi.length, 1, "NAVI i Natus Vincere to jeden wiersz");
  assert.equal(navi[0].pick30, 2);

  assert.equal(faze.length, 1, "FaZe i FaZe Clan to jeden wiersz");
  assert.equal(faze[0].awans, 2);
});

/* ===============================
   SWISS, PLAYOFFS, PLAY-IN, DOUBLE ELIM
   =============================== */

test("swiss rozdziela 3-0, 0-3 i awans", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typySwiss: [
      {
        user_id: "u1",
        pick_3_0: "Heroic, M80",
        pick_0_3: "DENDELE",
        advancing: "FaZe, Heroic",
      },
    ],
    teamKey: prostyKlucz,
  });

  const heroic = wynik.naDruzyny.find((d) => d.klucz === "heroic");

  assert.equal(heroic.pick30, 1);
  assert.equal(heroic.awans, 1);
  assert.equal(heroic.razem, 2, "obie role licza sie do sumy");

  const dendele = wynik.naDruzyny.find((d) => d.klucz === "dendele");

  assert.equal(dendele.pick03, 1);
});

test("playoffs rozdziela polfinal, final, mistrza i trzecie miejsce", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typyPlayoffs: [
      {
        user_id: "u1",
        semifinalists: "Spirit, Vitality, NAVI, FaZe",
        finalists: "Spirit, Vitality",
        winner: "Vitality",
        third_place_winner: "NAVI",
      },
    ],
    teamKey: prostyKlucz,
  });

  const vit = wynik.naDruzyny.find((d) => d.klucz === "vitality");

  assert.equal(vit.polfinal, 1);
  assert.equal(vit.final, 1);
  assert.equal(vit.mistrz, 1);

  const navi = wynik.naDruzyny.find((d) => d.klucz === "navi");

  assert.equal(navi.trzecieMiejsce, 1);
  assert.equal(navi.mistrz, 0);
});

test("play-in liczy kazda druzyne z listy", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typyPlayin: [
      { user_id: "u1", teams: "Aurora, GamerLegion, G2" },
      { user_id: "u2", teams: "G2" },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny.find((d) => d.klucz === "g2").playin, 2);
  assert.equal(wynik.naDruzyny.find((d) => d.klucz === "aurora").playin, 1);
});

test("double elim liczy wszystkie cztery kolumny finalow", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typyDoubleElim: [
      {
        user_id: "u1",
        upper_final_a: "NAVI",
        upper_final_b: "FaZe",
        lower_final_a: "Spirit",
        lower_final_b: "NAVI",
      },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny.find((d) => d.klucz === "navi").final, 2);
  assert.equal(wynik.naDruzyny.find((d) => d.klucz === "spirit").final, 1);
});

/* ===============================
   TYPY KONTRA GRACZE
   =============================== */

test("suma typow to nie liczba graczy", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    // Jeden gracz, dwa mecze.
    typyMeczow: [
      { user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u1", match_id: 2, pred_a: 2, pred_b: 1 },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.fazy.mecze.typow, 2);
  assert.equal(wynik.fazy.mecze.graczy, 1);
  assert.equal(wynik.fazy.mecze.meczowObstawionych, 2);
});

test("ten sam gracz w kilku fazach liczy sie raz w sumie graczy", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [{ user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 }],
    typySwiss: [
      { user_id: "u1", pick_3_0: "NAVI", pick_0_3: "", advancing: "" },
    ],
    typyMvp: [{ user_id: "u2", candidate_id: 5 }],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.ogolem.graczy, 2, "u1 raz, u2 raz");
  assert.equal(wynik.ogolem.typow, 3, "trzy typy w trzech fazach");
});

/* ===============================
   KOMPLETNOSC
   =============================== */

test("kompletnosc pokazuje, ilu graczy obstawilo ile meczow", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [
      // u1 ma oba mecze, u2 i u3 po jednym
      { user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u1", match_id: 2, pred_a: 2, pred_b: 0 },
      { user_id: "u2", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u3", match_id: 2, pred_a: 1, pred_b: 2 },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.kompletnosc.meczow, 2);
  assert.equal(wynik.kompletnosc.pelne, 1, "tylko u1 ma komplet");
  assert.equal(wynik.kompletnosc.obstawiajacych, 3);

  const koszyk = (nazwa) =>
    wynik.kompletnosc.koszyki.find((k) => k.nazwa === nazwa).graczy;

  assert.equal(koszyk("komplet"), 1);
  assert.equal(koszyk("polowa"), 2, "1 z 2 meczow to dokladnie polowa");
});

test("powtorzony typ na ten sam mecz nie zawyza kompletnosci", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [
      { user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u1", match_id: 1, pred_a: 16, pred_b: 14 },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.kompletnosc.pelne, 0, "jeden mecz z dwoch to nie komplet");
  assert.equal(wynik.kompletnosc.obstawiajacych, 1);
  assert.deepEqual(wynik.kompletnosc.najczestszy, { ile: 1, graczy: 1 });
});

test("komplet ma wlasny koszyk - 99% nie wpada razem ze 100%", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  // 100 meczow: u1 ma 100, u2 ma 99. To nie moze wyjsc jako dwoch z kompletem.
  const mecze = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    team_a: "A",
    team_b: "B",
  }));

  const typyMeczow = [];

  for (let i = 1; i <= 100; i += 1) {
    typyMeczow.push({ user_id: "u1", match_id: i, pred_a: 13, pred_b: 7 });
  }

  for (let i = 1; i <= 99; i += 1) {
    typyMeczow.push({ user_id: "u2", match_id: i, pred_a: 13, pred_b: 7 });
  }

  const wynik = policzStatystykiTypow({ mecze, typyMeczow, teamKey: prostyKlucz });

  const koszyk = (nazwa) =>
    wynik.kompletnosc.koszyki.find((k) => k.nazwa === nazwa).graczy;

  assert.equal(wynik.kompletnosc.pelne, 1);
  assert.equal(koszyk("komplet"), 1, "tylko u1");
  assert.equal(koszyk("duzo"), 1, "u2 z 99% siedzi w koszyku ponizej");
});

test("koszyki lapia kazdego obstawiajacego dokladnie raz", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const mecze = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    team_a: "A",
    team_b: "B",
  }));

  const typyMeczow = [];

  // Po jednym graczu na kazda mozliwa liczbe obstawionych meczow.
  for (let gracz = 1; gracz <= 8; gracz += 1) {
    for (let i = 1; i <= gracz; i += 1) {
      typyMeczow.push({
        user_id: `u${gracz}`,
        match_id: i,
        pred_a: 13,
        pred_b: 7,
      });
    }
  }

  const wynik = policzStatystykiTypow({ mecze, typyMeczow, teamKey: prostyKlucz });

  const suma = wynik.kompletnosc.koszyki.reduce((s, k) => s + k.graczy, 0);

  assert.equal(suma, 8, "osmiu graczy, osiem trafien w koszyki");
  assert.equal(suma, wynik.kompletnosc.obstawiajacych);
});

test("najczestsza liczba obstawionych meczow wychodzi wprost", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    mecze: MECZE,
    typyMeczow: [
      // trzech graczy po jednym meczu, jeden z dwoma
      { user_id: "u1", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u2", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u3", match_id: 2, pred_a: 1, pred_b: 2 },
      { user_id: "u4", match_id: 1, pred_a: 13, pred_b: 7 },
      { user_id: "u4", match_id: 2, pred_a: 2, pred_b: 1 },
    ],
    teamKey: prostyKlucz,
  });

  assert.deepEqual(wynik.kompletnosc.najczestszy, { ile: 1, graczy: 3 });
});

/* ===============================
   MAPY
   =============================== */

test("mapy licza sie po numerze w serii, w kolejnosci rosnacej", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typyMap: [
      { user_id: "u1", match_id: 2, map_no: 2 },
      { user_id: "u1", match_id: 2, map_no: 1 },
      { user_id: "u2", match_id: 2, map_no: 1 },
    ],
    teamKey: prostyKlucz,
  });

  assert.deepEqual(wynik.naMapy, [
    { mapNo: 1, typow: 2, graczy: 2 },
    { mapNo: 2, typow: 1, graczy: 1 },
  ]);
});

test("niepoprawny numer mapy wypada", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typyMap: [
      { user_id: "u1", match_id: 2, map_no: 0 },
      { user_id: "u1", match_id: 2, map_no: null },
      { user_id: "u1", match_id: 2, map_no: 1 },
    ],
    teamKey: prostyKlucz,
  });

  assert.deepEqual(wynik.naMapy, [{ mapNo: 1, typow: 1, graczy: 1 }]);
});

/* ===============================
   SKRAJNOSCI
   =============================== */

test("pusty turniej oddaje zera, a nie wyjatek", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({ teamKey: prostyKlucz });

  assert.equal(wynik.ogolem.typow, 0);
  assert.equal(wynik.ogolem.graczy, 0);
  assert.deepEqual(wynik.naDruzyny, []);
  assert.deepEqual(wynik.naMapy, []);
  assert.equal(wynik.kompletnosc.obstawiajacych, 0);
  assert.equal(wynik.kompletnosc.najczestszy, null);
  assert.equal(
    wynik.kompletnosc.koszyki.reduce((s, k) => s + k.graczy, 0),
    0,
  );
});

test("brak teamKey jest bledem wprost, nie cichym zerem", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  assert.throws(() => policzStatystykiTypow({}), TypeError);
});

test("druzyny wychodza posortowane po sumie glosow", async () => {
  const { policzStatystykiTypow } = await zaladuj();

  const wynik = policzStatystykiTypow({
    typySwiss: [
      { user_id: "u1", pick_3_0: "B", pick_0_3: "", advancing: "A, B" },
      { user_id: "u2", pick_3_0: "", pick_0_3: "", advancing: "B" },
    ],
    teamKey: prostyKlucz,
  });

  assert.equal(wynik.naDruzyny[0].klucz, "b", "B ma 3 glosy, A ma 1");
  assert.equal(wynik.naDruzyny[0].razem, 3);
  assert.equal(wynik.naDruzyny[1].klucz, "a");
});
