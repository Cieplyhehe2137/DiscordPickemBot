// Wynik meczu na stronie publicznej: /api/public/matches/:id/result.
//
// Galaz BO1 siegala wylacznie po match_results.exact_a/exact_b. Tam pisze
// formularz admina - ale nie kazdy wynik przychodzi ta droga. Caly Play-In
// IEM Cologne 2026 (40 meczow BO1) trafil do bazy hurtem, z wynikiem map
// w match_map_results, a exact_a/exact_b zostalo NULL-em. Efekt: karta
// "Rezultat" pokazywala same nazwy druzyn, bez ani jednej liczby, mimo ze
// punkty za ten mecz byly policzone - bo punkty licza sie z innej tabeli.
//
// Drugi brak: endpoint w ogole nie oddawal wyniku serii. Zatwierdzenie
// propozycji zewnetrznego dostawcy zapisuje samo res_a/res_b, bez ani jednej
// mapy (services/applyMatchResult.js), wiec suma wygranych map dawala 0:0 -
// liczbe nieprawdziwa, pokazana rownie pewnie jak prawdziwa.

const test = require("node:test");
const assert = require("node:assert/strict");

const PUBLIC_MATCHES = "../server/routes/publicMatches.js";

const GUILD = "1161660208951607397";
const EVENT = 37;
const MATCH = 501;

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  return {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return this;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return this;
    },
  };
}

// Atrapa puli: pierwsze zapytanie to mecz, drugie wynik serii, trzecie mapy.
// Rozrozniamy je po tresci SQL, a nie po kolejnosci - kolejnosc to szczegol
// implementacji, ktory ma prawo sie zmienic.
function fakePool({ match, result, maps = [] }) {
  return {
    async query(sql) {
      const tekst = String(sql);

      if (tekst.includes("FROM matches")) return [match ? [match] : []];
      if (tekst.includes("FROM match_results")) return [result ? [result] : []];
      if (tekst.includes("FROM match_map_results")) return [maps];

      throw new Error(`nieoczekiwane zapytanie: ${tekst}`);
    },
  };
}

// Rejestruje trasy na atrapie `app` i oddaje handler wyniku meczu.
async function handlerWyniku(pool) {
  const { registerPublicMatchRoutes } = await import(PUBLIC_MATCHES);

  let zlapany = null;

  const app = {
    get(sciezka, ...reszta) {
      if (sciezka === "/api/public/matches/:matchId/result") {
        zlapany = reszta[reszta.length - 1];
      }
    },
    post() {},
    patch() {},
    put() {},
    delete() {},
  };

  registerPublicMatchRoutes(app, zaleznosci(pool));

  assert.ok(zlapany, "trasa wyniku nie zostala zarejestrowana");
  return zlapany;
}

// Modul dostaje zaleznosci argumentem (patrz npm run deps). Tutaj liczy sie
// tylko pula i maxMapsFromBo - reszta idzie do tras, ktorych nie wolamy.
function zaleznosci(pool) {
  const { maxMapsFromBo } = require("../utils/mapLabels.js");

  return new Proxy(
    { pool, maxMapsFromBo },
    {
      get(cel, klucz) {
        if (klucz in cel) return cel[klucz];
        return () => {};
      },
    },
  );
}

async function wynik(dane) {
  const fn = await handlerWyniku(fakePool(dane));
  const res = fakeRes();

  await fn({ params: { matchId: String(dane.match?.id ?? MATCH) } }, res);

  return res.zapis;
}

const MECZ_BO1 = {
  id: MATCH,
  guild_id: GUILD,
  event_id: EVENT,
  best_of: 1,
};

test("BO1 z wynikiem tylko w tabeli map pokazuje wynik mapy", async () => {
  // Dokladnie ksztalt danych IEM Cologne: seria 1:0, exact puste,
  // prawdziwy wynik (13:10) w match_map_results.
  const { kod, tresc } = await wynik({
    match: MECZ_BO1,
    result: { res_a: 1, res_b: 0, exact_a: null, exact_b: null },
    maps: [{ map_no: 1, exact_a: 13, exact_b: 10 }],
  });

  assert.equal(kod, 200);
  assert.deepEqual(tresc.maps, [{ mapNo: 1, exactA: 13, exactB: 10 }]);
});

test("BO1 z wynikiem w match_results dziala jak dotad", async () => {
  const { tresc } = await wynik({
    match: MECZ_BO1,
    result: { res_a: 1, res_b: 0, exact_a: 13, exact_b: 7 },
    maps: [],
  });

  assert.deepEqual(tresc.maps, [{ mapNo: 1, exactA: 13, exactB: 7 }]);
});

test("przy BO1 match_results wygrywa ze starym wierszem mapy", async () => {
  // Mecz byl BO3, potem zmieniono format na BO1. Zmiana formatu nie kasuje
  // starych map, wiec mapa 1 jest pozostaloscia po poprzedniej serii.
  const { tresc } = await wynik({
    match: MECZ_BO1,
    result: { res_a: 0, res_b: 1, exact_a: 9, exact_b: 13 },
    maps: [{ map_no: 1, exact_a: 13, exact_b: 4 }],
  });

  assert.deepEqual(tresc.maps, [{ mapNo: 1, exactA: 9, exactB: 13 }]);
});

test("seria wraca w odpowiedzi, takze bez ani jednej mapy", async () => {
  // Wynik zatwierdzony z zewnetrznego dostawcy: sam res_a/res_b.
  const { tresc } = await wynik({
    match: { ...MECZ_BO1, best_of: 3 },
    result: { res_a: 2, res_b: 1, exact_a: null, exact_b: null },
    maps: [],
  });

  assert.deepEqual(tresc.series, { a: 2, b: 1 });
  assert.equal(
    tresc.maps.length,
    3,
    "miejsca na mapy zostaja, zeby front mial co filtrowac",
  );
  assert.ok(
    tresc.maps.every((m) => m.exactA === null && m.exactB === null),
    "pustych map nie wolno udawac zerami",
  );
});

test("BO3 z mapami oddaje je po kolei i uzupelnia braki", async () => {
  const { tresc } = await wynik({
    match: { ...MECZ_BO1, best_of: 3 },
    result: { res_a: 2, res_b: 0, exact_a: null, exact_b: null },
    maps: [
      { map_no: 1, exact_a: 13, exact_b: 8 },
      { map_no: 2, exact_a: 13, exact_b: 11 },
    ],
  });

  assert.equal(tresc.bestOf, 3);
  assert.equal(tresc.maxMaps, 3);
  assert.deepEqual(tresc.maps, [
    { mapNo: 1, exactA: 13, exactB: 8 },
    { mapNo: 2, exactA: 13, exactB: 11 },
    { mapNo: 3, exactA: null, exactB: null },
  ]);
  assert.deepEqual(tresc.series, { a: 2, b: 0 });
});

test("brak meczu i brak wyniku to 404, nie pusty wynik", async () => {
  const bezMeczu = await wynik({ match: null, result: null });
  assert.equal(bezMeczu.kod, 404);

  const bezWyniku = await wynik({ match: MECZ_BO1, result: null });
  assert.equal(bezWyniku.kod, 404);
});
