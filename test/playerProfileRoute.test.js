// Trasa profilu gracza (server/routes/playerProfile.js).
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza. Testy sa tu glownie
// o WYDAJNOSCI, bo to ona byla zepsuta: kazde zapytanie to osobna podroz do
// bazy stojacej na innej maszynie niz API, zmierzone na produkcji okolo
// 165 ms, niezaleznie od tego, ile wierszy wraca.
//
// Profil robil tych podrozy ponad trzydziesci, jedna po drugiej, i wstawal
// szesc sekund - na kazdym turnieju tyle samo, bo koszt brali sie z LICZBY
// zapytan, a nie z ilosci danych. Dlatego test liczy fale, a nie milisekundy:
// milisekundy na cudzej maszynie nic nie znacza, a fala to jest ta wlasnie
// podroz, za ktora sie placi.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/playerProfile.js";

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
  };
}

// Atrapa puli liczaca fale. Fala to zestaw zapytan wystrzelonych, zanim
// ktorekolwiek z nich zdazylo wrocic.
function fakePool(odpowiedz) {
  const wywolania = [];

  let falaNr = 0;
  let wLocie = 0;

  return {
    wywolania,

    get fal() {
      return falaNr;
    },

    query(sql, args) {
      if (wLocie === 0) falaNr += 1;

      wLocie += 1;

      wywolania.push({ sql: String(sql), args, fala: falaNr });

      return new Promise((resolve) => {
        setTimeout(() => {
          wLocie -= 1;
          resolve([odpowiedz(String(sql)) ?? [], []]);
        }, 0);
      });
    },
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  const res = {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return res;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return res;
    },
  };

  return res;
}

const EVENT = { id: 7, guild_id: "g1", name: "IEM", slug: "iem" };

// Domyslnie kazde zapytanie oddaje pustke - poza tym o turniej, bo bez niego
// trasa konczy sie na 404 i reszta nigdy nie startuje.
function odpowiedzDomyslna(sql) {
  if (sql.includes("FROM events")) return [EVENT];

  return [];
}

async function wywolaj({ pool, userId = "u1", slug = "iem" }) {
  const { registerPlayerProfileRoutes } = await import(MODUL);

  const app = fakeApp();

  registerPlayerProfileRoutes(app, {
    assertPredictionsAllowed: () => {},
    isMatchDeadlinePassed: () => false,
    matchPanelPhaseFor: () => null,
    findNameFromPicks: async () => null,
    pool,
  });

  const handler = app.trasy.get(
    "GET /api/public/events/:slug/players/:userId",
  );

  assert.ok(handler, "trasa profilu musi byc zarejestrowana");

  const res = fakeRes();

  await handler({ params: { slug, userId } }, res);

  return res.zapis;
}

test("nieznany turniej konczy sie po jednym zapytaniu", async () => {
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.wywolania.length, 1, "po 404 nie ma czego dopytywac");
});

test("wszystkie zapytania o gracza ida jedna fala", async () => {
  // To jest cala poprawka. Wczesniej bylo ich ponad trzydziesci, jedno po
  // drugim - kazde czekalo, az wroci poprzednie, chociaz zadne nie
  // potrzebowalo jego wyniku.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  const poEvencie = pool.wywolania.filter((w) => w.fala > 1);

  assert.ok(
    poEvencie.length >= 13,
    `oczekiwano co najmniej 13 zapytan o gracza, bylo ${poEvencie.length}`,
  );

  // Turniej (fala 1), potem wszystko o graczu. Typy druzyn dokladaja wlasna
  // druga fale tylko wtedy, gdy gracz cokolwiek obstawil - tu nie obstawil,
  // wiec calosc miesci sie w dwoch falach.
  assert.equal(pool.fal, 2, "turniej, a potem wszystko naraz");
});

test("liczba fal nie rosnie z liczba zapytan", async () => {
  // Straznik przed powrotem do pętli z await w srodku: gdyby ktos rozbil
  // Promise.all z powrotem na kolejne awaity, fal byloby tyle, co zapytan.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  assert.ok(
    pool.fal < pool.wywolania.length / 4,
    `fal ${pool.fal} przy ${pool.wywolania.length} zapytaniach - zapytania ida po kolei, nie razem`,
  );
});

test("gracz bez zadnych danych dostaje profil z zerami, a nie blad", async () => {
  // Kazde zapytanie oddaje pustke. Wczesniej wystarczylo, zeby jedno miejsce
  // czytalo pole z nieistniejacego wiersza i cala trasa konczyla sie
  // piecsetka zamiast pustym profilem.
  const pool = fakePool(odpowiedzDomyslna);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 200);

  const p = zapis.tresc.profile;

  assert.equal(p.total_points, 0);
  assert.equal(p.accuracy, 0);
  assert.equal(p.rank, null, "brak wiersza to brak miejsca, nie miejsce zerowe");
  assert.deepEqual(p.recent_predictions, []);
  assert.equal(zapis.tresc.event.slug, "iem");
});

test("dane trafiaja do wlasnych pol, a nie do sasiednich", async () => {
  // Rownolegle zapytania wracaja w dowolnej kolejnosci. Gdyby wyniki laczyc
  // z nazwami po kolejnosci powrotu zamiast po pozycji w Promise.all, liczby
  // wyladowalyby pod cudzymi nazwami - i nic by sie nie wywrocilo, bo to
  // nadal sa liczby.
  const pool = fakePool((sql) => {
    if (sql.includes("FROM events")) return [EVENT];
    if (sql.includes("FROM user_profiles"))
      return [{ user_id: "u1", displayname: "Ciepły", avatar: "abc" }];
    if (sql.includes("AS series_points"))
      return [{ total_points: 99, series_points: 60, map_points: 39 }];
    if (sql.includes("AS exact_series"))
      return [
        {
          total_predictions: 20,
          finished_predictions: 10,
          correct_winners: 7,
          exact_series: 3,
        },
      ];
    if (sql.includes("AS predicted_maps"))
      return [{ predicted_maps: 30, correct_maps: 18, exact_maps: 5 }];
    if (sql.includes("ROW_NUMBER"))
      return [{ rank_position: 4, total_points: 123 }];

    return [];
  });

  const zapis = await wywolaj({ pool });

  const p = zapis.tresc.profile;

  assert.equal(p.displayname, "Ciepły");
  assert.equal(p.avatar, "abc");

  // Punkty klasyfikacji ida z rankingu, a nie z sumy match_points - kafelki
  // "Ranking" i "Punkty" musza mowic to samo.
  assert.equal(p.rank, 4);
  assert.equal(p.total_points, 123);

  assert.equal(p.series_points, 60);
  assert.equal(p.map_points, 39);

  assert.equal(p.exact_series, 3);
  assert.equal(p.correct_winners, 7);
  assert.equal(p.finished_predictions, 10);

  assert.equal(p.predicted_maps, 30);
  assert.equal(p.correct_maps, 18);
  assert.equal(p.exact_maps, 5);

  // 7 z 10 zakonczonych typow.
  assert.equal(p.accuracy, 70);
});

test("awaria bazy konczy sie piecsetka, a nie polowicznym profilem", async () => {
  const pool = {
    query(sql) {
      if (String(sql).includes("FROM events")) {
        return Promise.resolve([[EVENT], []]);
      }

      return Promise.reject(new Error("baza padla"));
    },
  };

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 500);
  assert.ok(zapis.tresc.error);
});
