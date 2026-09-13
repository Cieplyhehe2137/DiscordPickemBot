// Kasowanie kandydata MVP: DELETE /api/events/:slug/mvp/candidates/:id.
//
// Zapis listy kandydatow nie kasuje niczego - ustawia starym wpisom
// is_active = 0 i dopisuje nowe. Lista w panelu pokazuje wszystkich, wiec
// rosla z kazdym zapisem i nie dalo sie z niej usunac literowki.
//
// Wazniejsze od samego kasowania sa tu ODMOWY. mvp_predictions.candidate_id
// NIE ma klucza obcego do mvp_candidates, wiec baza nie zatrzyma skasowania
// kandydata, ktorego ktos wytypowal - typ gracza zamieni sie w goly numer
// (exportClassification.js pisze wtedy "ID 42"). Ta trasa jest jedynym
// miejscem, ktore tego pilnuje, dlatego kazda odmowa ma tu wlasny test.

const test = require("node:test");
const assert = require("node:assert/strict");

const EVENT_ADMIN = "../server/routes/eventAdmin.js";

const GUILD = "111";
const SLUG = "iem-cologne-major-2026";
const EVENT_ID = 37;
const CANDIDATE_ID = 42;

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

// Atrapa puli rozpoznaje zapytania po tresci SQL, a nie po kolejnosci -
// kolejnosc to szczegol implementacji, ktory ma prawo sie zmienic.
function fakePool({ event = { id: EVENT_ID }, candidate, wynikow = 0, typow = 0 }) {
  const wykonane = [];

  return {
    wykonane,
    async query(sql, params) {
      const tekst = String(sql);
      wykonane.push({ sql: tekst, params });

      if (tekst.includes("FROM events")) return [event ? [event] : []];
      if (tekst.includes("FROM mvp_candidates")) {
        return [candidate ? [candidate] : []];
      }
      if (tekst.includes("FROM mvp_results")) return [[{ ile: wynikow }]];
      if (tekst.includes("FROM mvp_predictions")) return [[{ ile: typow }]];
      if (tekst.includes("DELETE FROM mvp_candidates")) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`nieoczekiwane zapytanie: ${tekst}`);
    },
  };
}

// Rejestruje trasy na atrapie `app` i oddaje handler kasowania (ostatni
// argument app.delete, czyli wlasciwy handler za requireGuildAdmin).
async function handlerKasowania(pool) {
  const { registerEventAdminRoutes } = await import(EVENT_ADMIN);

  let zlapany = null;

  const app = {
    get() {},
    post() {},
    patch() {},
    put() {},
    delete(sciezka, ...reszta) {
      if (sciezka === "/api/events/:slug/mvp/candidates/:candidateId") {
        zlapany = reszta[reszta.length - 1];
      }
    },
  };

  registerEventAdminRoutes(app, zaleznosci(pool));

  assert.ok(zlapany, "trasa kasowania kandydata nie zostala zarejestrowana");
  return zlapany;
}

// Modul dostaje zaleznosci argumentem (npm run deps). Liczy sie tylko pula;
// requireGuildAdmin musi zwrocic cokolwiek wywolywalnego, bo rejestracja
// wstawia go jako middleware - w tescie wolamy sam handler.
function zaleznosci(pool) {
  return new Proxy(
    { pool },
    {
      get(cel, klucz) {
        if (klucz in cel) return cel[klucz];
        return () => () => {};
      },
    },
  );
}

async function skasuj(dane, candidateId = CANDIDATE_ID) {
  const pool = fakePool(dane);
  const fn = await handlerKasowania(pool);
  const res = fakeRes();

  await fn(
    { params: { slug: SLUG, candidateId: String(candidateId) }, guildId: GUILD },
    res,
  );

  return { ...res.zapis, pool };
}

const KANDYDAT = { id: CANDIDATE_ID, nickname: "donk" };

test("kandydat bez powiazan znika z bazy", async () => {
  const { kod, tresc, pool } = await skasuj({ candidate: KANDYDAT });

  assert.equal(kod, 200);
  assert.deepEqual(tresc, { ok: true, deletedId: CANDIDATE_ID });

  const usuwajace = pool.wykonane.find((z) =>
    z.sql.includes("DELETE FROM mvp_candidates"),
  );

  assert.ok(usuwajace, "nie wykonano kasowania");
  assert.deepEqual(
    usuwajace.params,
    [CANDIDATE_ID, GUILD, EVENT_ID],
    "kasowanie musi byc zawezone do gildii i eventu",
  );
});

test("zwyciezca MVP nie daje sie skasowac", async () => {
  const { kod, tresc, pool } = await skasuj({
    candidate: KANDYDAT,
    wynikow: 1,
  });

  assert.equal(kod, 409);
  assert.match(tresc.error, /zwycięzca/i);
  assert.match(tresc.error, /donk/, "komunikat ma nazwac kandydata");
  assert.ok(
    !pool.wykonane.some((z) => z.sql.includes("DELETE FROM")),
    "przy odmowie nie wolno niczego skasowac",
  );
});

test("wytypowany kandydat nie daje sie skasowac", async () => {
  // Sedno sprawy: bez klucza obcego baza by na to pozwolila, a trzy typy
  // zostalyby bez nazwiska.
  const { kod, tresc, pool } = await skasuj({ candidate: KANDYDAT, typow: 3 });

  assert.equal(kod, 409);
  assert.match(tresc.error, /wytypowany/i);
  assert.match(tresc.error, /\b3\b/, "komunikat ma podac, ilu graczy dotyczy");
  assert.ok(
    !pool.wykonane.some((z) => z.sql.includes("DELETE FROM")),
    "przy odmowie nie wolno niczego skasowac",
  );
});

test("liczba graczy odmieniona pojedynczo dla jednego", async () => {
  const { tresc } = await skasuj({ candidate: KANDYDAT, typow: 1 });

  assert.match(tresc.error, /1 gracza/);
});

test("kandydat z innego eventu to 404, nie ciche skasowanie", async () => {
  // Zapytanie o kandydata jest zawezone do gildii i eventu, wiec brak wiersza
  // znaczy "nie twoj kandydat". Bez tego wystarczyloby znac id.
  const { kod, pool } = await skasuj({ candidate: null });

  assert.equal(kod, 404);

  const szukajace = pool.wykonane.find((z) =>
    z.sql.includes("FROM mvp_candidates"),
  );

  assert.deepEqual(szukajace.params, [CANDIDATE_ID, GUILD, EVENT_ID]);
});

test("nieznany turniej to 404", async () => {
  const { kod } = await skasuj({ event: null, candidate: KANDYDAT });

  assert.equal(kod, 404);
});

test("smieci zamiast identyfikatora to 400", async () => {
  for (const zle of ["abc", "0", "-1", "1.5"]) {
    const { kod } = await skasuj({ candidate: KANDYDAT }, zle);

    assert.equal(kod, 400, `"${zle}" powinno dac 400`);
  }
});
