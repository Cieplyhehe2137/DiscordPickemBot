// Klasyfikacja wszech czasow (server/lib/allTime.js).
//
// Caly ciezar tej funkcji jest w REGULE, nie w pobraniu danych, wiec testy
// pilnuja reguly. Kazdy z nich odpowiada na pytanie, ktore realnie padnie
// przy tabeli "kto typuje najlepiej": czemu ten jest wyzej od tamtego.
//
// Punkty NIE decyduja o kolejnosci i to jest tu najwazniejsze. Zmierzone na
// produkcji: max 316 pkt w Cologne, 47 w Budapeszcie, 156 w Krakowie. Ranking
// z sumy punktow bylby rankingiem tego, kto gral w Cologne.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/allTime.js";

// Jeden start gracza. Domyslnie stawka 100 osob, zeby miejsce czytalo sie
// wprost jako procent.
function start({
  user_id = "u1",
  event_id = 1,
  rank = 50,
  uczestnicy = 100,
  points = 0,
  name = "Turniej",
  slug = "turniej",
  displayname = "Gracz",
} = {}) {
  return {
    user_id,
    event_id,
    name,
    slug,
    rank_position: rank,
    uczestnicy,
    total_points: points,
    displayname,
    avatar: null,
  };
}

// --- percentyl --------------------------------------------------------------

test("percentyl liczy sie tak samo jak na profilu gracza", async () => {
  // Gracz widzi "TOP 3%" przy swoim starcie na profilu. Gdyby klasyfikacja
  // liczyla to inaczej, te same dane mowilyby dwie rozne rzeczy o tym samym
  // turnieju - i nikt by nie wiedzial, ktora jest prawdziwa.
  const { topPercent } = await import(MODUL);
  const { buildPlayerHistory } = await import("../server/lib/playerHistory.js");

  for (const [rank, total] of [
    [1, 523],
    [5, 262],
    [13, 509],
    [100, 100],
    [262, 262],
  ]) {
    const zProfilu = buildPlayerHistory(
      [{ event_id: 1, rank_position: rank, uczestnicy: total }],
      999,
    )[0].top_percent;

    assert.equal(
      topPercent(rank, total),
      zProfilu,
      `rozjazd przy ${rank} z ${total}`,
    );
  }
});

test("pierwsze miejsce to TOP 1%, nie TOP 0%", async () => {
  // Zaokraglenie w dol dawaloby przy 523 graczach "TOP 0%", co czyta sie
  // jak brak wyniku, a nie jak zwyciestwo.
  const { topPercent } = await import(MODUL);

  assert.equal(topPercent(1, 523), 1);
  assert.equal(topPercent(1, 1000000), 1);
});

test("brak miejsca albo pusta stawka nie daje percentyla", async () => {
  const { topPercent } = await import(MODUL);

  assert.equal(topPercent(0, 100), null);
  assert.equal(topPercent(5, 0), null);
  assert.equal(topPercent(null, null), null);
});

// --- prog startow -----------------------------------------------------------

test("jeden start nie wchodzi do tabeli", async () => {
  // To jest powod istnienia progu. Na prawdziwych danych pierwsza dwunastka
  // BEZ progu to sami gracze z jednym startem: pieciu z identycznym "TOP 1%",
  // a wsrod nich ktos z 43 punktami nad ludzmi z trzystoma.
  const { buildAllTime } = await import(MODUL);

  const tabela = buildAllTime([
    start({ user_id: "jednorazowy", rank: 1, uczestnicy: 523 }),
    start({ user_id: "staly", event_id: 1, rank: 20 }),
    start({ user_id: "staly", event_id: 2, rank: 20 }),
  ]);

  assert.deepEqual(
    tabela.map((g) => g.user_id),
    ["staly"],
    "gracz z jednym startem nie moze stac w tabeli nad kims z dwoma",
  );
});

test("prog da sie zmienic, ale domyslnie sa to dwa starty", async () => {
  const { buildAllTime } = await import(MODUL);

  const wiersze = [start({ user_id: "a" })];

  assert.equal(buildAllTime(wiersze).length, 0);
  assert.equal(buildAllTime(wiersze, { minStarts: 1 }).length, 1);
});

// --- kolejnosc --------------------------------------------------------------

test("nizszy sredni percentyl stoi wyzej", async () => {
  const { buildAllTime } = await import(MODUL);

  const tabela = buildAllTime([
    start({ user_id: "sredni", event_id: 1, rank: 10 }),
    start({ user_id: "sredni", event_id: 2, rank: 10 }),

    start({ user_id: "najlepszy", event_id: 1, rank: 3 }),
    start({ user_id: "najlepszy", event_id: 2, rank: 5 }),

    start({ user_id: "slaby", event_id: 1, rank: 80 }),
    start({ user_id: "slaby", event_id: 2, rank: 90 }),
  ]);

  assert.deepEqual(
    tabela.map((g) => g.user_id),
    ["najlepszy", "sredni", "slaby"],
  );

  assert.deepEqual(
    tabela.map((g) => g.rank),
    [1, 2, 3],
  );

  assert.equal(tabela[0].avg_top_percent, 4);
});

test("PUNKTY NIE DECYDUJA o kolejnosci", async () => {
  // Najwazniejszy test w tym pliku. Turnieje roznia sie liczba meczow siedem
  // razy, wiec suma punktow mowi glownie, w ktorym turnieju ktos gral.
  // Gdyby ktos kiedys "usprawnil" sortowanie o punkty, ta tabela cicho
  // zamienilaby sie w kopie rankingu najwiekszego eventu.
  const { buildAllTime } = await import(MODUL);

  const tabela = buildAllTime([
    // Wygral maly turniej i byl drugi w drugim - ale punktow ma malo.
    start({ user_id: "skuteczny", event_id: 1, rank: 1, points: 40 }),
    start({ user_id: "skuteczny", event_id: 2, rank: 2, points: 45 }),

    // Srodek stawki w duzych turniejach - ale punktow ma osiem razy wiecej.
    start({ user_id: "bogaty", event_id: 1, rank: 40, points: 300 }),
    start({ user_id: "bogaty", event_id: 2, rank: 45, points: 310 }),
  ]);

  assert.equal(tabela[0].user_id, "skuteczny");

  assert.ok(
    tabela[0].total_points < tabela[1].total_points,
    "wyzej stoi ten z MNIEJSZA liczba punktow - i tak ma byc",
  );
});

test("przy remisie wygrywa ten, kto utrzymal poziom dluzej", async () => {
  const { buildAllTime } = await import(MODUL);

  const tabela = buildAllTime([
    start({ user_id: "dwa", event_id: 1, rank: 10 }),
    start({ user_id: "dwa", event_id: 2, rank: 10 }),

    start({ user_id: "trzy", event_id: 1, rank: 10 }),
    start({ user_id: "trzy", event_id: 2, rank: 10 }),
    start({ user_id: "trzy", event_id: 3, rank: 10 }),
  ]);

  assert.equal(tabela[0].avg_top_percent, tabela[1].avg_top_percent);
  assert.equal(tabela[0].user_id, "trzy", "trzy starty bija dwa przy remisie");
});

test("kolejnosc jest powtarzalna przy pelnym remisie", async () => {
  // Bez ostatecznego rozstrzygniecia ci sami gracze ustawialiby sie za kazdym
  // razem inaczej, a tabela skakalaby przy odswiezeniu bez zmiany danych.
  const { buildAllTime } = await import(MODUL);

  const wiersze = [
    start({ user_id: "b", event_id: 1, rank: 10 }),
    start({ user_id: "b", event_id: 2, rank: 10 }),
    start({ user_id: "a", event_id: 1, rank: 10 }),
    start({ user_id: "a", event_id: 2, rank: 10 }),
  ];

  const pierwsza = buildAllTime(wiersze).map((g) => g.user_id);
  const druga = buildAllTime([...wiersze].reverse()).map((g) => g.user_id);

  assert.deepEqual(pierwsza, ["a", "b"]);
  assert.deepEqual(pierwsza, druga, "kolejnosc wierszy z bazy nie moze liczyc");
});

// --- najlepszy start --------------------------------------------------------

test("najlepszy start wybiera sie po MIEJSCU, nie po punktach", async () => {
  // Ta sama miara, na ktorej stoi cala tabela. Punkty wskazalyby tu turniej,
  // ktory po prostu mial wiecej meczow.
  const { buildAllTime } = await import(MODUL);

  const [gracz] = buildAllTime([
    start({
      user_id: "u",
      event_id: 1,
      rank: 3,
      uczestnicy: 300,
      points: 50,
      name: "Maly turniej",
      slug: "maly",
    }),
    start({
      user_id: "u",
      event_id: 2,
      rank: 60,
      uczestnicy: 300,
      points: 280,
      name: "Duzy turniej",
      slug: "duzy",
    }),
  ]);

  assert.equal(gracz.best.slug, "maly");
  assert.equal(gracz.best.rank, 3);
  assert.equal(gracz.best.participants, 300);
  assert.equal(gracz.best.top_percent, 1);
});

// --- dane niepelne ----------------------------------------------------------

test("start bez miejsca nie psuje sredniej", async () => {
  // Zdarza sie przy turnieju, w ktorym nikt nie ma jeszcze punktow. Taki
  // start nie mowi nic o skutecznosci, wiec nie moze jej ani podniesc,
  // ani obnizyc.
  const { buildAllTime } = await import(MODUL);

  const [gracz] = buildAllTime([
    start({ user_id: "u", event_id: 1, rank: 10 }),
    start({ user_id: "u", event_id: 2, rank: 20 }),
    start({ user_id: "u", event_id: 3, rank: 0, uczestnicy: 0 }),
  ]);

  assert.equal(gracz.starts, 2, "start bez miejsca nie liczy sie jako start");
  assert.equal(gracz.avg_top_percent, 15);
});

test("pusta baza nie wywraca tabeli", async () => {
  const { buildAllTime } = await import(MODUL);

  assert.deepEqual(buildAllTime([]), []);
  assert.deepEqual(buildAllTime(null), []);
  assert.deepEqual(buildAllTime(undefined), []);
});

test("srednia ma jedno miejsce po przecinku", async () => {
  // Srednia z dwoch startow daje polowki, a druga cyfra udawalaby dokladnosc,
  // ktorej tu nie ma.
  const { buildAllTime } = await import(MODUL);

  const [gracz] = buildAllTime([
    start({ user_id: "u", event_id: 1, rank: 3 }),
    start({ user_id: "u", event_id: 2, rank: 10 }),
    start({ user_id: "u", event_id: 3, rank: 11 }),
  ]);

  assert.equal(gracz.avg_top_percent, 8);
});

test("nazwa i awatar biora sie z pierwszego wiersza gracza", async () => {
  const { buildAllTime } = await import(MODUL);

  const [gracz] = buildAllTime([
    { ...start({ user_id: "u", event_id: 1, rank: 5 }), displayname: "Ciepły", avatar: "abc" },
    start({ user_id: "u", event_id: 2, rank: 5 }),
  ]);

  assert.equal(gracz.displayname, "Ciepły");
  assert.equal(gracz.avatar, "abc");
});
