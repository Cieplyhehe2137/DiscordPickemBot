// Przeslanianie tras w server/app.js.
//
// Express bierze PIERWSZA pasujaca trase, wiec kolejnosc rejestracji jest
// zachowaniem, a nie porzadkiem w pliku. W tym projekcie istnieje trasa
// /api/public/:guildSlug - wzorzec z jednym segmentem, ktory lapie KAZDY
// adres /api/public/cokolwiek.
//
// Kazda trasa /api/public/<cos> z jednym segmentem musi wiec byc
// zarejestrowana przed nia. Inaczej nie zwraca bledu: oddaje pusta strone
// serwera o nazwie "cos" i kod 200. Tak wlasnie zachowala sie lista druzyn
// po pierwszym wdrozeniu - HTTP 200, zero sladu bledu w logach.
//
// Test czyta app.js jako tekst, bo uruchomienie go wymaga bazy. Sprawdza
// dokladnie to, co zawiodlo: kolejnosc dwoch wywolan.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.join(__dirname, "..", "server", "app.js");
const OVERVIEW = path.join(
  __dirname,
  "..",
  "server",
  "routes",
  "publicOverview.js",
);

function pozycja(tekst, fragment) {
  const i = tekst.indexOf(fragment);

  assert.notEqual(i, -1, `nie znaleziono w app.js: ${fragment}`);

  return i;
}

test("trasa lapiaca kazdy adres /api/public/<cos> nadal istnieje", async () => {
  // Gdyby ktos ja usunal, ten zestaw testow przestaje miec sens i lepiej,
  // zeby zglosil to wprost, niz cicho przechodzil.
  const tresc = fs.readFileSync(OVERVIEW, "utf8");

  assert.ok(
    tresc.includes('app.get("/api/public/:guildSlug"'),
    "zmienil sie wzorzec trasy przeslaniajacej - sprawdz ten test",
  );
});

test("klasyfikacja wszech czasow jest rejestrowana przed trasa, ktora ja przeslania", async () => {
  // /api/public/all-time ma jeden segment, tak samo jak /api/public/teams
  // i /api/public/scoring. Trzeci raz ta sama pulapka.
  const tresc = fs.readFileSync(APP, "utf8");

  const wszechCzasow = pozycja(tresc, "registerAllTimeRoutes(app,");
  const przeslaniajaca = pozycja(tresc, "registerPickemConfigRoutes(app,");

  assert.ok(
    wszechCzasow < przeslaniajaca,
    "registerAllTimeRoutes musi stac PRZED registerPickemConfigRoutes - " +
      "inaczej /api/public/all-time oddaje pusta strone serwera i kod 200",
  );
});

test("druzyny sa rejestrowane przed trasa, ktora je przeslania", async () => {
  const tresc = fs.readFileSync(APP, "utf8");

  const druzyny = pozycja(tresc, "registerTeamRoutes(app,");

  // /api/public/:guildSlug rejestruje sie wewnatrz tego wywolania.
  const przeslaniajaca = pozycja(tresc, "registerPickemConfigRoutes(app,");

  assert.ok(
    druzyny < przeslaniajaca,
    "registerTeamRoutes musi stac PRZED registerPickemConfigRoutes - " +
      "inaczej /api/public/teams oddaje pusta strone serwera i kod 200",
  );
});

test("punktacja jest rejestrowana przed trasa, ktora ja przeslania", async () => {
  // Druga trasa w tym projekcie z jednym segmentem po /api/public/. Pierwsza
  // (lista druzyn) trafila na to juz po wdrozeniu.
  const tresc = fs.readFileSync(APP, "utf8");

  const punktacja = pozycja(tresc, "registerScoringRoutes(app,");

  const przeslaniajaca = pozycja(tresc, "registerPickemConfigRoutes(app,");

  assert.ok(
    punktacja < przeslaniajaca,
    "registerScoringRoutes musi stac PRZED registerPickemConfigRoutes - " +
      "inaczej /api/public/scoring oddaje pusta strone serwera i kod 200",
  );
});

test("punktacja ma dokladnie jeden segment po /api/public/", async () => {
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "scoring.js"),
    "utf8",
  );

  assert.ok(tresc.includes('app.get("/api/public/scoring"'));
});

test("lista druzyn ma dokladnie jeden segment po /api/public/", async () => {
  // To jest powod calego problemu. Trasa szczegolu (/api/public/teams/:name)
  // ma dwa segmenty i nigdy nie kolidowala - dlatego dzialala, kiedy lista
  // juz nie, co bylo mylace przy szukaniu przyczyny.
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "teams.js"),
    "utf8",
  );

  assert.ok(tresc.includes('app.get("/api/public/teams"'));
  assert.ok(tresc.includes('app.get("/api/public/teams/:name"'));
});
