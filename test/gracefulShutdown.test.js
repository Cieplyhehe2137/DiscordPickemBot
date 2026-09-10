// Zamykanie procesu kończy się process.exit, więc testujemy je w procesach
// potomnych - inaczej pierwszy przypadek ubiłby sam test.
//
// Asercje na komunikatach celowo trzymają się znaków ASCII: strumienie
// procesu potomnego bywają dekodowane różnie w zależności od systemu, a
// test ma sprawdzać zachowanie, nie kodowanie konsoli.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const HELPER = require.resolve("../utils/gracefulShutdown.js");

const SKRYPT = `
const { zarejestrujZamykanie } = require(${JSON.stringify(HELPER)});

const scenariusz = process.env.SCENARIUSZ;
const wykonane = [];

function krok(opis, dzialanie) {
  return {
    opis,
    async zrob() {
      wykonane.push(opis);
      await dzialanie();
    },
  };
}

const kroki =
  scenariusz === "wiszacy"
    ? [krok("wiszacy", () => new Promise(() => {}))]
    : [
        krok("pierwszy", async () => {}),
        krok("wybuchajacy", async () => {
          throw new Error("celowy blad");
        }),
        krok("wolny", () => new Promise((r) => setTimeout(r, 100))),
      ];

zarejestrujZamykanie({
  nazwa: "test",
  kroki,
  limitMs: scenariusz === "wiszacy" ? 250 : 8000,
});

process.on("exit", () => {
  console.log("KROKI:" + wykonane.join(","));
});

process.emit("SIGINT");

if (scenariusz === "podwojny") {
  process.emit("SIGTERM");
}

// Trzyma proces przy zyciu, gdyby zamykanie nigdy nie doszlo do konca.
setTimeout(() => {
  console.log("NIE_ZAMKNAL_SIE");
  process.exit(99);
}, 5000);
`;

function uruchom(scenariusz) {
  return spawnSync(process.execPath, ["-e", SKRYPT], {
    encoding: "utf8",
    env: { ...process.env, SCENARIUSZ: scenariusz },
    timeout: 20000,
  });
}

test("przechodzi wszystkie kroki po kolei i wychodzi z zerem", () => {
  const wynik = uruchom("normalny");

  assert.equal(wynik.status, 0, wynik.stderr);
  assert.match(wynik.stdout, /KROKI:pierwszy,wybuchajacy,wolny/);
  assert.match(wynik.stderr, /gotowe/);
});

test("nieudany krok jest zgłoszony, ale nie zatrzymuje reszty", () => {
  const wynik = uruchom("normalny");

  // Pula MySQL ma sie zamknac nawet wtedy, gdy Discord nie odpowiada -
  // dlatego krok po wybuchajacym musi sie wykonac.
  assert.match(wynik.stdout, /wolny/);
  assert.match(wynik.stderr, /celowy blad/);
  assert.equal(wynik.status, 0, "jeden bledny krok to nie powod do kodu bledu");
});

test("drugi sygnał przerywa zamykanie i wychodzi z jedynką", () => {
  const wynik = uruchom("podwojny");

  assert.equal(wynik.status, 1);
  assert.match(wynik.stderr, /po raz drugi/);
  assert.doesNotMatch(wynik.stdout, /wolny/, "nie dokańcza kroków po drugim sygnale");
});

test("krok, który nigdy nie wraca, kończy się bezpiecznikiem", () => {
  const wynik = uruchom("wiszacy");

  assert.equal(wynik.status, 1);
  assert.match(wynik.stderr, /przekroczone 250ms/);
  assert.doesNotMatch(wynik.stdout, /NIE_ZAMKNAL_SIE/, "bezpiecznik ma zadziałać przed limitem testu");
});

test("rejestruje dokładnie jeden handler na sygnał", () => {
  const wynik = spawnSync(
    process.execPath,
    [
      "-e",
      `const { zarejestrujZamykanie } = require(${JSON.stringify(HELPER)});
       zarejestrujZamykanie({ nazwa: "x", kroki: [] });
       process.stdout.write(
         process.listenerCount("SIGINT") + "," + process.listenerCount("SIGTERM"),
       );`,
    ],
    { encoding: "utf8", timeout: 20000 },
  );

  assert.equal(wynik.stdout, "1,1");
});
