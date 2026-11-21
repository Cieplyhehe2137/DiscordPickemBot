// Czy "Moje typy" pokazuje te same typy druzyn, ktore bot punktuje.
//
// Trzy rzeczy, ktore moga tu sklamac bez zadnego bledu:
//
//   1. ZLA TABELA ALBO ZLY ETAP. Swiss trzyma trzy etapy w jednej tabeli,
//      rozdzielone kolumna `stage`. Pominiecie warunku etapu pokazalby
//      graczowi typy z etapu 1 na panelu etapu 3 - i wygladaloby to
//      zupelnie wiarygodnie.
//
//   2. INNY PODZIAL NIZ PUNKTACJA. Druzyny stoja w kolumnie tekstowej, raz
//      po przecinku, raz jako JSON. Gdyby widok dzielil to inaczej niz
//      handlers/matches/calculateScores.js, gracz zobaczylby inne typy, niz
//      zostaly mu policzone.
//
//   3. NOWA FAZA BEZ ZRODLA. Dolozenie fazy meczow bez wpisu w
//      PHASE_PICK_SOURCES cicho gubi jej typy druzyn.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  PHASE_PICK_SOURCES,
  phasePickSource,
  loadUserPhasePicks,
  formatPhasePicks,
} = require("../utils/userPhasePicks");

const { parseTeamList } = require("../utils/teamList");
const { LIMITS, truncate } = require("../utils/discordLimits");

/** Pula udajaca baze: zapamietuje zapytanie i oddaje podane wiersze. */
function fakePool(rows, blad = null) {
  const wywolania = [];

  return {
    wywolania,

    async query(sql, params) {
      wywolania.push({ sql, params });

      if (blad) throw blad;

      return [rows, []];
    },
  };
}

const KONTEKST = {
  guildId: "123",
  eventId: 102,
  userId: "u1",
};

/* ===============================
   MAPOWANIE FAZY
   =============================== */

test("kazdy etap Swiss siega swojego etapu, nie cudzego", () => {
  for (const [faza, etap] of [
    ["SWISS_STAGE1", "stage1"],
    ["SWISS_STAGE2", "stage2"],
    ["SWISS_STAGE3", "stage3"],
  ]) {
    const zrodlo = phasePickSource(faza);

    assert.equal(zrodlo.table, "swiss_predictions", faza);
    assert.equal(zrodlo.stage, etap, faza);
  }
});

test("fazy bez etapow nie dostaja warunku etapu", () => {
  for (const faza of ["PLAYIN", "PLAYOFFS", "DOUBLEELIM"]) {
    assert.equal(phasePickSource(faza).stage, undefined, faza);
  }
});

test("faza rozpoznaje sie bez wzgledu na wielkosc liter i spacje", () => {
  assert.equal(phasePickSource(" swiss_stage2 ").stage, "stage2");
  assert.equal(phasePickSource("PlayOffs").table, "playoffs_predictions");
});

test("nieznana faza oddaje null, a nie wyjatek", () => {
  for (const faza of ["", null, undefined, "NIE_MA_TAKIEJ", "GROUPS"]) {
    assert.equal(phasePickSource(faza), null, String(faza));
  }
});

test("kazda faza, ktora moze przyjsc Z PRZYCISKU, ma zrodlo typow", () => {
  // To jest wartosc, ktora realnie trafia do handlera. Przycisk powstaje
  // w utils/pickemPanelBuilder.js jako `my_predictions:${phase}:...`, gdzie
  // `phase` to klucz phasesConfig - a te sa PISANE MALYMI LITERAMI
  // ("swiss_stage1"), inaczej niz matches.phase ("SWISS_STAGE1"). Gdyby
  // phasePickSource przestalo to wyrownywac, typy druzyn zniknelyby
  // w kazdej fazie naraz, a widok meczow dzialalby dalej - czyli nic by
  // nie krzyknelo.
  const { phasesConfig } = require("../utils/pickemPanelBuilder");

  const klucze = Object.keys(phasesConfig);

  assert.ok(klucze.length >= 6, `tylko ${klucze.length} faz panelu`);

  for (const klucz of klucze) {
    assert.ok(
      phasePickSource(klucz),
      `przycisk fazy "${klucz}" nie trafia w PHASE_PICK_SOURCES`,
    );
  }
});

test("kazda faza meczow ma zrodlo typow druzyn", () => {
  // Lista faz, w ktorych mecz jest w ogole osiagalny - zrodlem prawdy jest
  // server/routes/guildEvents.js, bo to ona decyduje, co da sie zalozyc.
  const zrodlo = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "guildEvents.js"),
    "utf8",
  );

  const blok = zrodlo.slice(
    zrodlo.indexOf("const FAZY_MECZOW"),
    zrodlo.indexOf("]);", zrodlo.indexOf("const FAZY_MECZOW")),
  );

  const fazyMeczow = [...blok.matchAll(/"([A-Z_0-9]+)"/g)].map((m) => m[1]);

  assert.ok(fazyMeczow.length >= 6, `znalazlem tylko ${fazyMeczow.length} faz`);

  for (const faza of fazyMeczow) {
    assert.ok(
      phasePickSource(faza),
      `faza ${faza} nie ma wpisu w PHASE_PICK_SOURCES - jej typy druzyn nie pokaza sie w "Moje typy"`,
    );
  }
});

test("kazde zrodlo ma tabele i co najmniej jedna grupe", () => {
  for (const [faza, zrodlo] of Object.entries(PHASE_PICK_SOURCES)) {
    assert.ok(zrodlo.table, `${faza}: brak tabeli`);
    assert.ok(zrodlo.groups.length > 0, `${faza}: brak grup`);

    for (const g of zrodlo.groups) {
      assert.ok(g.column, `${faza}: grupa bez kolumny`);
      assert.ok(g.label, `${faza}: grupa bez etykiety`);
    }
  }
});

/* ===============================
   CZYTANIE Z BAZY
   =============================== */

test("Swiss pyta o swoj etap i o wlasciwe kolumny", async () => {
  const pool = fakePool([
    { pick_3_0: "NAVI, FaZe", pick_0_3: "M80", advancing: "Spirit" },
  ]);

  await loadUserPhasePicks(pool, { ...KONTEKST, phaseKey: "SWISS_STAGE2" });

  const { sql, params } = pool.wywolania[0];

  assert.ok(sql.includes("swiss_predictions"), sql);
  assert.ok(sql.includes("stage = ?"), "brak warunku etapu");
  assert.ok(sql.includes("pick_3_0"), "brak kolumny 3-0");
  assert.deepEqual(params, ["123", 102, "u1", "stage2"]);
});

test("faza bez etapu nie dokłada warunku ani parametru", async () => {
  const pool = fakePool([{ teams: "Aurora, G2" }]);

  await loadUserPhasePicks(pool, { ...KONTEKST, phaseKey: "PLAYIN" });

  const { sql, params } = pool.wywolania[0];

  assert.ok(!sql.includes("stage"), "warunek etapu w fazie bez etapow");
  assert.deepEqual(params, ["123", 102, "u1"]);
});

test("typy wychodza pogrupowane i w kolejnosci zrodla", async () => {
  const pool = fakePool([
    {
      pick_3_0: "NAVI, FaZe",
      pick_0_3: "M80",
      advancing: "Spirit, Vitality, G2",
    },
  ]);

  const wynik = await loadUserPhasePicks(pool, {
    ...KONTEKST,
    phaseKey: "SWISS_STAGE1",
  });

  assert.deepEqual(
    wynik.groups.map((g) => g.label),
    ["Drużyny 3-0", "Drużyny 0-3", "Awansujące"],
  );

  assert.deepEqual(wynik.groups[0].teams, ["NAVI", "FaZe"]);
  assert.deepEqual(wynik.groups[2].teams, ["Spirit", "Vitality", "G2"]);
  assert.equal(wynik.stage, "stage1");
});

test("puste grupy wypadaja, zeby nie pokazywac naglowka bez tresci", async () => {
  const pool = fakePool([
    { pick_3_0: "NAVI", pick_0_3: "", advancing: null },
  ]);

  const wynik = await loadUserPhasePicks(pool, {
    ...KONTEKST,
    phaseKey: "SWISS_STAGE1",
  });

  assert.equal(wynik.groups.length, 1);
  assert.equal(wynik.groups[0].label, "Drużyny 3-0");
});

test("brak wiersza i same puste kolumny oddaja null", async () => {
  const pusty = await loadUserPhasePicks(fakePool([]), {
    ...KONTEKST,
    phaseKey: "SWISS_STAGE1",
  });

  assert.equal(pusty, null);

  const bezTypow = await loadUserPhasePicks(
    fakePool([{ pick_3_0: "", pick_0_3: null, advancing: "" }]),
    { ...KONTEKST, phaseKey: "SWISS_STAGE1" },
  );

  assert.equal(bezTypow, null);
});

test("nieznana faza nie pyta bazy w ogole", async () => {
  const pool = fakePool([]);

  const wynik = await loadUserPhasePicks(pool, {
    ...KONTEKST,
    phaseKey: "NIE_MA_TAKIEJ",
  });

  assert.equal(wynik, null);
  assert.equal(pool.wywolania.length, 0, "poszlo zapytanie mimo nieznanej fazy");
});

test("brak tabeli gasi typy druzyn, ale nie caly widok", async () => {
  const blad = new Error("Table doesn't exist");

  blad.code = "ER_NO_SUCH_TABLE";

  const wynik = await loadUserPhasePicks(fakePool([], blad), {
    ...KONTEKST,
    phaseKey: "PLAYOFFS",
  });

  assert.equal(wynik, null);
});

test("inny blad bazy leci dalej, zamiast udawac brak typow", async () => {
  const blad = new Error("padlo polaczenie");

  blad.code = "ECONNRESET";

  await assert.rejects(
    () =>
      loadUserPhasePicks(fakePool([], blad), {
        ...KONTEKST,
        phaseKey: "PLAYOFFS",
      }),
    /padlo polaczenie/,
  );
});

/* ===============================
   PODZIAL TEKSTU NA DRUZYNY
   =============================== */

test("podzial druzyn jest ten sam, co w punktacji", () => {
  // calculateScores.js uzywa dzis dokladnie tej funkcji - sprawdzamy, ze
  // nadal ja importuje, a nie ma wlasnej kopii.
  const punktacja = fs.readFileSync(
    path.join(__dirname, "..", "handlers", "matches", "calculateScores.js"),
    "utf8",
  );

  assert.ok(
    punktacja.includes('require("../../utils/teamList")'),
    "calculateScores.js nie bierze podzialu z utils/teamList",
  );

  assert.ok(
    !/const cleanList = \(val\) => \{/.test(punktacja),
    "w calculateScores.js znow stoi wlasna kopia cleanList",
  );
});

test("podzial radzi sobie z przecinkami, srednikami i JSON-em", () => {
  assert.deepEqual(parseTeamList("NAVI, FaZe"), ["NAVI", "FaZe"]);
  assert.deepEqual(parseTeamList("NAVI; FaZe"), ["NAVI", "FaZe"]);
  assert.deepEqual(parseTeamList('["NAVI","FaZe"]'), ["NAVI", "FaZe"]);
  assert.deepEqual(parseTeamList("NAVI, , FaZe"), ["NAVI", "FaZe"]);
  assert.deepEqual(parseTeamList(""), []);
  assert.deepEqual(parseTeamList(null), []);
});

/* ===============================
   TEKST DO EMBEDA
   =============================== */

test("kazda grupa to jedna linia z etykieta", () => {
  const tekst = formatPhasePicks({
    groups: [
      { label: "Drużyny 3-0", teams: ["NAVI", "FaZe"] },
      { label: "Awansujące", teams: ["Spirit"] },
    ],
  });

  assert.equal(tekst, "**Drużyny 3-0:** NAVI, FaZe\n**Awansujące:** Spirit");
});

test("brak typow oddaje pusty napis, a nie naglowek bez tresci", () => {
  for (const wejscie of [null, undefined, {}, { groups: [] }]) {
    assert.equal(formatPhasePicks(wejscie), "");
  }
});

test("nawet skrajnie dluga lista miesci sie w polu embeda", () => {
  const teams = Array.from({ length: 80 }, (_, i) => `Bardzo Dluga Nazwa ${i}`);

  const tekst = formatPhasePicks({
    groups: [
      { label: "Drużyny 3-0", teams },
      { label: "Awansujące", teams },
    ],
  });

  const wartosc = truncate(tekst, LIMITS.EMBED_FIELD_VALUE);

  assert.ok(
    wartosc.length <= LIMITS.EMBED_FIELD_VALUE,
    `${wartosc.length} znakow`,
  );

  assert.ok(wartosc.length >= 1, "pole embeda nie moze byc puste");
});
