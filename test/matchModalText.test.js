const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const {
  SCORE_SUFFIX,
  playerPickTitle,
  officialResultTitle,
  scoreFieldLabel,
} = require("../utils/matchModalText");

const LIMIT = 45;

// Nazwy, ktore faktycznie sa w bazie, plus skrajnosci.
const NAZWY = [
  "100 Thieves",
  "Chinggis Warriors",
  "Ninjas in Pyjamas",
  "THUNDER dOWNUNDER",
  "Gaimin Gladiators",
  "Natus Vincere",
  "NAVI",
  "X".repeat(60),
  "Druzyna z naprawde bardzo dluga nazwa, ktora nikt nie powinien wpisac",
  "\u{1F525}\u{1F525}\u{1F525} Team Emoji \u{1F525}\u{1F525}\u{1F525}",
  "",
  null,
];

/* ===============================
   TYTUL GRACZA
   =============================== */

test("tytul BO1 dla meczu #607 miesci sie w limicie", () => {
  // Ten mecz wywalal modal: "Dokladny wynik: 100 Thieves vs Chinggis
  // Warriors" to 48 znakow, a ModalBuilder przyjmuje najwyzej 45.
  const tytul = playerPickTitle({
    maxMaps: 1,
    mapNo: 1,
    bestOf: 1,
    teamA: "100 Thieves",
    teamB: "Chinggis Warriors",
  });

  assert.ok(tytul.length <= LIMIT, `${tytul.length} znakow: "${tytul}"`);
  assert.ok(tytul.includes("100 Thieves"), `zgubiona nazwa: "${tytul}"`);
  assert.ok(tytul.includes("Chinggis"), `zgubiona nazwa: "${tytul}"`);
  assert.ok(tytul.includes(" vs "), `zgubiony separator: "${tytul}"`);
});

test("tytul BO1 miesci sie w limicie dla kazdej pary nazw", () => {
  for (const a of NAZWY) {
    for (const b of NAZWY) {
      const tytul = playerPickTitle({
        maxMaps: 1,
        mapNo: 1,
        bestOf: 1,
        teamA: a,
        teamB: b,
      });

      assert.ok(
        tytul.length >= 1 && tytul.length <= LIMIT,
        `${tytul.length} znakow dla "${a}" vs "${b}"`,
      );
    }
  }
});

test("tytul BO3/BO5 miesci sie w limicie i mowi, ktora to mapa", () => {
  for (const bo of [3, 5]) {
    for (let mapNo = 1; mapNo <= bo; mapNo += 1) {
      for (const nazwa of NAZWY) {
        const tytul = playerPickTitle({
          maxMaps: bo,
          mapNo,
          bestOf: bo,
          teamA: nazwa,
          teamB: nazwa,
        });

        assert.ok(
          tytul.length >= 1 && tytul.length <= LIMIT,
          `${tytul.length} znakow: BO${bo} mapa ${mapNo}, "${nazwa}"`,
        );
      }
    }
  }
});

test("tytul BO3 na krotkich nazwach dalej pokazuje pick druzyny", () => {
  const tytul = playerPickTitle({
    maxMaps: 3,
    mapNo: 2,
    bestOf: 3,
    teamA: "NAVI",
    teamB: "FaZe",
  });

  assert.ok(tytul.includes("Pick FaZe"), `"${tytul}"`);
});

test("tytul decidera nie gubi slowa Decider", () => {
  const tytul = playerPickTitle({
    maxMaps: 3,
    mapNo: 3,
    bestOf: 3,
    teamA: "X".repeat(60),
    teamB: "Y".repeat(60),
  });

  assert.ok(tytul.includes("Decider"), `"${tytul}"`);
  assert.ok(tytul.length <= LIMIT);
});

test("tytul BO1 bez nazw druzyn dalej jest poprawnym tytulem", () => {
  const tytul = playerPickTitle({
    maxMaps: 1,
    mapNo: 1,
    bestOf: 1,
    teamA: null,
    teamB: null,
  });

  assert.ok(tytul.length >= 1 && tytul.length <= LIMIT, `"${tytul}"`);
  assert.ok(!tytul.includes("null"), `wyciekl null: "${tytul}"`);
  assert.ok(!tytul.includes("undefined"), `wyciekl undefined: "${tytul}"`);
});

/* ===============================
   TYTUL ADMINISTRATORA
   =============================== */

test("tytul oficjalnego wyniku miesci sie w limicie dla kazdego BO", () => {
  for (const bo of [1, 3, 5]) {
    for (let mapNo = 1; mapNo <= bo; mapNo += 1) {
      const tytul = officialResultTitle({
        maxMaps: bo,
        mapNo,
        bestOf: bo,
      });

      assert.ok(
        tytul.length >= 1 && tytul.length <= LIMIT,
        `${tytul.length} znakow: BO${bo} mapa ${mapNo} -> "${tytul}"`,
      );
    }
  }
});

test("tytul oficjalnego wyniku w BO1 jest bez dopisku o mapie", () => {
  assert.equal(
    officialResultTitle({ maxMaps: 1, mapNo: 1, bestOf: 1 }),
    "Oficjalny dokładny wynik",
  );
});

/* ===============================
   ETYKIETY POL
   =============================== */

test("etykieta wyniku miesci sie w limicie dla kazdej nazwy i przyrostka", () => {
  const PRZYROSTKI = [
    SCORE_SUFFIX,
    " — wynik (np. 13)",
    " — wynik (np. 8)",
  ];

  for (const nazwa of NAZWY) {
    for (const przyrostek of PRZYROSTKI) {
      const etykieta = scoreFieldLabel(nazwa, przyrostek);

      assert.ok(
        etykieta.length >= 1 && etykieta.length <= LIMIT,
        `${etykieta.length} znakow dla "${nazwa}" + "${przyrostek}"`,
      );
    }
  }
});

test("etykieta wyniku zachowuje krotka nazwe w calosci", () => {
  assert.equal(scoreFieldLabel("100 Thieves"), "100 Thieves — wynik");
});

test("etykieta wyniku bez nazwy nie jest pusta", () => {
  for (const nazwa of [null, undefined, "", "   "]) {
    const etykieta = scoreFieldLabel(nazwa);

    assert.ok(etykieta.length >= 1, `pusta etykieta dla ${nazwa}`);
    assert.ok(!etykieta.includes("null"));
    assert.ok(!etykieta.includes("undefined"));
  }
});

/* ===============================
   PRAWDZIWE BUILDERY DISCORD.JS
   =============================== */

// Najmocniejszy test: ten sam walidator, ktory rzucil "Invalid string length"
// na produkcji. Jesli napisy sa za dlugie, setTitle/setLabel wywali sie tutaj.
test("prawdziwe buildery przyjmuja napisy dla kazdej pary nazw i kazdego BO", () => {
  for (const bo of [1, 3, 5]) {
    const maxMaps = bo;

    for (let mapNo = 1; mapNo <= maxMaps; mapNo += 1) {
      for (const a of NAZWY) {
        for (const b of NAZWY) {
          assert.doesNotThrow(() => {
            new ModalBuilder()
              .setCustomId("match_user_exact_submit")
              .setTitle(
                playerPickTitle({
                  maxMaps,
                  mapNo,
                  bestOf: bo,
                  teamA: a,
                  teamB: b,
                }),
              );

            new ModalBuilder()
              .setCustomId("match_admin_exact_submit")
              .setTitle(
                officialResultTitle({ maxMaps, mapNo, bestOf: bo }),
              );

            for (const przyrostek of [
              SCORE_SUFFIX,
              " — wynik (np. 13)",
              " — wynik (np. 8)",
            ]) {
              new TextInputBuilder()
                .setCustomId("exact_a")
                .setLabel(scoreFieldLabel(a, przyrostek))
                .setStyle(TextInputStyle.Short);

              new TextInputBuilder()
                .setCustomId("exact_b")
                .setLabel(scoreFieldLabel(b, przyrostek))
                .setStyle(TextInputStyle.Short);
            }
          }, `BO${bo} mapa ${mapNo}: "${a}" vs "${b}"`);
        }
      }
    }
  }
});

/* ===============================
   STRAZNIK: zadnego wstawiania nazw wprost
   =============================== */

const PLIKI_MODALI = [
  "handlers/matches/matchUserExactOpen.js",
  "handlers/matches/matchAdminExactOpen.js",
  "handlers/matches/matchAdminExactSubmit.js",
];

test("modale dokladnego wyniku nie skladaja tytulu ani etykiety z nazw wprost", () => {
  const ROOT = path.join(__dirname, "..");

  for (const rel of PLIKI_MODALI) {
    const tresc = fs.readFileSync(path.join(ROOT, rel), "utf8");

    assert.ok(
      tresc.includes('require("../../utils/matchModalText")'),
      `${rel} nie uzywa utils/matchModalText`,
    );

    // setTitle/setLabel z nazwa druzyny wstawiona w szablon - dokladnie tak
    // powstal blad "Invalid string length" przy meczu #607.
    const wprost = [
      ...tresc.matchAll(/\.set(?:Title|Label)\(([\s\S]{0,200}?)\)\s*\n/g),
    ].filter((m) => /\$\{\s*match\.team_[ab]\s*\}/.test(m[1]));

    assert.equal(
      wprost.length,
      0,
      `${rel}: nazwa druzyny wstawiona wprost w pole z limitem:\n${wprost
        .map((m) => m[0].trim())
        .join("\n")}`,
    );
  }
});
