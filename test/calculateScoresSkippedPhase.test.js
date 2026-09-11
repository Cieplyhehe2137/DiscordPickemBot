// Pominięta faza nie może kasować już policzonych punktów.
//
// calculateScores kasowało wszystkie tabele punktowe na starcie przebiegu,
// a dopiero potem liczyło fazę po fazie. Faza bez aktywnego wyniku była
// pomijana i zostawała pusta, mimo że miała wcześniej policzone punkty.
// W produkcji zabrało to IEM Kraków 2026 całe 1450 pkt za fazy: ranking
// spadł z 7788 na 7706, a jedenastu graczy wypadło z klasyfikacji.
//
// Test jedzie na atrapie puli - żadne zapytanie nie trafia do bazy. Liczy
// się wyłącznie to, JAKIE zapytania funkcja by wysłała.

const test = require("node:test");
const assert = require("node:assert");

const db = require("../db.js");

const GUILD_ID = "111";
const EVENT_ID = 42;

// Atrapa puli: zapamiętuje każde zapytanie i odpowiada pustym zbiorem,
// czyli udaje event, w którym ŻADNA faza nie ma aktywnego wyniku.
function utworzPuleBezWynikow() {
  const zapytania = [];

  const pool = {
    query(sql) {
      zapytania.push(String(sql));

      // mysql2 zwraca [rows, fields]; wszędzie pusto = brak wyników faz,
      // brak meczów, brak typów.
      return Promise.resolve([[], []]);
    },
    getConnection() {
      return Promise.resolve({
        query: pool.query,
        release() {},
        beginTransaction: () => Promise.resolve(),
        commit: () => Promise.resolve(),
        rollback: () => Promise.resolve(),
      });
    },
  };

  return { pool, zapytania };
}

function kasowania(zapytania) {
  const znalezione = [];

  for (const sql of zapytania) {
    const m = /DELETE\s+FROM\s+([a-z_]+)/i.exec(sql);

    if (m) {
      znalezione.push(m[1]);
    }
  }

  return znalezione;
}

async function uruchomNaPustce() {
  const { pool, zapytania } = utworzPuleBezWynikow();

  const oryginalny = db.getPoolForGuild;

  db.getPoolForGuild = () => pool;

  try {
    // Wymagane dopiero teraz - moduł czyta pulę przez db w czasie wywołania.
    const calculateScores = require("../handlers/matches/calculateScores.js");

    await calculateScores(GUILD_ID, EVENT_ID);
  } finally {
    db.getPoolForGuild = oryginalny;
  }

  return kasowania(zapytania);
}

test("faza bez aktywnego wyniku nie kasuje swoich punktów", async () => {
  const skasowane = await uruchomNaPustce();

  for (const tabela of [
    "swiss_scores",
    "playoffs_scores",
    "doubleelim_scores",
    "playin_scores",
    "mvp_scores",
  ]) {
    assert.ok(
      !skasowane.includes(tabela),
      `${tabela} zostało skasowane, mimo że faza nie miała aktywnego wyniku ` +
        `- to kasuje punkty, których nie ma czym zastąpić. Kasowania: ` +
        skasowane.join(", "),
    );
  }
});

test("leaderboard kasowany dopiero przy odbudowie, na końcu", async () => {
  const skasowane = await uruchomNaPustce();

  // Klasyfikację kasuje i odbudowuje w całości rebuildEventLeaderboard - samo
  // kasowanie jest więc poprawne, ale tylko na końcu przebiegu i tylko raz.
  // Wcześniej stało także na starcie, co znaczyło, że przerwany przebieg
  // zostawia pustą tabelę - a to jedyna kopia, jaka zostaje po zamkniętym
  // turnieju z cleanupem.
  assert.strictEqual(
    skasowane.filter((t) => t === "leaderboard").length,
    1,
    "leaderboard kasowany więcej niż raz; kasowania: " + skasowane.join(", "),
  );

  assert.strictEqual(
    skasowane[skasowane.length - 1],
    "leaderboard",
    "leaderboard nie jest ostatnim kasowaniem; kasowania: " +
      skasowane.join(", "),
  );
});

test("punkty za mecze są przeliczane bezwarunkowo", async () => {
  const skasowane = await uruchomNaPustce();

  // match_points powstaje ze zwykłego złączenia meczów, typów i wyników -
  // pusty wynik jest tu poprawną odpowiedzią, więc czyszczenie zostaje
  // bezwarunkowe. Test pilnuje, żeby ktoś nie "naprawił" tego przy okazji.
  assert.ok(
    skasowane.includes("match_points"),
    "match_points nie zostało przeliczone; kasowania: " + skasowane.join(", "),
  );
});
