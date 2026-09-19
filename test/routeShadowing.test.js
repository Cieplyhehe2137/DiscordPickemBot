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

test("niespodzianki sa rejestrowane przed trasa, ktora je przeslania", async () => {
  // /api/public/upsets ma jeden segment, tak samo jak teams, scoring
  // i all-time. Czwarty raz ta sama pulapka - dlatego kazda nowa trasa
  // /api/public/<cos> dostaje tu wlasny przypadek, zamiast polegac na tym,
  // ze ktos pamieta o kolejnosci w app.js.
  const tresc = fs.readFileSync(APP, "utf8");

  const niespodzianki = pozycja(tresc, "registerUpsetsRoutes(app,");
  const przeslaniajaca = pozycja(tresc, "registerPickemConfigRoutes(app,");

  assert.ok(
    niespodzianki < przeslaniajaca,
    "registerUpsetsRoutes musi stac PRZED registerPickemConfigRoutes - " +
      "inaczej /api/public/upsets oddaje pusta strone serwera i kod 200",
  );
});

test("glosowanie na MVP ma TRZY segmenty i dlatego jest bezpieczne", async () => {
  // /api/public/events/:slug/mvp nie koliduje z :guildSlug, bo tamten
  // wzorzec lapie tylko jeden segment. Test istnieje z tego samego powodu,
  // co przy profilu gracza: przy trasie, ktora wyglada na bezpieczna,
  // najlatwiej przeoczyc skrocenie adresu.
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "mvp.js"),
    "utf8",
  );

  assert.ok(
    tresc.includes('app.get("/api/public/events/:slug/mvp"'),
    "trasa MVP musi miec trzy segmenty po /api/public/",
  );
});

test("profil gracza ponad turniejami ma DWA segmenty i dlatego jest bezpieczny", async () => {
  // Jedyna z ostatnich czterech stron, ktora NIE wpada w pulapke:
  // /api/public/players/:userId ma dwa segmenty po /api/public/, a wzorzec
  // przeslaniajacy lapie tylko jeden.
  //
  // Test istnieje wlasnie dlatego, ze ta trasa wyglada na bezpieczna. Gdyby
  // ktos kiedys skrocil ja do /api/public/player albo dolozyl warianat
  // z jednym segmentem, zachowanie zmieni sie po cichu - HTTP 200 i pusta
  // strona serwera zamiast profilu.
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "playerCareer.js"),
    "utf8",
  );

  assert.ok(
    tresc.includes('app.get("/api/public/players/:userId"'),
    "trasa profilu musi miec dwa segmenty po /api/public/ - " +
      "przy jednym przeslania ja /api/public/:guildSlug",
  );
});

test("rywale gracza maja CZTERY segmenty i dlatego sa bezpieczni", async () => {
  // /api/public/events/:slug/players/:userId/rivals nie koliduje
  // z :guildSlug, bo tamten wzorzec lapie tylko jeden segment.
  //
  // Przypadek istnieje z tego samego powodu, co przy MVP i profilu
  // ponad turniejami: wlasnie przy trasie, ktora wyglada na bezpieczna,
  // najlatwiej przeoczyc pozniejsze skrocenie adresu. Skrocenie do
  // /api/public/rivals zmieniloby zachowanie po cichu - HTTP 200
  // i pusta strona serwera zamiast sekcji.
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "rivals.js"),
    "utf8",
  );

  assert.ok(
    tresc.includes(
      '"/api/public/events/:slug/players/:userId/rivals"',
    ),
    "trasa rywali musi miec cztery segmenty po /api/public/",
  );
});

test("mapy sa rejestrowane przed trasa, ktora je przeslania", async () => {
  // /api/public/maps ma jeden segment, tak samo jak teams, scoring,
  // all-time i upsets. Piaty raz ta sama pulapka.
  const tresc = fs.readFileSync(APP, "utf8");

  const mapy = pozycja(tresc, "registerMapRoutes(app,");
  const przeslaniajaca = pozycja(tresc, "registerPickemConfigRoutes(app,");

  assert.ok(
    mapy < przeslaniajaca,
    "registerMapRoutes musi stac PRZED registerPickemConfigRoutes - " +
      "inaczej /api/public/maps oddaje pusta strone serwera i kod 200",
  );
});

test("trasa map ma dokladnie jeden segment po /api/public/", async () => {
  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "maps.js"),
    "utf8",
  );

  assert.ok(tresc.includes('app.get("/api/public/maps"'));
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
