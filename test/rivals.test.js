// Rywale gracza w turnieju (server/lib/rivals.js).
//
// Zmierzone na produkcji: remisy to 48% wspolnych meczow, bo za 60% typow
// nie ma zadnych punktow, a dwa zera to remis. Dlatego prog i procent licza
// sie z meczow ROZSTRZYGNIETYCH miedzy dwojka graczy, a nie ze wspolnych -
// i to jest rzecz, ktora te testy pilnuja najmocniej.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/rivals.js";

/**
 * Wiersze jednego meczu: ile punktow wzial kazdy z wymienionych graczy.
 *
 * Skrot na potrzeby testow - w bazie to jeden wiersz na pare gracz-mecz.
 */
function mecz(matchId, punkty) {
  return Object.entries(punkty).map(([user_id, points]) => ({
    user_id,
    match_id: matchId,
    points,
  }));
}

/** N meczow, w kazdym ten sam uklad punktow. */
function serie(ile, punkty, odNumeru = 1) {
  return Array.from({ length: ile }, (_, i) =>
    mecz(odNumeru + i, punkty),
  ).flat();
}

// --- bilans ------------------------------------------------------------------

test("bilans liczy wygrane, przegrane i remisy po punktach za mecz", async () => {
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...mecz(1, { ja: 4, on: 0 }),
    ...mecz(2, { ja: 0, on: 4 }),
    ...mecz(3, { ja: 2, on: 2 }),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  assert.equal(rivals.length, 1);

  const [rywal] = rivals;

  assert.equal(rywal.user_id, "on");
  assert.equal(rywal.shared, 3);
  assert.equal(rywal.wins, 1);
  assert.equal(rywal.losses, 1);
  assert.equal(rywal.ties, 1);
});

test("procent liczy sie z ROZSTRZYGNIETYCH, nie ze wspolnych", async () => {
  // Dwie wygrane, zero porazek i osiem remisow. Ze wspolnych wyszloby 20%,
  // czyli gracz ogrywany - a on nie przegral ani razu.
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...serie(2, { ja: 4, on: 0 }, 1),
    ...serie(8, { ja: 0, on: 0 }, 3),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  assert.equal(rivals[0].shared, 10);
  assert.equal(rivals[0].decided, 2);
  assert.equal(rivals[0].win_percent, 100);
});

test("prog odsiewa po meczach rozstrzygnietych, choc wspolnych jest duzo", async () => {
  // Trzydziesci wspolnych, ale tylko piec rozstrzygnietych. Przy progu
  // postawionym na wspolnych ten rywal by wszedl - i pokazalby "80%"
  // policzone z czterech meczow.
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...serie(5, { ja: 4, on: 0 }, 1),
    ...serie(25, { ja: 0, on: 0 }, 6),
  ];

  const zProgiem = buildRivals(rows, "ja", { minDecided: 10 });

  assert.equal(zProgiem.rivals.length, 0, "piec rozstrzygnietych to za malo");
  assert.equal(zProgiem.total, 0);

  // ...ale wiadomo, ze przeciwnik w ogole byl - to rozni "nie ma z kim"
  // od "za malo razem".
  assert.equal(zProgiem.opponents, 1);
});

test("mecze, ktorych gracz nie obstawil, nie licza sie do niczego", async () => {
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...mecz(1, { ja: 4, on: 0 }),

    // Mecz bez wiersza gracza "ja" - sam fakt, ze ktos inny go obstawil,
    // nie czyni z niego wspolnego.
    ...mecz(2, { on: 4, ktos: 2 }),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  assert.equal(rivals.length, 1);
  assert.equal(rivals[0].shared, 1);
});

test("punkty sumuja sie tylko ze wspolnych meczow", async () => {
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...mecz(1, { ja: 4, on: 1 }),
    ...mecz(2, { ja: 2, on: 3 }),
    ...mecz(3, { on: 4 }),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  assert.equal(rivals[0].my_points, 6);
  assert.equal(rivals[0].their_points, 4, "czwarty punkt padl w meczu bez gracza");
});

test("gracz spoza turnieju nie ma rywali, a nie wywraca liczenia", async () => {
  const { buildRivals } = await import(MODUL);

  const wynik = buildRivals(mecz(1, { a: 4, b: 0 }), "nieobecny", {
    minDecided: 1,
  });

  assert.deepEqual(wynik.rivals, []);
  assert.equal(wynik.total, 0);
  assert.equal(wynik.opponents, 0);
});

test("brak wierszy nie wywraca liczenia", async () => {
  const { buildRivals } = await import(MODUL);

  assert.equal(buildRivals([], "ja").total, 0);
  assert.equal(buildRivals(null, "ja").total, 0);
  assert.equal(buildRivals(undefined, "ja").opponents, 0);
});

// --- nazwy -------------------------------------------------------------------

test("rywal dostaje nazwe i awatar z profilu", async () => {
  const { buildRivals } = await import(MODUL);

  const { rivals } = buildRivals(serie(3, { ja: 4, on: 0 }), "ja", {
    minDecided: 1,
    profiles: [{ user_id: "on", displayname: "Rywal", avatar: "abc" }],
  });

  assert.equal(rivals[0].displayname, "Rywal");
  assert.equal(rivals[0].avatar, "abc");
});

test("bez nazwy zostaje identyfikator, a nie puste miejsce", async () => {
  const { buildRivals } = await import(MODUL);

  const { rivals } = buildRivals(serie(3, { ja: 4, "123456789": 0 }), "ja", {
    minDecided: 1,
  });

  assert.equal(rivals[0].displayname, "123456789");
  assert.equal(rivals[0].avatar, null);
});

test("pierwszy wpis o graczu wygrywa - profil przed nazwa z fazy", async () => {
  // Ta sama kolejnosc, co na stronie niespodzianek: profil niesie awatar
  // i jest odswiezany przy logowaniu, zapis z fazy pamieta nick sprzed
  // turnieju.
  const { buildRivals } = await import(MODUL);

  const { rivals } = buildRivals(serie(3, { ja: 4, on: 0 }), "ja", {
    minDecided: 1,
    profiles: [
      { user_id: "on", displayname: "Z profilu", avatar: "abc" },
      { user_id: "on", displayname: "Z fazy" },
    ],
  });

  assert.equal(rivals[0].displayname, "Z profilu");
});

// --- odznaki -----------------------------------------------------------------

test("odznaki trafiaja do skrajnosci", async () => {
  const { buildRivals } = await import(MODUL);

  // Gracz bierze punkty w pierwszej polowie meczow, w drugiej nie.
  const mojePunkty = [4, 4, 4, 4, 4, 0, 0, 0, 0, 0];

  const rows = mojePunkty.flatMap((punkty, i) =>
    mecz(i + 1, {
      ja: punkty,

      // Zero zawsze: piec przegranych, potem piec remisow 0:0.
      ogrywany: 0,

      // Odwrotnie niz gracz: piec porazek, piec wygranych.
      rowny: i < 5 ? 0 : 4,

      // Komplet zawsze: piec remisow 4:4, potem piec wygranych.
      mocny: 4,
    }),
  );

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  const odznaki = Object.fromEntries(
    rivals.map((r) => [r.user_id, r.badges]),
  );

  assert.ok(odznaki.ogrywany.includes("best"), "ogrywany: 5-0, czyli 100%");
  assert.ok(odznaki.mocny.includes("worst"), "mocny: 0-5, czyli 0%");
  assert.ok(odznaki.rowny.includes("closest"), "rowny: 5-5, czyli 50%");

  // Najwiecej ROZSTRZYGNIETYCH, przy rownej liczbie wspolnych.
  assert.ok(odznaki.rowny.includes("most"));
});

test("przewage liczy sie w meczach, a nie w procentach", async () => {
  // Na produkcji procent dawal tu zly wynik: "najwieksza przewaga"
  // trafiala do bilansu 8-2 (80% z samego progu) zamiast do 46-27.
  // Najwyzszy procent zawsze wygrywa najmniejsza proba.
  const { buildRivals } = await import(MODUL);

  const rows = [
    // "maly" ma 8-2 na dziesieciu meczach: 80%.
    ...serie(8, { ja: 4, maly: 0 }, 1),
    ...serie(2, { ja: 0, maly: 4 }, 9),

    // "duzy" ma 46-27 na siedemdziesieciu trzech: 63%, ale +19 wobec +6.
    ...serie(46, { ja: 4, duzy: 0 }, 11),
    ...serie(27, { ja: 0, duzy: 4 }, 57),

    // Ktos trzeci, zeby odznaki skrajnosci w ogole sie przyznaly.
    ...serie(12, { ja: 0, gorszy: 4 }, 84),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 10 });

  const maly = rivals.find((r) => r.user_id === "maly");
  const duzy = rivals.find((r) => r.user_id === "duzy");

  assert.equal(maly.win_percent, 80, "maly ma WYZSZY procent...");
  assert.equal(duzy.win_percent, 63);

  assert.ok(
    duzy.badges.includes("best"),
    "...a mimo to odznaka nalezy do wiekszej przewagi",
  );

  assert.ok(!maly.badges.includes("best"));
});

test("przy dwoch rywalach nie ma odznak skrajnosci", async () => {
  // "Najwieksza przewaga" i "najwieksza strata" przy dwojce to po prostu
  // pierwszy i drugi - etykieta nie niesie wtedy informacji.
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...serie(5, { ja: 4, a: 0, b: 2 }, 1),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  assert.equal(rivals.length, 2);

  for (const r of rivals) {
    assert.deepEqual(r.badges, [], `${r.user_id} nie powinien miec odznaki`);
  }
});

test("gdy wszyscy maja ten sam procent, nie ma najlepszego ani najgorszego", async () => {
  const { buildRivals } = await import(MODUL);

  const rows = serie(4, { ja: 4, a: 0, b: 0, c: 0 });

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  for (const r of rivals) {
    assert.ok(!r.badges.includes("best"), `${r.user_id} nie jest lepszy od reszty`);
    assert.ok(!r.badges.includes("worst"), `${r.user_id} nie jest gorszy od reszty`);
  }

  // Najczestszy rywal to nadal fakt, nie skrajnosc wzgledem innych.
  assert.equal(
    rivals.filter((r) => r.badges.includes("most")).length,
    1,
  );
});

test("ten sam rywal moze miec dwie odznaki", async () => {
  // Najczestszy bywa jednoczesnie najrowniejszy - i to jest prawda o nim,
  // a nie blad. Dwa kafelki z ta sama twarza byly powodem, dla ktorego
  // odznaki sa etykietami w jednej liscie.
  const { buildRivals } = await import(MODUL);

  const rows = [
    ...serie(10, { ja: 4, czesty: 0 }, 1),
    ...serie(10, { ja: 0, czesty: 4 }, 11),

    ...serie(3, { ja: 4, rzadki: 0 }, 21),
    ...serie(3, { ja: 0, slaby: 4 }, 24),
  ];

  const { rivals } = buildRivals(rows, "ja", { minDecided: 1 });

  const czesty = rivals.find((r) => r.user_id === "czesty");

  assert.ok(czesty.badges.includes("most"));
  assert.ok(czesty.badges.includes("closest"));
});

// --- lista -------------------------------------------------------------------

test("lista jest przycieta, ale total mowi, ilu jest naprawde", async () => {
  const { buildRivals } = await import(MODUL);

  const przeciwnicy = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [`r${i}`, i % 3]),
  );

  const rows = serie(4, { ja: 4, ...przeciwnicy });

  const wynik = buildRivals(rows, "ja", { minDecided: 1, limit: 5 });

  assert.equal(wynik.total, 12);
  assert.ok(wynik.rivals.length <= 12);
  assert.ok(wynik.rivals.length >= 5, "czolowka plus wyrozniem odznaka");
});

test("wyrozniony odznaka trafia na liste, nawet gdy wypadl z czolowki", async () => {
  const { buildRivals } = await import(MODUL);

  // Szescioro czestych rywali z identycznym bilansem i jeden rzadki,
  // ktory jako jedyny ogrywa gracza. Przy limicie 5 wypadlby poza liste.
  const czesci = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [`czesty${i}`, 0]),
  );

  const rows = [
    ...serie(10, { ja: 4, ...czesci }, 1),
    ...serie(2, { ja: 0, rzadki: 4 }, 11),
  ];

  const wynik = buildRivals(rows, "ja", { minDecided: 1, limit: 5 });

  assert.ok(
    wynik.rivals.some((r) => r.user_id === "rzadki"),
    "rywal z odznaka musi byc widoczny, inaczej odznaki nie widac nigdzie",
  );
});

test("kolejnosc jest powtarzalna przy identycznych bilansach", async () => {
  // Bez rozstrzygniecia po identyfikatorze odznaka wedrowalaby miedzy
  // rownymi rywalami przy kazdym odswiezeniu.
  const { buildRivals } = await import(MODUL);

  const rows = serie(4, { ja: 4, b: 0, a: 0, c: 0 });

  const pierwszy = buildRivals(rows, "ja", { minDecided: 1 });

  const odwrocone = [...rows].reverse();

  const drugi = buildRivals(odwrocone, "ja", { minDecided: 1 });

  assert.deepEqual(
    pierwszy.rivals.map((r) => r.user_id),
    drugi.rivals.map((r) => r.user_id),
  );

  assert.deepEqual(
    pierwszy.rivals.map((r) => r.badges),
    drugi.rivals.map((r) => r.badges),
  );
});

test("prog wraca w wyniku, zeby strona mogla go napisac", async () => {
  const { buildRivals } = await import(MODUL);

  assert.equal(buildRivals([], "ja").min_decided, 10);
  assert.equal(buildRivals([], "ja", { minDecided: 3 }).min_decided, 3);
});
