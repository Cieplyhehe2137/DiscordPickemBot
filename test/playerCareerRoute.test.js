// Trasa profilu gracza ponad turniejami (server/routes/playerCareer.js).
//
// Atrapa puli - nic nie laczy sie z baza. Test liczy FALE zapytan, bo kazda
// to osobna podroz do bazy stojacej na innej maszynie niz API: zmierzone na
// serwerze 177 ms, niezaleznie od tego, ile wierszy wraca. Szesc zapytan
// rownolegle kosztuje jedna podroz, te same szesc po kolei - szesc.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/playerCareer.js";

const GRACZ = "111";

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
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

// Dwa starty tego samego gracza.
const STARTY = [
  {
    user_id: GRACZ,
    event_id: 2,
    name: "Drugi",
    slug: "drugi",
    is_archived: 0,
    rank_position: 30,
    uczestnicy: 509,
    total_points: 100,
  },
  {
    user_id: GRACZ,
    event_id: 1,
    name: "Pierwszy",
    slug: "pierwszy",
    is_archived: 1,
    rank_position: 5,
    uczestnicy: 523,
    total_points: 328,
  },
];

// Mecz pierwszy to niespodzianka (wygralo 9z, typowal je jeden z 41),
// drugi poszedl z faworytem.
const MECZE = [
  {
    id: 1,
    event_id: 1,
    phase: "SWISS_STAGE3",
    team_a: "Vitality",
    team_b: "9z",
    res_a: 0,
    res_b: 2,
    event_name: "Pierwszy",
    event_slug: "pierwszy",
    for_a: 40,
    for_b: 1,
    total: 41,
  },
  {
    id: 2,
    event_id: 1,
    phase: "PLAYOFFS",
    team_a: "Vitality",
    team_b: "FaZe",
    res_a: 2,
    res_b: 0,
    event_name: "Pierwszy",
    event_slug: "pierwszy",
    for_a: 35,
    for_b: 6,
    total: 41,
  },
];

// Gracz trafil niespodzianke i postawil na Vitality w drugim meczu.
const TYPY = [
  {
    match_id: 1,
    pred_a: 0,
    pred_b: 2,
    team_a: "Vitality",
    team_b: "9z",
    res_a: 0,
    res_b: 2,
  },
  {
    match_id: 2,
    pred_a: 2,
    pred_b: 0,
    team_a: "Vitality",
    team_b: "FaZe",
    res_a: 2,
    res_b: 0,
  },
];

const PROFIL = [{ displayname: "Z profilu", avatar: "abc" }];
const LOGOTYPY = [{ name_key: "vitality", logo_url: "https://x/v.png" }];
const NAZWA_Z_FAZ = [{ nazwa: "Z tabeli fazy" }];

function daneDla(sql, { profil = PROFIL, starty = STARTY, typy = TYPY } = {}) {
  // Kolejnosc sprawdzen ma znaczenie: zapytanie o mecze tez siega
  // match_predictions, tyle ze bez aliasu.
  if (sql.includes("`swiss_predictions`")) return NAZWA_Z_FAZ;
  if (sql.includes("team_logos")) return LOGOTYPY;
  if (sql.includes("FROM user_profiles")) return profil;
  if (sql.includes("FROM match_predictions p")) return typy;
  if (sql.includes("FROM leaderboard")) return starty;

  return MECZE;
}

function liczacaPula(licznik, dane = {}) {
  return {
    async query(sql) {
      licznik.zapytan += 1;

      return [daneDla(sql, dane), []];
    },
  };
}

async function zbuduj(pool) {
  const { registerPlayerCareerRoutes } = await import(MODUL);

  const app = fakeApp();

  registerPlayerCareerRoutes(app, { pool });

  const handler = app.trasy.get("GET /api/public/players/:userId");

  assert.ok(handler, "trasa musi byc zarejestrowana");

  return handler;
}

function req(userId = GRACZ) {
  return { params: { userId } };
}

test("wszystkie zapytania ida JEDNA fala", async () => {
  // Zadne z nich nie potrzebuje wyniku poprzedniego - wszystkie zaleza
  // wylacznie od identyfikatora gracza, znanego juz z adresu.
  let rozpoczete = 0;

  const bramki = [];

  const pool = {
    query(sql) {
      rozpoczete += 1;

      return new Promise((resolve) => {
        bramki.push(() => resolve([daneDla(sql), []]));
      });
    },
  };

  const handler = await zbuduj(pool);

  const odpowiedz = handler(req(), fakeRes());

  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));

  assert.equal(
    rozpoczete,
    6,
    `przed pierwsza odpowiedzia baza powinna dostac wszystkie szesc zapytan, dostala ${rozpoczete}`,
  );

  for (const otworz of bramki) otworz();

  await odpowiedz;
});

test("lista meczow jest wspolna, wiec drugi gracz jej nie odpytuje", async () => {
  // Pamiec obejmuje WYLACZNIE mecze - jedyna rzecz na tej stronie, ktora
  // nie zalezy od tego, czyj profil sie oglada.
  const licznik = { zapytan: 0 };

  const handler = await zbuduj(liczacaPula(licznik));

  await handler(req("111"), fakeRes());

  assert.equal(licznik.zapytan, 6, "pierwsze wejscie: szesc zapytan");

  await handler(req("222"), fakeRes());

  assert.equal(
    licznik.zapytan,
    11,
    "drugie wejscie ma pytac o piec rzeczy, nie o szesc",
  );
});

test("podsumowanie i starty trafiaja do odpowiedzi", async () => {
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  const t = res.zapis.tresc;

  assert.equal(res.zapis.kod, 200);
  assert.equal(t.summary.starts, 2);

  // #5 z 523 to TOP 1%, #30 z 509 to TOP 6% - srednio 3.5.
  assert.equal(t.summary.avg_top_percent, 3.5);
  assert.equal(t.summary.total_points, 428);
  assert.equal(t.summary.best.slug, "pierwszy");

  assert.deepEqual(
    t.starts.map((s) => s.slug),
    ["drugi", "pierwszy"],
  );
});

test("kontra liczy sie tylko z meczow, ktore byly niespodziankami", async () => {
  // Gracz oddal dwa typy, ale tylko jeden z meczow zaskoczyl wszystkich.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.contrarian.chances, 1);
  assert.equal(res.zapis.tresc.contrarian.hits, 1);
  assert.equal(res.zapis.tresc.contrarian.hit_rate, 100);
});

test("gracz bez zadnej okazji ma kontre rowna null, a nie zero", async () => {
  // Zero znaczy "byl przy takich meczach i nie trafil", a to co innego niz
  // "nie bylo go przy zadnym".
  const handler = await zbuduj(
    liczacaPula({ zapytan: 0 }, { typy: [TYPY[1]] }),
  );

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.contrarian, null);
});

test("nazwa dochodzi z tabel faz, gdy gracz nigdy sie nie logowal", async () => {
  // Z 638 typujacych 212 nie ma wiersza w user_profiles - bez tego zapasu
  // w naglowku strony stoi surowy identyfikator.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }, { profil: [] }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.player.displayname, "Z tabeli fazy");
  assert.equal(res.zapis.tresc.player.avatar, null);
});

test("profil wygrywa z zapisem z fazy", async () => {
  // Zapis z fazy pamieta nick z dnia typowania, a profil odswieza sie przy
  // kazdym logowaniu.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.player.displayname, "Z profilu");
  assert.equal(res.zapis.tresc.player.avatar, "abc");
});

test("logotyp druzyny dochodzi do zestawienia", async () => {
  // Bez niego w tej sekcji stalyby same szare kolka z litera, podczas gdy
  // kazda inna strona pokazuje prawdziwe herby.
  const handler = await zbuduj(
    liczacaPula(
      { zapytan: 0 },
      { typy: [TYPY[1], TYPY[1], TYPY[1]] },
    ),
  );

  const res = fakeRes();

  await handler(req(), res);

  const [d] = res.zapis.tresc.teams;

  assert.equal(d.team, "Vitality");
  assert.equal(d.picks, 3);
  assert.equal(d.logo, "https://x/v.png");
});

test("odpowiedz niesie progi, a nie tylko dane", async () => {
  // Strona ma powiedziec wprost, ilu typow brakuje do sekcji o druzynach -
  // zamiast po cichu pokazywac pustke.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.tresc.min_chances, 12);
  assert.equal(res.zapis.tresc.min_team_picks, 3);
  assert.equal(res.zapis.tresc.picks_total, 2);
});

test("gracz bez startow i bez typow to czterysta cztery", async () => {
  // Pusta strona z cudzym identyfikatorem w naglowku wyglada jak awaria,
  // a nie jak "takiego gracza nie ma".
  const handler = await zbuduj(
    liczacaPula({ zapytan: 0 }, { starty: [], typy: [], profil: [] }),
  );

  const res = fakeRes();

  await handler(req("nie-ma-takiego"), res);

  assert.equal(res.zapis.kod, 404);
  assert.equal(res.zapis.tresc.code, "server.playerNotFound");
});

test("gracz z typami, ale bez klasyfikacji, dostaje strone", async () => {
  // Turniej moze nie miec jeszcze policzonej klasyfikacji, a typy juz sa.
  const handler = await zbuduj(liczacaPula({ zapytan: 0 }, { starty: [] }));

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.kod, 200);
  assert.equal(res.zapis.tresc.summary, null);
  assert.deepEqual(res.zapis.tresc.starts, []);
});

test("awaria bazy konczy sie piecsetka, a nie pusta strona", async () => {
  const pool = {
    async query() {
      throw new Error("baza padla");
    },
  };

  const handler = await zbuduj(pool);

  const res = fakeRes();

  await handler(req(), res);

  assert.equal(res.zapis.kod, 500);
  assert.equal(res.zapis.tresc.code, "server.playerCareerFailed");
});

test("zapytanie o starty liczy miejsca tym samym wzorem, co reszta serwisu", async () => {
  // Rozjazd dalby graczowi inne miejsce na tej stronie niz to, ktore widzi
  // w rankingu turnieju i w klasyfikacji wszech czasow.
  const fs = require("node:fs");
  const path = require("node:path");

  const tresc = fs.readFileSync(
    path.join(__dirname, "..", "server", "routes", "playerCareer.js"),
    "utf8",
  );

  assert.match(tresc, /PARTITION BY event_id/);
  assert.match(tresc, /COUNT\(\*\) OVER \(PARTITION BY event_id\)/);
  assert.match(
    tresc,
    /ORDER BY\s+COALESCE\(total_points, 0\) DESC,\s+user_id ASC/,
  );

  // Lista meczow NIE jest tu skopiowana, tylko wzieta z trasy niespodzianek.
  assert.match(tresc, /import \{ SQL_MECZE \} from "\.\/upsets\.js"/);
});
