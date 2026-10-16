// Jedna lista faz meczu w trzech selectach panelu.
//
// "Dodaj mecz", "Wyczysc mecze fazy" i "Wyniki meczow" pytaja o te sama
// rzecz - faze, ktora wyladuje w kolumnie matches.phase - a kazdy z tych
// paneli mial te szesc opcji wklejone u siebie. Kopie byly jednakowe, ale
// nic ich nie pilnowalo: faza dodana w jednym panelu dawalaby mecze,
// ktorych dwa pozostale nie widza, a usuniecie opcji z jednego zostawialoby
// mecze, do ktorych nie ma jak wpisac wyniku. Zadna z tych sytuacji nie
// daje bledu - panel po prostu nie pokazuje czesci turnieju.
//
// Test laduje PRAWDZIWE handlery, a nie kopie listy: discord.js jest
// podstawiony atrapa przez Module._load, wiec nie potrzebuje node_modules
// i nic nie leci do Discorda. Liczy sie wylacznie to, jakie opcje dostaje
// kazdy z trzech selectow.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const { matchPhaseOptions } = require("../utils/matchPhases.js");

const KATALOG = path.join(__dirname, "..", "handlers", "matches");

// customId jest tu po to, zeby bylo widac, ze sprawdzany jest WLASCIWY
// select, a nie pierwszy komponent, jaki panel odeslal.
const SELECTY = [
  { plik: "openAddMatch.js", customId: "match_add_phase_select" },
  { plik: "openClearMatches.js", customId: "match_clear_phase_select" },
  { plik: "openMatchResults.js", customId: "match_admin_phase_select" },
];

/* ---------------- atrapa discord.js ---------------- */

// Buildery zapamietuja to, co im podano, i nic wiecej - caly interes tego
// testu to zawartosc addOptions().
function atrapaDiscorda() {
  class ActionRowBuilder {
    constructor() {
      this.components = [];
    }

    addComponents(...czesci) {
      this.components.push(...czesci.flat());
      return this;
    }
  }

  class StringSelectMenuBuilder {
    constructor() {
      this.customId = null;
      this.placeholder = null;
      this.options = [];
    }

    setCustomId(id) {
      this.customId = id;
      return this;
    }

    setPlaceholder(tekst) {
      this.placeholder = tekst;
      return this;
    }

    addOptions(...opcje) {
      this.options.push(...opcje.flat());
      return this;
    }
  }

  return {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    PermissionFlagsBits: {
      Administrator: "ADMINISTRATOR",
      ManageGuild: "MANAGE_GUILD",
    },
  };
}

// Podmiana na czas samego require: handler zaciaga discord.js na gorze pliku,
// wiec atrapa musi stac wtedy, a nie przy wywolaniu.
function zaladujHandler(plik) {
  const sciezka = path.join(KATALOG, plik);
  const oryginal = Module._load;

  Module._load = function (request, parent, isMain) {
    if (request === "discord.js") return atrapaDiscorda();
    return oryginal.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(sciezka)];
    return require(sciezka);
  } finally {
    Module._load = oryginal;
  }
}

function fakeInteraction() {
  const wyslane = [];

  return {
    wyslane,
    deferred: false,
    replied: false,
    // Panele admina pytaja o uprawnienia przed zbudowaniem selecta.
    memberPermissions: { has: () => true },
    reply(payload) {
      wyslane.push(payload);
    },
    editReply(payload) {
      wyslane.push(payload);
    },
  };
}

async function selectZPanelu(plik) {
  const handler = zaladujHandler(plik);
  const interaction = fakeInteraction();

  await handler(interaction);

  const [payload] = interaction.wyslane;
  assert.ok(payload, `${plik} nie odeslalo zadnej odpowiedzi`);

  const [row] = payload.components || [];
  assert.ok(row, `${plik} nie odeslalo zadnego wiersza komponentow`);

  const [select] = row.components;
  assert.ok(select, `${plik} nie odeslalo zadnego selecta`);

  return select;
}

/* ---------------- jedna lista, trzy panele ---------------- */

test("trzy selecty faz dostaja dokladnie te sama liste", async () => {
  for (const { plik, customId } of SELECTY) {
    const select = await selectZPanelu(plik);

    assert.equal(select.customId, customId, `${plik}: inny select`);

    // Porownanie z modulem, a nie miedzy panelami: samo "wszystkie trzy
    // maja to samo" przechodziloby tez wtedy, gdyby ktos rozjechal liste
    // we wszystkich trzech naraz.
    assert.deepEqual(
      select.options,
      matchPhaseOptions(),
      `${plik}: lista faz rozjechala sie z utils/matchPhases.js`,
    );
  }
});

test("zaden panel nie trzyma wlasnej kopii listy", () => {
  // Trzy jednakowe kopie przeszlyby test wyzej - a to wlasnie od nich sie
  // zaczelo. Stad drugie sprawdzenie: w zrodle nie ma gdzie sie rozjechac.
  for (const { plik } of SELECTY) {
    const zrodlo = fs.readFileSync(path.join(KATALOG, plik), "utf8");

    assert.match(
      zrodlo,
      /require\("\.\.\/\.\.\/utils\/matchPhases"\)/,
      `${plik}: nie bierze listy faz z utils/matchPhases.js`,
    );

    assert.match(
      zrodlo,
      /\.addOptions\(matchPhaseOptions\(\)\)/,
      `${plik}: select nie jest karmiony sama wspolna lista`,
    );

    assert.ok(
      !/value:\s*"(swiss_stage\d|playoffs|doubleelim|playin)"/.test(zrodlo),
      `${plik}: faza wpisana na miejscu, zamiast wziecia jej z modulu`,
    );
  }
});

/* ---------------- zawartosc listy ---------------- */

test("lista faz meczu to szesc znanych wartosci", () => {
  // Wartosci ida wprost do matches.phase, a etykiety widzi administrator
  // w trzech panelach naraz - zmiana jednej i drugiej nalezy do tego pliku.
  assert.deepEqual(matchPhaseOptions(), [
    { label: "Swiss — Stage 1", value: "swiss_stage1" },
    { label: "Swiss — Stage 2", value: "swiss_stage2" },
    { label: "Swiss — Stage 3", value: "swiss_stage3" },
    { label: "Playoffs", value: "playoffs" },
    { label: "Double Elim", value: "doubleelim" },
    { label: "Play-In", value: "playin" },
  ]);
});

test("fazy meczu to NIE lista faz deadline'u", () => {
  // VALID_PHASES z utils/deadlineRepository.js trzyma 'swiss' bez etapow,
  // bo deadline ustawia sie na calego Swissa naraz. Mecze maja etapy
  // osobno; podstawienie tamtej listy tutaj odrzucaloby poprawne fazy
  // meczow i zabieraloby panelom trzy czwarte Swissa.
  const wartosci = matchPhaseOptions().map((opcja) => opcja.value);

  assert.ok(
    !wartosci.includes("swiss"),
    "'swiss' bez etapu nie jest faza meczu",
  );

  for (const etap of ["swiss_stage1", "swiss_stage2", "swiss_stage3"]) {
    assert.ok(wartosci.includes(etap), `brakuje etapu ${etap}`);
  }
});

test("kazde wywolanie oddaje osobne obiekty", () => {
  // Buildery discord.js trzymaja podana opcje przez referencje. Gdyby trzy
  // selecty dostaly te sama tablice, pozniejsze setDefault() na jednym
  // panelu zmienialoby liste w dwoch pozostalych.
  const pierwsza = matchPhaseOptions();
  const druga = matchPhaseOptions();

  assert.notEqual(pierwsza, druga);
  assert.notEqual(pierwsza[0], druga[0]);

  pierwsza[0].label = "zmienione";

  assert.notEqual(matchPhaseOptions()[0].label, "zmienione");
});
