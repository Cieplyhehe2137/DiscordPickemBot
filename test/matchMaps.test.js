// Mapy rozegrane w serii (server/lib/matchMaps.js).
//
// Tabela `match_maps` stoi w schemacie od poczatku i jest PUSTA - zero
// wierszy, nic do niej nie pisze. Dlatego serwis nigdy nie powiedzial ani
// slowa o Mirage czy Nuke. Ten modul jest regula, ktora ja wypelnia, i wchodza
// przez nia OBIE drogi: wpis administratora i skrypt dociagajacy dane.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/matchMaps.js";

/* ---------------- ujednolicanie nazw ---------------- */

test("ten sam zapis mapy na pieciu sposobow daje jedna nazwe", async () => {
  // Administrator przepisuje z transmisji, skrypt dostaje identyfikator
  // z gry. Bez ujednolicenia ta sama mapa bylaby w bazie czterema roznymi
  // napisami i nic by sie po niej nie zgrupowalo.
  const { normalizeMapName } = await import(MODUL);

  for (const zapis of ["Dust II", "dust2", "de_dust2", "DUST 2", " dust-2 "]) {
    const w = normalizeMapName(zapis);

    assert.equal(w.name, "Dust II", `"${zapis}" powinno dac Dust II`);
    assert.equal(w.known, true);
  }
});

test("NIEZNANA MAPA PRZECHODZI - pula sie zmienia", async () => {
  // To jest decyzja, nie przeoczenie. Valve rotuje pule co kilka miesiecy;
  // twarda lista odrzucilaby pierwszy mecz na nowej mapie, i to w dniu,
  // w ktorym nikt nie bedzie szukal przyczyny w kodzie sprzed roku.
  const { normalizeMapName } = await import(MODUL);

  const w = normalizeMapName("Agency");

  assert.equal(w.name, "Agency");
  assert.equal(w.known, false, "ma przejsc, ale byc oznaczona jako nieznana");
});

test("smiec zamiast nazwy jest odrzucany", async () => {
  const { normalizeMapName } = await import(MODUL);

  for (const zly of [
    "",
    "   ",
    null,
    undefined,
    42,
    "https://example.com/mirage",
    "<script>alert(1)</script>",
    "x".repeat(65),
  ]) {
    assert.equal(
      normalizeMapName(zly),
      null,
      `${JSON.stringify(zly)} nie moze przejsc`,
    );
  }
});

/* ---------------- czyj pick ---------------- */

test("kolejnosc pickow zgadza sie z etykietami bota i frontu", async () => {
  // To jest straz nad JEDNA regula w trzech plikach. Gdyby ktos zmienil
  // kolejnosc w ktoryms z nich, baza mowilaby co innego niz ekran.
  const { pickedByForMap } = await import(MODUL);

  assert.deepEqual(
    [1, 2, 3].map((n) => pickedByForMap(n, 3)),
    ["TEAM_A", "TEAM_B", "DECIDER"],
  );

  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => pickedByForMap(n, 5)),
    ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B", "DECIDER"],
  );
});

test("w BO1 nikt nie pickuje", async () => {
  // Zostaje mapa, ktorej nie zbanowano - wiec DECIDER, a nie czyjs pick.
  const { pickedByForMap } = await import(MODUL);

  assert.equal(pickedByForMap(1, 1), "DECIDER");
});

test("mapa spoza zakresu formatu nie dostaje pickera", async () => {
  const { pickedByForMap } = await import(MODUL);

  assert.equal(pickedByForMap(4, 3), null);
  assert.equal(pickedByForMap(0, 3), null);
  assert.equal(pickedByForMap(1, 2), null, "BO2 nie istnieje w tym serwisie");
});

test("etykieta frontu i picked_by mowia o tym samym", async () => {
  // Dwa niezalezne pliki, jedna prawda. Etykieta mowi "Pick <druzyna>",
  // kolumna mowi TEAM_A - ten test sprawdza, ze wskazuja te sama druzyne.
  const { pickedByForMap } = await import(MODUL);
  const { getMapLabel } = await import("../web/src/lib/mapLabels.js");

  for (const bo of [3, 5]) {
    for (let no = 1; no <= bo; no += 1) {
      const etykieta = getMapLabel(no, bo, "AAA", "BBB");
      const kolumna = pickedByForMap(no, bo);

      if (kolumna === "DECIDER") {
        assert.equal(etykieta, "Decider", `BO${bo} mapa ${no}`);
      } else {
        const oczekiwana = kolumna === "TEAM_A" ? "AAA" : "BBB";

        assert.equal(
          etykieta,
          `Pick ${oczekiwana}`,
          `BO${bo} mapa ${no}: etykieta i kolumna wskazuja inna druzyne`,
        );
      }
    }
  }
});

/* ---------------- skladanie wierszy ---------------- */

test("komplet map BO3 daje trzy gotowe wiersze", async () => {
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({
    bestOf: 3,
    names: ["de_mirage", "Nuke", "inferno"],
    source: "liquipedia",
  });

  assert.equal(w.ok, true);
  assert.deepEqual(w.rows, [
    { map_no: 1, map_name: "Mirage", picked_by: "TEAM_A", source: "liquipedia" },
    { map_no: 2, map_name: "Nuke", picked_by: "TEAM_B", source: "liquipedia" },
    { map_no: 3, map_name: "Inferno", picked_by: "DECIDER", source: "liquipedia" },
  ]);
  assert.deepEqual(w.unknown, []);
});

test("CZESCIOWO ZNANE VETO tez sie zapisuje", async () => {
  // Decider bywa znany dopiero po dwoch mapach. Lepiej zapisac to, co wiemy,
  // niz nie zapisac nic - puste miejsce po prostu nie tworzy wiersza.
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({ bestOf: 3, names: ["Mirage", "", null] });

  assert.equal(w.ok, true);
  assert.equal(w.rows.length, 1);
  assert.equal(w.rows[0].map_no, 1);
});

test("dziura w srodku nie przesuwa numerow map", async () => {
  // Gdyby puste miejsce zamykalo szereg, mapa trzecia zapisalaby sie jako
  // druga - i wynik mapy trafilby pod zly numer.
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({ bestOf: 3, names: ["Mirage", null, "Nuke"] });

  assert.equal(w.ok, true);
  assert.deepEqual(
    w.rows.map((r) => [r.map_no, r.map_name, r.picked_by]),
    [
      [1, "Mirage", "TEAM_A"],
      [3, "Nuke", "DECIDER"],
    ],
  );
});

test("wiecej map niz pozwala format jest odrzucane", async () => {
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({
    bestOf: 3,
    names: ["Mirage", "Nuke", "Inferno", "Ancient"],
  });

  assert.equal(w.ok, false);
  assert.equal(w.code, "server.tooManyMaps");
});

test("ta sama mapa dwa razy w serii to pomylka", async () => {
  // W CS kazda mapa pada w serii najwyzej raz, wiec powtorka znaczy, ze
  // ktos sie pomylil przy przepisywaniu.
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({ bestOf: 3, names: ["Mirage", "de_mirage", "Nuke"] });

  assert.equal(w.ok, false);
  assert.equal(w.code, "server.duplicateMap");
});

test("nieznane nazwy sa raportowane, ale nie blokuja", async () => {
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({ bestOf: 3, names: ["Mirage", "Agency", "Nuke"] });

  assert.equal(w.ok, true);
  assert.deepEqual(w.unknown, ["Agency"]);
  assert.equal(w.rows.length, 3);
});

test("zly format serii nie tworzy wierszy", async () => {
  const { buildMatchMaps } = await import(MODUL);

  for (const bo of [0, 2, 4, null, "trzy"]) {
    const w = buildMatchMaps({ bestOf: bo, names: ["Mirage"] });

    assert.equal(w.ok, false, `BO${bo} powinno zostac odrzucone`);
    assert.equal(w.code, "server.badBestOf");
  }
});

test("zrodlo trafia do kazdego wiersza i domyslnie jest reczne", async () => {
  // Domyslnie 'manual', bo tak jest bezpieczniej: wiersz bez podanego
  // zrodla ma byc chroniony przed nadpisaniem przez automat i nie ma
  // nosic cudzej atrybucji.
  const { buildMatchMaps } = await import(MODUL);

  const w = buildMatchMaps({ bestOf: 1, names: ["Ancient"] });

  assert.equal(w.rows[0].source, "manual");
  assert.equal(w.rows[0].picked_by, "DECIDER");
});
