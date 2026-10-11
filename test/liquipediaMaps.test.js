// Dostawca map: Liquipedia (server/lib/mapProviders/liquipedia.js).
//
// KSZTALT ODPOWIEDZI JEST NIEZWERYFIKOWANY. Liquipedia daje dokumentacje
// LPDB dopiero po przyznaniu klucza, a czytania ich stron HTML zabrania
// regulamin (serwer odrzuca - sprawdzone, HTTP 403). Fikstury nizej sa wiec
// PRAWDOPODOBNE, nie potwierdzone.
//
// Co z tego wynika dla tych testow: sprawdzaja to, co jest nasze i pewne -
// warunki regulaminu, parowanie meczu i to, ze wydobywanie nie wysypuje sie
// na nieznanym ksztalcie. Gdy zobaczymy prawdziwy rekord, dopisac go tutaj
// jako fiksture i zwezic sciezki w module.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/mapProviders/liquipedia.js";

/* ---------------- warunki regulaminu ---------------- */

test("KLUCZ NIE MOZE TRAFIC DO ADRESU", async () => {
  // Regulamin Liquipedii zabrania dzielenia sie kluczem, a adres laduje
  // w logach posrednikow i w historii. Klucz idzie wylacznie naglowkiem.
  const { buildLpdbRequest } = await import(MODUL);

  const zadanie = buildLpdbRequest({
    key: "TAJNY-KLUCZ-123",
    conditions: "[[parent::ESL_Pro_League/Season_24]]",
  });

  assert.equal(zadanie.ok, true);
  assert.equal(
    zadanie.url.includes("TAJNY-KLUCZ-123"),
    false,
    "klucz w adresie - to jest wyciek",
  );
  assert.equal(zadanie.headers.Authorization, "Apikey TAJNY-KLUCZ-123");
});

test("zadanie niesie wlasny User-Agent", async () => {
  // Anonimowe zapytania sa u nich odrzucane, a regulamin wymaga, zeby
  // dalo sie rozpoznac, kto pyta.
  const { buildLpdbRequest } = await import(MODUL);

  const { headers } = buildLpdbRequest({ key: "k" });

  assert.match(headers["User-Agent"], /PickEmBot/);
  assert.match(headers["User-Agent"], /pickembot\.pl/);
});

test("bez klucza nie powstaje zadne zadanie", async () => {
  const { buildLpdbRequest } = await import(MODUL);

  for (const zly of [undefined, null, "", 123]) {
    assert.equal(buildLpdbRequest({ key: zly }).ok, false);
  }
});

test("budzet zapytan miesci sie w ich limicie", async () => {
  // Ich limit to 60 na godzine. Przekroczenie to nie jest "wolniej",
  // tylko utrata dostepu.
  const { LIMIT_NA_GODZINE } = await import(MODUL);

  assert.ok(LIMIT_NA_GODZINE <= 60, `budzet ${LIMIT_NA_GODZINE} > 60`);
  assert.ok(LIMIT_NA_GODZINE > 0);
});

test("pytamy wiki counterstrike, nie ogolna", async () => {
  const { buildLpdbRequest } = await import(MODUL);

  assert.match(buildLpdbRequest({ key: "k" }).url, /wiki=counterstrike/);
});

/* ---------------- wydobywanie map ---------------- */

test("wyciaga mapy z rekordu, zachowujac kolejnosc", async () => {
  const { extractMapsFromMatch } = await import(MODUL);

  const w = extractMapsFromMatch({
    match2games: [{ map: "Mirage" }, { map: "Nuke" }, { map: "Inferno" }],
  });

  assert.equal(w.found, true);
  assert.deepEqual(w.names, ["Mirage", "Nuke", "Inferno"]);
});

test("radzi sobie z kilkoma mozliwymi ksztaltami", async () => {
  // Dopoki nie zobaczymy prawdziwego rekordu, modul zaglada w kilka miejsc.
  // Ten test pilnuje, ze kazde z nich dziala - a nie ze ktorys jest wlasciwy.
  const { extractMapsFromMatch } = await import(MODUL);

  const ksztalty = [
    { match2games: [{ map: "Ancient" }] },
    { games: [{ mapname: "Ancient" }] },
    { maps: [{ map_name: "Ancient" }] },
    { games: ["Ancient"] },
    { extradata: { games: [{ map: "Ancient" }] } },
  ];

  for (const k of ksztalty) {
    const w = extractMapsFromMatch(k);

    assert.equal(w.found, true, `nie poradzil sobie z ${JSON.stringify(k)}`);
    assert.deepEqual(w.names, ["Ancient"]);
  }
});

test("NIEZNANY KSZTALT nie wysypuje, tylko mowi ze nie znalazl", async () => {
  // To jest wazniejsze niz zgadniecie wlasciwej sciezki: nieznana
  // odpowiedz ma skonczyc sie pustym wynikiem i komunikatem, a nie
  // wyjatkiem w srodku skryptu zapisujacego do bazy.
  const { extractMapsFromMatch } = await import(MODUL);

  for (const smiec of [
    null,
    undefined,
    42,
    "tekst",
    {},
    { match2games: [] },
    { match2games: [{ winner: 1 }, { winner: 2 }] },
    { games: null },
    { get games() { throw new Error("zly getter"); } },
  ]) {
    const w = extractMapsFromMatch(smiec);

    assert.equal(w.found, false, "ten ksztalt dal falszywe trafienie");
    assert.deepEqual(w.names, []);
  }
});

test("dziura w srodku zostaje dziura, a nie znika", async () => {
  // Numer mapy musi sie zgadzac z numerem w match_map_results. Gdyby
  // nieznana mapa wypadla z listy, decider zapisalby sie jako mapa druga.
  const { extractMapsFromMatch } = await import(MODUL);

  const w = extractMapsFromMatch({
    match2games: [{ map: "Mirage" }, { winner: 2 }, { map: "Inferno" }],
  });

  assert.deepEqual(w.names, ["Mirage", null, "Inferno"]);
});

/* ---------------- parowanie z naszym meczem ---------------- */

const NASZ = {
  team_a: "Vitality",
  team_b: "MOUZ",
  start_time_utc: "2026-10-11 15:00:00",
};

test("paruje po druzynach I godzinie naraz", async () => {
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: NASZ,
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "MOUZ" },
      date: "2026-10-11 15:00:00",
    },
  });

  assert.equal(w.ok, true);
  assert.equal(w.roznicaMinut, 0);
});

test("TE SAME DRUZYNY w innym terminie to INNY mecz", async () => {
  // Vitality gra z MOUZ kilka razy w sezonie. Gdyby parowanie szlo po
  // samych nazwach, mapy z pazdziernika trafilyby do meczu z marca.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: NASZ,
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "MOUZ" },
      date: "2026-03-11 15:00:00",
    },
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /godziny odlegle/);
});

test("TA SAMA GODZINA, inne druzyny to inny mecz", async () => {
  // O 15:00 gra polowa turnieju.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: NASZ,
    rekord: {
      opponent1: { name: "FaZe" },
      opponent2: { name: "NAVI" },
      date: "2026-10-11 15:00:00",
    },
  });

  assert.equal(w.ok, false);
  assert.match(w.reason, /druzyny/);
});

test("jedna zgodna druzyna to ZA MALO", async () => {
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: NASZ,
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "FaZe" },
      date: "2026-10-11 15:00:00",
    },
  });

  assert.equal(w.ok, false);
});

test("opoznienie transmisji miesci sie w oknie", async () => {
  // Mecze zaczynaja sie pozniej, niz zapowiedziano - poprzedni sie przeciaga.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: NASZ,
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "MOUZ" },
      date: "2026-10-11 16:40:00",
    },
  });

  assert.equal(w.ok, true, "100 minut opoznienia to wciaz ten sam mecz");
});

test("brak godziny po ktorejkolwiek stronie NIE paruje", async () => {
  // Mecz bez godziny ("TBA") plus same nazwy to za malo, zeby zapisac
  // mapy do konkretnego wiersza.
  const { matchesOurMatch } = await import(MODUL);

  const bezNaszej = matchesOurMatch({
    nasz: { ...NASZ, start_time_utc: null },
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "MOUZ" },
      date: "2026-10-11 15:00:00",
    },
  });

  const bezIch = matchesOurMatch({
    nasz: NASZ,
    rekord: { opponent1: { name: "Vitality" }, opponent2: { name: "MOUZ" } },
  });

  assert.equal(bezNaszej.ok, false);
  assert.equal(bezIch.ok, false);
});

test("rozne zapisy nazwy druzyny i tak sie paruja", async () => {
  // teamKey() scala aliasy - ten sam slownik, ktory obsluguje logotypy.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: { ...NASZ, team_a: "Natus Vincere" },
    rekord: {
      match2opponents: [{ name: "NAVI" }, { name: "mouz" }],
      date: "2026-10-11T15:00:00Z",
    },
  });

  assert.equal(w.ok, true);
});

test("zrodlo nazywa sie tak samo jak w kolumnie source", async () => {
  // Atrybucja i ochrona wpisow recznych stoja na tym jednym napisie.
  const { ZRODLO } = await import(MODUL);

  assert.equal(ZRODLO, "liquipedia");
});

test("OBIE RODZINY ALIASOW dzialaja naraz", async () => {
  // To jest test, ktory wymusil ksztalt parowania. Sa dwa niezalezne
  // sposoby sprowadzenia nazwy do wspolnej postaci i kazdy obsluguje inne
  // przypadki:
  //
  //   tablica scalen    "Natus Vincere" = "NAVI"
  //   zdjecie ozdobnikow "Team Vitality" = "Vitality"
  //
  // Samo zdjecie ozdobnikow PSUJE pierwsza rodzine, bo omija tablice.
  // Dlatego druzyna ma zestaw kluczy, a nie jeden.
  const { matchesOurMatch } = await import(MODUL);

  const przypadki = [
    ["Natus Vincere", "NAVI", "tablica scalen"],
    ["NAVI", "Natus Vincere", "tablica scalen, w druga strone"],
    ["Team Vitality", "Vitality", "zdjecie ozdobnikow"],
    ["Vitality", "Team Vitality", "zdjecie ozdobnikow, w druga strone"],
    ["FaZe Clan", "FaZe", "tablica scalen"],
    ["MOUZ", "MOUZ Esports", "zdjecie ozdobnikow"],
  ];

  for (const [nasza, ich, dlaczego] of przypadki) {
    const w = matchesOurMatch({
      nasz: {
        team_a: nasza,
        team_b: "Spirit",
        start_time_utc: "2026-10-11 15:00:00",
      },
      rekord: {
        opponent1: { name: ich },
        opponent2: { name: "Spirit" },
        date: "2026-10-11 15:00:00",
      },
    });

    assert.equal(w.ok, true, `"${nasza}" vs "${ich}" (${dlaczego})`);
  }
});

test("AKADEMIA NIE UCHODZI za pierwsza druzyne", async () => {
  // Luzniejsze porownanie nazw ma koszt: "Vitality" i "Vitality Academy"
  // roznia sie jednym slowem organizacyjnym. Dlatego kazda z naszych dwoch
  // druzyn musi znalezc WLASNA druzyne po ich stronie - bez tego jedna
  // nazwa dopasowalaby sie dwa razy.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: {
      team_a: "Vitality",
      team_b: "MOUZ",
      start_time_utc: "2026-10-11 15:00:00",
    },
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "Vitality Academy" },
      date: "2026-10-11 15:00:00",
    },
  });

  assert.equal(w.ok, false, "MOUZ nie gra w tym meczu");
});

test("sama nazwa organizacyjna nie pasuje do wszystkiego", async () => {
  // "Team Esports" po zdjeciu ozdobnikow bylby pustym napisem. Gdyby pusty
  // klucz wszedl do zestawu, pasowalby do kazdej druzyny.
  const { matchesOurMatch } = await import(MODUL);

  const w = matchesOurMatch({
    nasz: {
      team_a: "Team Esports",
      team_b: "Gaming Clan",
      start_time_utc: "2026-10-11 15:00:00",
    },
    rekord: {
      opponent1: { name: "Vitality" },
      opponent2: { name: "MOUZ" },
      date: "2026-10-11 15:00:00",
    },
  });

  assert.equal(w.ok, false);
});
