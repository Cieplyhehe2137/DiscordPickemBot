// Hurtowe kasowanie kandydatow MVP:
// POST /api/events/:slug/mvp/candidates/delete
//
// IEM Cologne ma 105 kandydatow, z czego 92 bez powiazan - kasowanie ich
// pojedynczo to 92 zadania. Trasa hurtowa robi to jednym.
//
// Wynik jest z natury MIESZANY: czesc kandydatow ma typy graczy albo jest
// zapisana jako zwyciezca, wiec przechodzi tylko reszta. Dlatego odpowiedz
// to zawsze 200 z rozbiciem na deleted/refused - i dlatego wiekszosc testow
// tutaj pilnuje wlasnie tego rozbicia, a nie samego kasowania.

const test = require("node:test");
const assert = require("node:assert/strict");

const EVENT_ADMIN = "../server/routes/eventAdmin.js";

const GUILD = "111";
const SLUG = "iem-cologne-major-2026";
const EVENT_ID = 37;

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

// Kandydaci podani jako mapa id -> { nickname, zwyciezca, typow }.
function fakePool(kandydaci, { event = { id: EVENT_ID } } = {}) {
  const skasowane = [];
  let transakcje = 0;

  function znajdz(params) {
    return kandydaci[Number(params[0])] ?? null;
  }

  const conn = {
    async query(sql, params) {
      if (String(sql).includes("DELETE FROM mvp_candidates")) {
        skasowane.push(Number(params[0]));
        return [{ affectedRows: 1 }];
      }
      throw new Error(`nieoczekiwane zapytanie w transakcji: ${sql}`);
    },
  };

  return {
    skasowane,
    get transakcje() {
      return transakcje;
    },
    conn,
    async query(sql, params) {
      const tekst = String(sql);

      if (tekst.includes("FROM events")) return [event ? [event] : []];

      if (tekst.includes("FROM mvp_candidates")) {
        const k = znajdz(params);
        return [k ? [{ id: Number(params[0]), nickname: k.nickname }] : []];
      }

      if (tekst.includes("FROM mvp_results")) {
        const k = kandydaci[Number(params[2])];
        return [[{ ile: k?.zwyciezca ? 1 : 0 }]];
      }

      if (tekst.includes("FROM mvp_predictions")) {
        const k = kandydaci[Number(params[2])];
        return [[{ ile: k?.typow ?? 0 }]];
      }

      throw new Error(`nieoczekiwane zapytanie: ${tekst}`);
    },
    // runInTransaction podstawiane nizej korzysta z tego licznika.
    _transakcja() {
      transakcje += 1;
    },
  };
}

async function handlerHurtowy(pool) {
  const { registerEventAdminRoutes } = await import(EVENT_ADMIN);

  let zlapany = null;

  const app = {
    get() {},
    delete() {},
    patch() {},
    put() {},
    post(sciezka, ...reszta) {
      if (sciezka === "/api/events/:slug/mvp/candidates/delete") {
        zlapany = reszta[reszta.length - 1];
      }
    },
  };

  registerEventAdminRoutes(app, {
    pool,
    requireGuildAdmin: () => () => {},
    guildIdFromEventSlug: () => GUILD,
    async runInTransaction(p, fn) {
      p._transakcja();
      return fn(p.conn);
    },
    // Reszta zaleznosci nie jest wolana przez te trase.
    FAZA_PANELU: {},
    FAZY_PANELU_CONFIG: {},
    emitDashboardRefresh: () => {},
    getCurrentDoubleElimResults: () => {},
    getCurrentPlayinResults: () => {},
    getCurrentPlayoffs: () => {},
    guildRegistry: { getAllGuildIds: () => [GUILD] },
    io: {},
    logInfo: () => {},
  });

  assert.ok(zlapany, "trasa hurtowa nie zostala zarejestrowana");
  return zlapany;
}

async function skasuj(kandydaci, ids, opcje) {
  const pool = fakePool(kandydaci, opcje);
  const fn = await handlerHurtowy(pool);
  const res = fakeRes();

  await fn(
    { params: { slug: SLUG }, guildId: GUILD, body: { ids } },
    res,
  );

  return { ...res.zapis, pool };
}

const LISTA = {
  1: { nickname: "donk" },
  2: { nickname: "m0NESY", zwyciezca: true },
  3: { nickname: "KSCERATO", typow: 3 },
  4: { nickname: "flameZ" },
};

test("kasuje tych bez powiazan i nazywa tych, ktorych nie", async () => {
  const { kod, tresc, pool } = await skasuj(LISTA, [1, 2, 3, 4]);

  // Wynik mieszany to nie blad - to wynik.
  assert.equal(kod, 200);
  assert.deepEqual(tresc.deleted.sort(), [1, 4]);
  assert.deepEqual(pool.skasowane.sort(), [1, 4]);

  assert.equal(tresc.refused.length, 2);

  const wgId = Object.fromEntries(tresc.refused.map((o) => [o.id, o]));

  assert.match(wgId[2].reason, /zwycięzca/i);
  assert.equal(wgId[2].nickname, "m0NESY");
  assert.match(wgId[3].reason, /wytypowany/i);
  assert.match(wgId[3].reason, /\b3\b/);
});

test("kasowanie idzie w jednej transakcji", async () => {
  // "Usun 92" ma dac 92 skasowane albo zadnego - nie polowe i blad w srodku.
  const { pool } = await skasuj(LISTA, [1, 4]);

  assert.equal(pool.transakcje, 1);
});

test("gdy nic nie przechodzi, transakcja sie nie otwiera", async () => {
  const { tresc, pool } = await skasuj(LISTA, [2, 3]);

  assert.deepEqual(tresc.deleted, []);
  assert.equal(tresc.refused.length, 2);
  assert.equal(pool.transakcje, 0, "pusta transakcja to zbedny zapis");
});

test("powtorzone id liczy sie raz", async () => {
  // Przy szybkim klikaniu to samo id potrafi trafic do zadania dwa razy;
  // bez odsiania kandydat bylby raz w deleted, a raz w refused.
  const { tresc, pool } = await skasuj(LISTA, [1, 1, 1]);

  assert.deepEqual(tresc.deleted, [1]);
  assert.deepEqual(pool.skasowane, [1]);
  assert.deepEqual(tresc.refused, []);
});

test("nieznane id trafia do odrzuconych, nie wywraca calosci", async () => {
  const { kod, tresc, pool } = await skasuj(LISTA, [1, 999]);

  assert.equal(kod, 200);
  assert.deepEqual(tresc.deleted, [1]);
  assert.equal(tresc.refused.length, 1);
  assert.equal(tresc.refused[0].id, 999);
  assert.equal(tresc.refused[0].nickname, null);
  assert.deepEqual(pool.skasowane, [1], "reszta ma przejsc mimo jednego zlego");
});

test("kasowanie jest zawezone do gildii i eventu", async () => {
  const { pool } = await skasuj(LISTA, [1]);

  // Atrapa zapisuje same id, wiec sprawdzamy przez zapytanie szukajace:
  // gdyby zabraklo warunkow, kandydat z cudzego eventu dalby sie skasowac.
  assert.deepEqual(pool.skasowane, [1]);
});

test("pusta lista i smieci to 400", async () => {
  for (const zle of [[], null, undefined, "1,2", {}]) {
    const { kod } = await skasuj(LISTA, zle);

    assert.equal(kod, 400, `${JSON.stringify(zle)} powinno dac 400`);
  }

  // Tablica z samymi niepoprawnymi identyfikatorami tez.
  const { kod } = await skasuj(LISTA, ["abc", 0, -3]);
  assert.equal(kod, 400);
});

test("ponad limit to odmowa, a nie petla zapytan", async () => {
  const duzo = Array.from({ length: 501 }, (_, i) => i + 1);

  const { kod, tresc, pool } = await skasuj(LISTA, duzo);

  assert.equal(kod, 400);
  assert.match(tresc.error, /500/);
  assert.deepEqual(pool.skasowane, []);
});

test("nieznany turniej to 404", async () => {
  const { kod } = await skasuj(LISTA, [1], { event: null });

  assert.equal(kod, 404);
});
