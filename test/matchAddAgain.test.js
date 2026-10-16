// Przycisk "Dodaj kolejny" w dodawaniu meczu (handlers/matches/matchAddFlow.js).
//
// Ten przycisk nie dzialal NIGDY. onAgain wolal onPhaseSelect, a ten czyta faze
// z `interaction.values` - czyli z pola, ktore ma select, a przycisk nie ma go
// wcale. Wychodzilo z tego `undefined`, czyli galaz bledu: kazde klikniecie
// konczylo sie "Nie wybrano fazy".
//
// Usterka byla niewidoczna z dwoch powodow. Po pierwsze komunikat brzmi jak
// wina admina ("nie wybrano"), a nie jak awaria. Po drugie pierwszy mecz
// dodawal sie poprawnie, wiec caly przeplyw wygladal na sprawny - padal dopiero
// drugi, a wtedy wystarczalo wpisac komende od nowa i nikt tego nie zglaszal.
//
// Dlatego te testy pilnuja CALEJ petli, a nie samego handlera: builder musi
// wlozyc faze w customId, router musi taki customId trafic, a handler musi go
// odczytac i postawic stan tak, zeby nastepny krok (wybor BO) dzialal. Test na
// sam handler przeszedlby nawet wtedy, gdyby przycisk przestal nosic faze.

const test = require("node:test");
const assert = require("node:assert/strict");

// withGuild trzeba podmienic PRZED wymaganiem matchAddFlow, bo handler
// destrukturyzuje je przy require - pozniejsza podmiana nie mialaby wplywu.
const guildContext = require("../utils/guildContext");
const oryginalneWithGuild = guildContext.withGuild;

guildContext.withGuild = async (source, fn) =>
  fn({ pool: fakePool(), guildId: "G1" });

const {
  onAgain,
  onBoSelect,
  buildAfterAddRow,
} = require("../handlers/matches/matchAddFlow");

const buttonMap = require("../maps/buttonMap");

test.after(() => {
  guildContext.withGuild = oryginalneWithGuild;
});

/* ---------------- atrapy ---------------- */

function fakePool() {
  return {
    query: async () => [[{ name: "Vitality" }, { name: "FaZe" }]],
  };
}

// Tak wyglada interakcja przycisku: ma customId, NIE ma `values`.
//
// Atrapa ZAPISUJE wyslane payloady i testy czytaja wlasnie je, a nie wartosc
// zwracana przez handler. onBoSelect robi `await withGuild(...)` bez `return`,
// wiec zwraca undefined - asercja na wyniku przechodzilaby wtedy falszywie,
// bo pusty tekst nie zawiera zadnego szukanego komunikatu.
function fakeInteraction({ customId = "", values } = {}) {
  const wyslane = [];

  const zapisz = async (payload) => {
    wyslane.push(payload);
    return payload;
  };

  return {
    customId,
    values,
    guildId: "G1",
    user: { id: "U1" },
    memberPermissions: { has: () => true },
    deferred: false,
    replied: false,
    update: zapisz,
    reply: zapisz,
    wyslane,
  };
}

// Ostatnia rzecz, ktora handler faktycznie pokazal uzytkownikowi.
function pokazane(interaction) {
  assert.ok(
    interaction.wyslane.length > 0,
    "handler nie wyslal zadnej odpowiedzi",
  );
  return interaction.wyslane.at(-1);
}

const tekst = (payload) => String(payload?.content || "");

const customIdy = (payload) =>
  (payload?.components || []).flatMap((row) =>
    row.toJSON().components.map((c) => c.custom_id),
  );

const idPrzyciskuDodajKolejny = (phase) =>
  buildAfterAddRow(42, phase)
    .toJSON()
    .components.map((c) => c.custom_id)
    .find((id) => id.startsWith("match_add_again"));

/* ---------------- petla: builder -> router -> handler ---------------- */

test("przycisk 'Dodaj kolejny' nosi faze w customId", () => {
  // Stan w pamieci nie wystarczy: jest czyszczony zaraz po dodaniu meczu
  // i nie przezylby restartu bota. Faza musi jechac w samym przycisku.
  assert.equal(idPrzyciskuDodajKolejny("playoffs"), "match_add_again:playoffs");
});

test("customId z faza nadal trafia do handlera matchAddAgain", () => {
  // Router dopasowuje po prefiksie. Gdyby dopasowywal tylko doslownie,
  // dodanie dwukropka wyslaloby przycisk w nicosc.
  const customId = idPrzyciskuDodajKolejny("swiss_stage1");

  const klucz = Object.keys(buttonMap).find((k) => customId.startsWith(k));

  assert.equal(
    buttonMap[klucz],
    "matchAddAgain",
    `customId "${customId}" nie trafia do handlera matchAddAgain`,
  );
});

test("klikniecie 'Dodaj kolejny' wraca do wyboru BO, a nie w blad", async () => {
  const przycisk = fakeInteraction({
    customId: idPrzyciskuDodajKolejny("playoffs"),
  });

  await onAgain(przycisk);
  const payload = pokazane(przycisk);

  assert.ok(
    !tekst(payload).includes("Nie wybrano fazy"),
    "przycisk nadal konczy sie bledem o niewybranej fazie",
  );

  assert.ok(
    tekst(payload).includes("playoffs"),
    "faza nie przetrwala klikniecia w przycisk",
  );

  assert.ok(
    customIdy(payload).includes("match_add_bo_select"),
    "po klikniecu nie pojawil sie wybor BO",
  );
});

test("po 'Dodaj kolejny' wybor BO dziala, a nie mowi 'Sesja wygasla'", async () => {
  // To jest wlasciwy dowod, ze handler postawil stan, a nie tylko odrysowal
  // ladny ekran: nastepny krok czyta ten stan i bez niego sie wywala.
  await onAgain(
    fakeInteraction({ customId: idPrzyciskuDodajKolejny("doubleelim") }),
  );

  const wyborBo = fakeInteraction({ values: ["3"] });
  await onBoSelect(wyborBo);
  const payload = pokazane(wyborBo);

  assert.ok(
    !tekst(payload).includes("Sesja wygas"),
    "stan nie zostal postawiony - wybor BO konczy sie wygasla sesja",
  );

  assert.ok(
    tekst(payload).includes("doubleelim"),
    "faza zgubila sie miedzy przyciskiem a wyborem BO",
  );

  assert.ok(
    customIdy(payload).includes("match_add_team_a_select"),
    "przeplyw nie doszedl do wyboru druzyny A",
  );
});

/* ---------------- przycisk sprzed poprawki ---------------- */

test("przycisk bez fazy pyta o faze, zamiast konczyc bledem", async () => {
  // Wiadomosci wyslane przed ta poprawka maja customId bez fazy. Takiego
  // przycisku nie naprawimy, ale nie wolno mu konczyc tym samym bledem.
  const stary = fakeInteraction({ customId: "match_add_again" });

  await onAgain(stary);
  const payload = pokazane(stary);

  assert.ok(
    !tekst(payload).includes("Nie wybrano fazy"),
    "stary przycisk nadal konczy sie bledem o niewybranej fazie",
  );

  assert.ok(
    customIdy(payload).includes("match_add_phase_select"),
    "stary przycisk nie wraca do wyboru fazy",
  );
});
