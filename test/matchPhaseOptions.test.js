// Jedna lista faz meczu w czterech selectach panelu.
//
// "Dodaj mecz", "Wyczysc mecze fazy", "Wyniki meczow" i "Edytuj mecz"
// pytaja o te sama rzecz - faze, ktora wyladuje w kolumnie matches.phase -
// a kazdy z tych paneli mial te szesc opcji wklejone u siebie. Kopie byly
// jednakowe, ale nic ich nie pilnowalo: faza dodana w jednym panelu
// dawalaby mecze, ktorych pozostale nie widza, a usuniecie opcji z jednego
// zostawialoby mecze, do ktorych nie ma jak wpisac wyniku. Zadna z tych
// sytuacji nie daje bledu - panel po prostu nie pokazuje czesci turnieju.
//
// Po drugiej stronie selecta edycji stoja jeszcze dwa walidatory,
// editMatchPhase i editMatchModal, ktore mialy wlasne kopie tej samej
// szostki. Tam rozjazd juz daje blad, i to taki pod nosem administratora:
// panel pokazuje faze, a zapis odbija ja jako nieprawidlowa.
//
// Test laduje PRAWDZIWE handlery, a nie kopie listy: discord.js jest
// podstawiony atrapa przez Module._load, wiec nie potrzebuje node_modules
// i nic nie leci do Discorda. Liczy sie wylacznie to, jakie opcje dostaje
// kazdy z selectow.

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

  // Reszta builderow jest tu tylko po to, zeby ciezsze handlery dalo sie
  // w ogole zaladowac. Test nie oglada ani modala, ani embeda - kazda
  // metoda oddaje siebie i tyle.
  function pustyBuilder(...metody) {
    return class {
      constructor() {
        for (const metoda of metody) {
          this[metoda] = () => this;
        }
      }
    };
  }

  return {
    ActionRowBuilder,
    StringSelectMenuBuilder,

    ModalBuilder: pustyBuilder("setCustomId", "setTitle", "addComponents"),

    TextInputBuilder: pustyBuilder(
      "setCustomId",
      "setLabel",
      "setStyle",
      "setRequired",
      "setValue",
      "setPlaceholder",
    ),

    EmbedBuilder: pustyBuilder(
      "setColor",
      "setTitle",
      "setDescription",
      "setFooter",
      "addFields",
    ),

    ButtonBuilder: pustyBuilder(
      "setCustomId",
      "setLabel",
      "setStyle",
      "setDisabled",
      "setEmoji",
    ),

    TextInputStyle: { Short: 1, Paragraph: 2 },
    ButtonStyle: { Primary: 1, Secondary: 2, Success: 3, Danger: 4 },

    PermissionFlagsBits: {
      Administrator: "ADMINISTRATOR",
      ManageGuild: "MANAGE_GUILD",
    },
  };
}

// Podmiana na czas samego require: handler zaciaga discord.js na gorze pliku,
// wiec atrapa musi stac wtedy, a nie przy wywolaniu.
//
// `atrapy` to dodatkowe podmianki po dokladnej tresci require() - potrzebne
// przy handlerach, ktore poza discord.js siegaja jeszcze po winstona albo
// po pool bazy.
function zaladujModul(sciezka, atrapy = {}) {
  const oryginal = Module._load;

  Module._load = function (request, parent, isMain) {
    if (request === "discord.js") return atrapaDiscorda();

    if (Object.prototype.hasOwnProperty.call(atrapy, request)) {
      return atrapy[request];
    }

    return oryginal.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(sciezka)];
    return require(sciezka);
  } finally {
    Module._load = oryginal;
  }
}

function zaladujHandler(plik) {
  return zaladujModul(path.join(KATALOG, plik));
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

/* ---------------- panel edycji meczu ---------------- */

// editMatchSelect siega dalej niz trzy panele wyzej: loguje przez winstona
// i wchodzi do bazy przez withGuild. Jedno i drugie jest tu bez znaczenia -
// liczy sie select, ktory panel odsyla - wiec oba dostaja atrape, tak samo
// jak discord.js, i test dalej nie potrzebuje node_modules.
function atrapyEdycji(match) {
  return {
    "../../utils/logger": { logError() {}, logInfo() {} },

    "../../utils/guildContext": {
      withGuild(source, fn) {
        return fn({
          guildId: "1",
          pool: { query: async () => [[match]] },
        });
      },
    },
  };
}

async function selectEdycjiMeczu(match) {
  const handler = zaladujModul(
    path.join(KATALOG, "editMatchSelect.js"),
    atrapyEdycji(match),
  );

  const odeslane = [];

  await handler({
    isStringSelectMenu: () => true,
    customId: "edit_match_select",
    memberPermissions: { has: () => true },
    values: [String(match.id)],
    update(payload) {
      odeslane.push(payload);
    },
    reply(payload) {
      odeslane.push(payload);
    },
  });

  const [payload] = odeslane;
  assert.ok(payload, "editMatchSelect.js nie odeslalo zadnej odpowiedzi");

  const [row] = payload.components || [];
  assert.ok(row, "editMatchSelect.js nie odeslalo zadnego wiersza komponentow");

  const [select] = row.components;
  assert.ok(select, "editMatchSelect.js nie odeslalo zadnego selecta");

  return select;
}

test("select edycji to ta sama lista, tylko z zaznaczona faza", async () => {
  const match = {
    id: 7,
    event_id: 1,
    match_no: 3,
    team_a: "Natus Vincere",
    team_b: "FaZe",
    best_of: 3,
    start_time_utc: null,
    has_result: 0,
    phase: "playoffs",
  };

  const select = await selectEdycjiMeczu(match);

  assert.equal(
    select.customId,
    `edit_match_phase:${match.id}`,
    "editMatchSelect.js: inny select",
  );

  // Ten sam zestaw i ta sama kolejnosc, co w trzech pozostalych panelach.
  // Rozni je wylacznie default - i wlasnie on jest jedyna rzecza, ktora
  // temu panelowi wolno dolozyc od siebie.
  assert.deepEqual(
    select.options,
    matchPhaseOptions().map((opcja) => ({
      ...opcja,
      default: opcja.value === match.phase,
    })),
    "editMatchSelect.js: lista faz rozjechala sie z utils/matchPhases.js",
  );
});

test("zaznaczona jest ta faza, w ktorej mecz stoi teraz", async () => {
  // default musi isc za match.phase, a nie za pozycja na liscie. Gdyby
  // zaznaczenie przykleilo sie do stalego miejsca, panel otwieralby sie na
  // cudzej fazie, a admin zapisywalby ja, nie patrzac.
  for (const faza of matchPhaseOptions().map((opcja) => opcja.value)) {
    const select = await selectEdycjiMeczu({ id: 7, phase: faza, best_of: 3 });

    const zaznaczone = select.options
      .filter((opcja) => opcja.default)
      .map((opcja) => opcja.value);

    assert.deepEqual(zaznaczone, [faza], `faza ${faza}: zle zaznaczenie`);
  }
});

test("panel edycji nie trzyma wlasnej kopii listy", () => {
  const zrodlo = fs.readFileSync(
    path.join(KATALOG, "editMatchSelect.js"),
    "utf8",
  );

  assert.match(
    zrodlo,
    /require\("\.\.\/\.\.\/utils\/matchPhases"\)/,
    "editMatchSelect.js: nie bierze listy faz z utils/matchPhases.js",
  );

  assert.match(
    zrodlo,
    /matchPhaseOptions\(\)\.map\(/,
    "editMatchSelect.js: select nie jest karmiony sama wspolna lista",
  );

  assert.ok(
    !/value:\s*"(swiss_stage\d|playoffs|doubleelim|playin)"/.test(zrodlo),
    "editMatchSelect.js: faza wpisana na miejscu, zamiast wziecia z modulu",
  );
});

/* ---------------- walidatory po drugiej stronie selecta ---------------- */

// Wybor z selecta edycji wraca do dwoch handlerow i kazdy z nich mial
// wlasny Set tej samej szostki. Tu rozjazd nie konczy sie na niewidocznej
// fazie: panel pokazuje opcje, admin ja klika, a zapis odbija ja jako
// nieprawidlowa. Stad lista i tam ma byc ta sama, co w selekcie.
const WALIDATORY = ["editMatchPhase.js", "editMatchModal.js"];

test("walidatory faz biora liste z tego samego modulu", () => {
  for (const plik of WALIDATORY) {
    const zrodlo = fs.readFileSync(path.join(KATALOG, plik), "utf8");

    assert.match(
      zrodlo,
      /require\("\.\.\/\.\.\/utils\/matchPhases"\)/,
      `${plik}: nie bierze listy faz z utils/matchPhases.js`,
    );

    assert.ok(
      !/"(swiss_stage\d|doubleelim|playin)"/.test(zrodlo),
      `${plik}: faza wpisana na miejscu, zamiast wziecia z modulu`,
    );
  }
});

/* ---------------- auto-start zostaje osobno ---------------- */

test("select auto-startu trzyma sie phasesConfig, nie faz meczu", () => {
  // handlers/admin/autoStartEventSelect.js ma te same szesc wartosci i
  // mimo to NIE bierze ich stad - i to nie jest przeoczenie.
  //
  // Jego wybor sprawdza phasesConfig[phase] z utils/pickemPanelBuilder.js,
  // a nastepny ekran wypisuje phasesConfig[phase].label. Podpiecie go pod
  // utils/matchPhases.js zrobiloby dokladnie to, przed czym tamten modul
  // chroni: faza dopisana do faz meczu bylaby tam do wyboru i odpadalaby
  // przy zapisie jako "Niepoprawne dane auto-startu".
  //
  // Dlatego sprawdzamy go przy jego wlasnym zrodle prawdy. Test padnie i
  // wtedy, gdy phasesConfig pojedzie swoja droga, i wtedy, gdy ktos
  // przepnie ten select na matchPhaseOptions() - etykiety sa inne
  // ("Swiss Stage 1" kontra "Swiss — Stage 1").
  const { phasesConfig } = zaladujModul(
    path.join(__dirname, "..", "utils", "pickemPanelBuilder.js"),
  );

  const { phaseMenu } = zaladujModul(
    path.join(__dirname, "..", "handlers", "admin", "autoStartEventSelect.js"),
  );

  const [select] = phaseMenu(42).components;

  assert.equal(select.customId, "auto_start:phase_select:42");

  for (const opcja of select.options) {
    assert.ok(
      phasesConfig[opcja.value],
      `auto-start oferuje faze ${opcja.value}, ktorej phasesConfig nie zna`,
    );

    assert.equal(
      opcja.label,
      phasesConfig[opcja.value].label,
      `auto-start: etykieta ${opcja.value} rozjechala sie z phasesConfig`,
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
