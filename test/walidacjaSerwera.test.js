// Walidacje serwera, wyciagniete z app.js do server/lib/ przy jego rozbijaniu.
//
// Dopoki siedzialy w srodku 12-tysiecznego pliku obok tras, nie dalo sie ich
// sprawdzic inaczej niz uruchamiajac caly serwer - a wsrod nich jest decyzja
// bezpieczenstwa (ktore originy wpuszczac w CORS) i regula, ktora decyduje,
// czy wynik meczu w ogole da sie zapisac.
//
// Moduly sa ESM, wiec ladujemy je dynamicznie. Nie maja zaleznosci, dzieki
// czemu ten test dziala bez instalowania server/node_modules.

const test = require("node:test");
const assert = require("node:assert/strict");

const UKOSNIK = String.fromCharCode(92); // odwrotny ukosnik, bez literalu
const APOSTROF = "'";

test("wynik CS2: zwyciestwo w regulaminowym czasie to 13 przy najwyzej 11", async () => {
  const { validateCs2Score } = await import("../server/lib/walidacja.js");

  for (let przegrany = 0; przegrany <= 11; przegrany += 1) {
    assert.equal(validateCs2Score(13, przegrany), true, `13:${przegrany}`);
    assert.equal(validateCs2Score(przegrany, 13), true, `${przegrany}:13`);
  }

  // 13:12 nie istnieje - przy 12:12 wchodzi dogrywka.
  assert.equal(validateCs2Score(13, 12), false);
});

test("wynik CS2: dogrywki to 16, 19, 22 z przegranym o 2-4 rundy nizej", async () => {
  const { validateCs2Score } = await import("../server/lib/walidacja.js");

  const poprawne = [
    [16, 12], [16, 13], [16, 14],
    [19, 15], [19, 16], [19, 17],
    [22, 18], [22, 19], [22, 20],
  ];

  for (const [a, b] of poprawne) {
    assert.equal(validateCs2Score(a, b), true, `${a}:${b}`);
  }

  const niepoprawne = [
    [16, 11], [16, 15],
    [19, 14], [19, 18],
    [17, 15], [18, 16], [20, 18],
    [14, 12], [15, 13],
  ];

  for (const [a, b] of niepoprawne) {
    assert.equal(validateCs2Score(a, b), false, `${a}:${b}`);
  }
});

test("wynik CS2: remisy, ujemne i nie-liczby odpadaja", async () => {
  const { validateCs2Score } = await import("../server/lib/walidacja.js");

  assert.equal(validateCs2Score(13, 13), false, "remis");
  assert.equal(validateCs2Score(0, 0), false, "remis 0:0");
  assert.equal(validateCs2Score(-13, 5), false, "ujemny");
  assert.equal(validateCs2Score(13.5, 5), false, "ulamek");
  assert.equal(validateCs2Score("abc", 5), false, "nie liczba");
  assert.equal(validateCs2Score(null, undefined), false, "puste");
});

test("kolejnosc map: seria musi sie konczyc rozstrzygnieciem", async () => {
  const { validateSeriesMapOrder } = await import("../server/lib/walidacja.js");

  const wygranaA = { pred_exact_a: 13, pred_exact_b: 5 };
  const wygranaB = { pred_exact_a: 5, pred_exact_b: 13 };

  assert.equal(validateSeriesMapOrder([wygranaA, wygranaA], 3), true, "2:0 w BO3");
  assert.equal(
    validateSeriesMapOrder([wygranaA, wygranaB, wygranaA], 3),
    true,
    "2:1 w BO3",
  );
  assert.equal(validateSeriesMapOrder([wygranaA], 1), true, "1:0 w BO1");

  assert.equal(
    validateSeriesMapOrder([wygranaA], 3),
    false,
    "jedna mapa nie rozstrzyga BO3",
  );
  assert.equal(
    validateSeriesMapOrder([wygranaA, wygranaB], 3),
    false,
    "1:1 nie rozstrzyga BO3",
  );
});

test("kolejnosc map: nie wolno dorzucic mapy po rozstrzygnieciu serii", async () => {
  const { validateSeriesMapOrder } = await import("../server/lib/walidacja.js");

  const wygranaA = { pred_exact_a: 13, pred_exact_b: 5 };
  const wygranaB = { pred_exact_a: 5, pred_exact_b: 13 };

  // To jest wlasciwy powod istnienia tej funkcji: 2:0 i jeszcze trzecia mapa.
  assert.equal(
    validateSeriesMapOrder([wygranaA, wygranaA, wygranaB], 3),
    false,
    "trzecia mapa po zamknieciu serii 2:0",
  );

  assert.equal(
    validateSeriesMapOrder([wygranaA, wygranaA, wygranaA, wygranaB], 5),
    false,
    "czwarta mapa po zamknieciu serii 3:0 w BO5",
  );
});

test("kolejnosc map: remis na mapie unieważnia serie", async () => {
  const { validateSeriesMapOrder } = await import("../server/lib/walidacja.js");

  const remis = { pred_exact_a: 13, pred_exact_b: 13 };
  const wygranaA = { pred_exact_a: 13, pred_exact_b: 5 };

  assert.equal(validateSeriesMapOrder([wygranaA, remis, wygranaA], 3), false);
});

test("sqlEscape ekranuje ukosnik i apostrof", async () => {
  const { sqlEscape } = await import("../server/lib/walidacja.js");

  assert.equal(sqlEscape("zwykly"), "zwykly");
  assert.equal(sqlEscape(APOSTROF), UKOSNIK + APOSTROF);
  assert.equal(sqlEscape(UKOSNIK), UKOSNIK + UKOSNIK);

  // Ukosnik jest ekranowany jako pierwszy, wiec nie zjada ekranowania
  // apostrofu dopisanego chwile pozniej.
  assert.equal(
    sqlEscape(UKOSNIK + APOSTROF),
    UKOSNIK + UKOSNIK + UKOSNIK + APOSTROF,
  );
});

test("safeFileBase zostawia tylko znaki bezpieczne w nazwie pliku", async () => {
  const { safeFileBase } = await import("../server/lib/walidacja.js");

  assert.equal(safeFileBase("IEM Cologne 2026"), "IEM_Cologne_2026");
  assert.equal(safeFileBase("a//b"), "a_b", "powtorzenia sklejane w jeden znak");
  assert.equal(safeFileBase("../../etc/passwd"), "_etc_passwd");
  assert.equal(safeFileBase(""), "pickem_export", "pusta nazwa -> domyslna");
  assert.equal(safeFileBase(null), "pickem_export");
  assert.equal(safeFileBase("!!!", "zapas"), "_", "same znaki niedozwolone");
});

test("assertSafeBackupFileName przepuszcza wlasny wzorzec, reszte odrzuca", async () => {
  const { assertSafeBackupFileName } = await import(
    "../server/lib/walidacja.js"
  );

  const dobra = "backup_hyperland_2026-09-10T18-45-30Z.sql";
  assert.equal(assertSafeBackupFileName(dobra), dobra);

  const zle = [
    "../backup_x_2026-09-10T18-45-30Z.sql",
    "backup_x_2026-09-10T18-45-30Z.sql.exe",
    "dowolny.sql",
    "backup_x.sql",
    "",
    null,
  ];

  for (const n of zle) {
    assert.throws(
      () => assertSafeBackupFileName(n),
      /Invalid backup file name/,
      String(n),
    );
  }
});

test("CORS: origin z listy przechodzi, obcy nie", async () => {
  const { zbudujDozwoloneOriginy, utworzSprawdzanieOriginu } = await import(
    "../server/lib/origin.js"
  );

  const dozwolone = zbudujDozwoloneOriginy(
    "https://pickem.pl, https://drugi.pl/",
  );
  assert.deepEqual(dozwolone, ["https://pickem.pl", "https://drugi.pl"]);

  const wolno = utworzSprawdzanieOriginu({ dozwolone });

  assert.equal(wolno("https://pickem.pl"), true);
  assert.equal(wolno("https://pickem.pl/"), true, "koncowy ukosnik bez roznicy");
  assert.equal(wolno("https://drugi.pl"), true, "drugi wpis z listy");
  assert.equal(wolno("https://zly.pl"), false);
  assert.equal(wolno("http://pickem.pl"), false, "inny protokol to inny origin");
});

test("CORS: brak naglowka Origin jest dopuszczony", async () => {
  const { utworzSprawdzanieOriginu } = await import("../server/lib/origin.js");

  const wolno = utworzSprawdzanieOriginu({ dozwolone: ["https://pickem.pl"] });

  // Zadanie nie z przegladarki (curl, health check) albo same-origin.
  assert.equal(wolno(undefined), true);
  assert.equal(wolno(""), true);
  assert.equal(wolno(null), true);
});

test("CORS: sufiks dopuszcza podglady, ale nie zdejmuje ochrony bez konfiguracji", async () => {
  const { utworzSprawdzanieOriginu } = await import("../server/lib/origin.js");

  const zSufiksem = utworzSprawdzanieOriginu({
    dozwolone: ["https://pickem.pages.dev"],
    sufiks: ".pickem.pages.dev",
  });

  assert.equal(zSufiksem("https://abc123.pickem.pages.dev"), true);
  assert.equal(zSufiksem("https://obcy.pl"), false);

  // Bez sufiksu sama koncowka niczego nie otwiera.
  const bezSufiksu = utworzSprawdzanieOriginu({
    dozwolone: ["https://pickem.pages.dev"],
  });

  assert.equal(bezSufiksu("https://abc123.pickem.pages.dev"), false);

  // Pusty sufiks nie moze znaczyc "wszystko przechodzi" - kazdy tekst konczy
  // sie pustym ciagiem, wiec brak tego zabezpieczenia otwieralby CORS na oscierz.
  const pustySufiks = utworzSprawdzanieOriginu({ dozwolone: [], sufiks: "   " });

  assert.equal(pustySufiks("https://ktokolwiek.pl"), false);
});
