// Glosowanie na MVP (server/lib/mvpVote.js).
//
// Zmierzone na produkcji, IEM Cologne Major 2026: 99 glosow, 31 kandydatow,
// trafily TRZY osoby. donk dostal 40 glosow, ZywOo 36, a wygral m0NESY
// z trzema. To jest najwieksza pomylka w historii serwisu i do tej pory
// nie bylo jej widac nigdzie poza panelem administratora.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/mvpVote.js";

function kandydat({
  candidate_id = 1,
  nickname = "gracz",
  team_name = "Team",
  votes = 0,
  is_winner = 0,
  event_id = 1,
  event_name = "Turniej",
  event_slug = "turniej",
} = {}) {
  return {
    candidate_id,
    nickname,
    team_name,
    votes,
    is_winner,
    event_id,
    event_name,
    event_slug,
  };
}

// Uklad z produkcji w mniejszej skali: dwaj faworyci i zwyciezca z marginesu.
function cologne() {
  return [
    kandydat({ candidate_id: 1, nickname: "donk", team_name: "Spirit", votes: 40 }),
    kandydat({ candidate_id: 2, nickname: "ZywOo", team_name: "Vitality", votes: 36 }),
    kandydat({ candidate_id: 3, nickname: "molodoy", team_name: "FURIA", votes: 5 }),
    kandydat({
      candidate_id: 4,
      nickname: "m0NESY",
      team_name: "Falcons",
      votes: 3,
      is_winner: 1,
    }),
    kandydat({ candidate_id: 5, nickname: "bez glosu", votes: 0 }),
  ];
}

// --- podzial glosow ----------------------------------------------------------

test("skutecznosc to procent glosow oddanych na zwyciezce", async () => {
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote(cologne());

  assert.equal(wynik.total_votes, 84);
  assert.equal(wynik.winner.nickname, "m0NESY");
  assert.equal(wynik.hit_rate, 4, "3 z 84 to cztery procent");
});

test("kandydat bez ani jednego glosu wypada z listy", async () => {
  // Kandydatow jest trzydziestu jeden, a glosy dostalo kilkunastu - pelna
  // lista bylaby w wiekszosci zerami.
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote(cologne());

  assert.ok(
    !wynik.candidates.some((k) => k.nickname === "bez glosu"),
    "kandydat bez glosow nie ma czego pokazac",
  );
});

test("ZWYCIEZCA zostaje na liscie nawet bez ani jednego glosu", async () => {
  // To nie jest przypadek teoretyczny do odhaczenia: cala sekcja istnieje
  // po to, zeby pokazac, jak daleko od zwyciezcy bylo glosowanie. Gdyby
  // wypadal przez brak glosow, znikalaby odpowiedz.
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote([
    kandydat({ candidate_id: 1, nickname: "faworyt", votes: 50 }),
    kandydat({ candidate_id: 2, nickname: "nikt go nie typowal", votes: 0, is_winner: 1 }),
  ]);

  assert.equal(wynik.winner.nickname, "nikt go nie typowal");
  assert.equal(wynik.hit_rate, 0);

  assert.deepEqual(
    wynik.candidates.map((k) => k.nickname),
    ["faworyt", "nikt go nie typowal"],
  );
});

test("procenty licza sie z WSZYSTKICH glosow, takze tych z odrzuconych wierszy", async () => {
  // Kandydat bez glosow nic nie wnosi, ale gdyby suma liczyla sie dopiero
  // po odsianiu listy, procenty sumowalyby sie do czegos innego niz sto.
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote([
    kandydat({ candidate_id: 1, nickname: "a", votes: 50 }),
    kandydat({ candidate_id: 2, nickname: "b", votes: 50, is_winner: 1 }),
    kandydat({ candidate_id: 3, nickname: "c", votes: 0 }),
  ]);

  assert.equal(wynik.total_votes, 100);

  const suma = wynik.candidates.reduce((s, k) => s + k.share, 0);

  assert.equal(suma, 100);
});

test("bez wskazanego zwyciezcy skutecznosc to null, a nie zero", async () => {
  // "Nikt nie trafil" i "nie wiadomo jeszcze, kto wygral" to dwie rozne
  // rzeczy, a zero mowiloby to pierwsze.
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote([
    kandydat({ candidate_id: 1, nickname: "a", votes: 10 }),
    kandydat({ candidate_id: 2, nickname: "b", votes: 5 }),
  ]);

  assert.equal(wynik.resolved, false);
  assert.equal(wynik.winner, null);
  assert.equal(wynik.hit_rate, null);
  assert.equal(wynik.total_votes, 15);
});

test("kolejnosc idzie od najczesciej typowanego", async () => {
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote(cologne());

  assert.deepEqual(
    wynik.candidates.map((k) => `${k.nickname} ${k.votes}`),
    ["donk 40", "ZywOo 36", "molodoy 5", "m0NESY 3"],
  );
});

test("przy rownej liczbie glosow zwyciezca stoi wyzej", async () => {
  // To on jest tu odpowiedzia na pytanie, wiec przy remisie nie moze
  // ladowac nizej przez kolejnosc alfabetyczna.
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote([
    kandydat({ candidate_id: 1, nickname: "aaa", votes: 10 }),
    kandydat({ candidate_id: 2, nickname: "zzz", votes: 10, is_winner: 1 }),
  ]);

  assert.deepEqual(
    wynik.candidates.map((k) => k.nickname),
    ["zzz", "aaa"],
  );
});

test("brak kandydatow nie wywala funkcji", async () => {
  const { buildMvpVote } = await import(MODUL);

  const wynik = buildMvpVote([]);

  assert.equal(wynik.total_votes, 0);
  assert.equal(wynik.resolved, false);
  assert.deepEqual(wynik.candidates, []);

  assert.deepEqual(buildMvpVote(null).candidates, []);
});

// --- pomylki ze wszystkich turniejow -----------------------------------------

test("glosowania ustawiaja sie od najgorzej odgadnietego", async () => {
  const { buildMvpMisses } = await import(MODUL);

  const wiersze = [
    // Turniej 1: trafilo 10%.
    kandydat({ event_id: 1, event_slug: "pierwszy", candidate_id: 1, nickname: "a", votes: 90 }),
    kandydat({ event_id: 1, event_slug: "pierwszy", candidate_id: 2, nickname: "b", votes: 10, is_winner: 1 }),

    // Turniej 2: trafilo 60%.
    kandydat({ event_id: 2, event_slug: "drugi", candidate_id: 3, nickname: "c", votes: 60, is_winner: 1 }),
    kandydat({ event_id: 2, event_slug: "drugi", candidate_id: 4, nickname: "d", votes: 40 }),
  ];

  const lista = buildMvpMisses(wiersze, { minVotes: 20 });

  assert.deepEqual(
    lista.map((t) => `${t.event_slug} ${t.hit_rate}%`),
    ["pierwszy 10%", "drugi 60%"],
  );
});

test("glosowanie bez wyniku nie jest pomylka, tylko brakiem odpowiedzi", async () => {
  const { buildMvpMisses } = await import(MODUL);

  const lista = buildMvpMisses(
    [
      kandydat({ event_id: 1, candidate_id: 1, nickname: "a", votes: 50 }),
      kandydat({ event_id: 1, candidate_id: 2, nickname: "b", votes: 50 }),
    ],
    { minVotes: 20 },
  );

  assert.deepEqual(lista, []);
});

test("garstka glosow nie liczy sie wcale", async () => {
  // Ten sam prog, co przy meczach, i z tego samego powodu.
  const { buildMvpMisses } = await import(MODUL);

  const lista = buildMvpMisses(
    [
      kandydat({ event_id: 1, candidate_id: 1, nickname: "a", votes: 2 }),
      kandydat({ event_id: 1, candidate_id: 2, nickname: "b", votes: 1, is_winner: 1 }),
    ],
    { minVotes: 20 },
  );

  assert.deepEqual(lista, []);
});

test("kazdy turniej dostaje wlasne podsumowanie, a nie wspolne", async () => {
  const { buildMvpMisses } = await import(MODUL);

  const wiersze = [
    kandydat({ event_id: 1, event_name: "Pierwszy", candidate_id: 1, nickname: "a", votes: 30 }),
    kandydat({ event_id: 1, event_name: "Pierwszy", candidate_id: 2, nickname: "b", votes: 10, is_winner: 1 }),
    kandydat({ event_id: 2, event_name: "Drugi", candidate_id: 3, nickname: "c", votes: 20, is_winner: 1 }),
    kandydat({ event_id: 2, event_name: "Drugi", candidate_id: 4, nickname: "d", votes: 20 }),
  ];

  const lista = buildMvpMisses(wiersze, { minVotes: 20 });

  const poNazwie = new Map(lista.map((t) => [t.event_name, t]));

  assert.equal(poNazwie.get("Pierwszy").total_votes, 40);
  assert.equal(poNazwie.get("Pierwszy").winner.nickname, "b");

  assert.equal(poNazwie.get("Drugi").total_votes, 40);
  assert.equal(poNazwie.get("Drugi").winner.nickname, "c");
});
