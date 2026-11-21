// Czy widok "Moje typy" faktycznie pokazuje typy druzyn obok meczow.
//
// Moduly licza i formatuja poprawnie - to sprawdza test obok. Tu chodzi
// o PODLACZENIE: czy handler o nie pyta, czy wklada je do embeda i czy przy
// okazji nie zepsul przypadku, w ktorym fazy nie ma wcale.
//
// Discord nie jest potrzebny: handler bierze pule przez db.getPoolForGuild,
// wiec wystarczy ja podmienic i przechwycic editReply.

const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../db");

const showMyPredictions = require("../handlers/matches/showMyPredictions");

const EVENT = { id: 102, name: "PGL Major Singapore 2026" };

const MECZ = {
  id: 604,
  match_no: 1,
  team_a: "Heroic",
  team_b: "Imperial",
  best_of: 1,
  pred_a: 1,
  pred_b: 0,
  pred_exact_a: 13,
  pred_exact_b: 7,
  res_a: null,
  res_b: null,
  series_points: 0,
  map_points: 0,
  earned_points: 0,
  has_result: 0,
};

const TYPY_SWISS = {
  pick_3_0: "Team Liquid, PARIVISION",
  pick_0_3: "Imperial, Chinggis Warriors",
  advancing: "FaZe Clan, 100 Thieves, FlyQuest, Wildcard, Ninjas in Pyjamas, M80",
};

/**
 * Pula rozpoznajaca zapytanie po tresci, a nie po kolejnosci - czesc z nich
 * leci rownolegle, wiec kolejnosc nie jest ustalona.
 */
function fakePool({ matches = [], swiss = null, total = null }) {
  return {
    async query(sql) {
      if (sql.includes("FROM events")) return [[EVENT], []];

      if (sql.includes("COUNT(*) AS total")) {
        return [[{ total: total ?? matches.length }], []];
      }

      if (sql.includes("swiss_predictions")) {
        return [swiss ? [swiss] : [], []];
      }

      if (sql.includes("match_map_predictions")) return [[], []];

      if (sql.includes("FROM matches m")) return [matches, []];

      throw new Error(`nieoczekiwane zapytanie: ${sql.slice(0, 80)}`);
    },
  };
}

/** Interakcja, ktora zapamietuje, co handler probowal odpowiedziec. */
function fakeInteraction(phaseKey = "SWISS_STAGE1") {
  const odpowiedzi = [];

  return {
    odpowiedzi,
    customId: `my_predictions:${phaseKey}:102:0`,
    guildId: "123",
    user: { id: "u1" },
    deferred: false,
    replied: false,

    async deferReply() {
      this.deferred = true;
    },

    async editReply(payload) {
      odpowiedzi.push(payload);

      return payload;
    },

    async reply(payload) {
      odpowiedzi.push(payload);

      return payload;
    },
  };
}

async function uruchom({ matches = [], swiss = null, total = null, phaseKey }) {
  const oryginalna = db.getPoolForGuild;

  db.getPoolForGuild = () => fakePool({ matches, swiss, total });

  try {
    const interaction = fakeInteraction(phaseKey);

    await showMyPredictions(interaction);

    return interaction.odpowiedzi.at(-1);
  } finally {
    db.getPoolForGuild = oryginalna;
  }
}

/** Pola embeda jako zwykly obiekt. */
function pola(odpowiedz) {
  const embed = odpowiedz?.embeds?.[0];

  if (!embed) return {};

  const dane = typeof embed.toJSON === "function" ? embed.toJSON() : embed;

  const wynik = {};

  for (const f of dane.fields ?? []) wynik[f.name] = f.value;

  return wynik;
}

function opis(odpowiedz) {
  const embed = odpowiedz?.embeds?.[0];

  if (!embed) return "";

  const dane = typeof embed.toJSON === "function" ? embed.toJSON() : embed;

  return dane.description ?? "";
}

/* =============================== */

test("typy druzyn stoja w embedzie obok typow na mecze", async () => {
  // "swiss_stage1" malymi literami - dokladnie to niesie przycisk z panelu
  // (utils/pickemPanelBuilder.js), a nie "SWISS_STAGE1" z matches.phase.
  const odpowiedz = await uruchom({
    matches: [MECZ],
    swiss: TYPY_SWISS,
    phaseKey: "swiss_stage1",
  });

  const f = pola(odpowiedz);

  const typyDruzyn = f["🏆 Typy drużyn"];

  assert.ok(typyDruzyn, `brak pola z typami druzyn; pola: ${Object.keys(f)}`);

  assert.ok(typyDruzyn.includes("Team Liquid"), typyDruzyn);
  assert.ok(typyDruzyn.includes("Chinggis Warriors"), typyDruzyn);
  assert.ok(typyDruzyn.includes("Drużyny 3-0"), typyDruzyn);
  assert.ok(typyDruzyn.includes("Awansujące"), typyDruzyn);

  // ...a mecze nadal sa tam, gdzie byly.
  assert.ok(opis(odpowiedz).includes("Heroic"), "zniknely typy na mecze");
});

test("gracz bez typow druzyn dostaje embed bez tego pola", async () => {
  const odpowiedz = await uruchom({ matches: [MECZ], swiss: null });

  assert.deepEqual(pola(odpowiedz), {}, "pole doklejone mimo braku typow");
  assert.ok(opis(odpowiedz).includes("Heroic"), "zniknely typy na mecze");
});

test("faza bez meczow pokazuje same typy druzyn, zamiast ucinac widok", async () => {
  const odpowiedz = await uruchom({
    matches: [],
    total: 0,
    swiss: TYPY_SWISS,
  });

  assert.ok(odpowiedz.embeds?.length, "brak embeda - widok sie uciął");

  assert.ok(
    opis(odpowiedz).includes("Team Liquid"),
    `typy druzyn nie trafily do opisu: ${opis(odpowiedz)}`,
  );
});

test("brak meczow I brak typow dalej konczy sie komunikatem", async () => {
  const odpowiedz = await uruchom({ matches: [], total: 0, swiss: null });

  assert.match(String(odpowiedz.content), /Brak meczów/);
  assert.deepEqual(odpowiedz.embeds, []);
});

test("faza bez typowania druzyn nie psuje widoku meczow", async () => {
  // GROUPS nie ma wpisu w PHASE_PICK_SOURCES - handler ma to przejsc
  // spokojnie, bo pyta o typy tylko wtedy, gdy faza je ma.
  const odpowiedz = await uruchom({
    matches: [MECZ],
    swiss: TYPY_SWISS,
    phaseKey: "GROUPS",
  });

  assert.deepEqual(pola(odpowiedz), {});
  assert.ok(opis(odpowiedz).includes("Heroic"));
});

test("opis embeda nigdy nie jest pusty", async () => {
  // setDescription("") to blad buildera, nie pominiete pole - a blok meczu
  // teoretycznie moze wyjsc pusty.
  for (const przypadek of [
    { matches: [MECZ], swiss: TYPY_SWISS },
    { matches: [MECZ], swiss: null },
    { matches: [], total: 0, swiss: TYPY_SWISS },
  ]) {
    const odpowiedz = await uruchom(przypadek);

    if (!odpowiedz.embeds?.length) continue;

    assert.ok(
      opis(odpowiedz).length >= 1,
      "pusty opis embeda wywala sie na walidatorze",
    );
  }
});
