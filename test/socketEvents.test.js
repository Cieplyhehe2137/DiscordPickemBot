// Zdarzenia po socketach: czy ktokolwiek ich slucha.
//
// CO SIE STALO. Trasa zapisu map wysylala "matchMapsUpdated" - zdarzenie,
// ktorego NIKT nie odbieral. Wygladalo jak odswiezanie na zywo, a nie
// robilo nic. Zauwazone dopiero przy pytaniu "czy mapy pojawia sie takze
// na stronie", czyli przypadkiem.
//
// Jedynym klientem socketow w calym projekcie jest front
// (web/src/lib/socket.js). Bot laczy sie z Discordem, nie z nasza
// socket.io - uchwyt ustawia sie WYLACZNIE w server/app.js (setIo), wiec
// w procesie bota zostaje pusty.
//
// Ten straznik nie kasuje dlugu, ktory juz jest - spisuje go i pilnuje,
// zeby nie urosl.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const KORZEN = path.join(__dirname, "..");

/*
 * ZNANE MARTWE ZDARZENIA - zastane, nie dopisane przy tej okazji.
 *
 * Kazde z nich to osobna sprawa, bo nie wszystkie da sie po prostu
 * skasowac:
 *
 *   event:status_updated   W eventCleanup.js stoi OBOK zywego
 *                          "dashboard:refresh", wiec jest zwyklym
 *                          nadmiarem. W events.js jest JEDYNYM zdarzeniem
 *                          w tym miejscu - czyli zmiana statusu turnieju
 *                          nie odswieza nikomu otwartej strony.
 *
 *   match:updated          Stoi obok zywego "dashboard:refresh". Nadmiar.
 *
 *   match:score_updated    JEDYNE zdarzenie w obu miejscach, w ktorych
 *                          wystepuje. Wpisanie wyniku meczu nie odswieza
 *                          nikomu otwartej strony.
 *
 * Dwa ostatnie przypadki to nie smiec do wyrzucenia, tylko brakujace
 * powiadomienie - naprawa znaczy DOPISANIE "dashboard:refresh", a nie
 * usuniecie czegokolwiek. Dlatego siedza tutaj, a nie w commicie
 * sprzatajacym.
 */
const ZNANE_MARTWE = new Set([
  "event:status_updated",
  "match:updated",
  "match:score_updated",
]);

/** Nazwy zdarzen wysylanych przez serwer. */
function wysylane() {
  const katalog = path.join(KORZEN, "server", "routes");

  const nazwy = new Set();

  for (const plik of fs.readdirSync(katalog)) {
    if (!plik.endsWith(".js")) continue;

    const tresc = fs.readFileSync(path.join(katalog, plik), "utf8");

    // Komentarze odpadaja - inaczej straznik czyta wlasne uzasadnienia.
    const bezKomentarzy = tresc
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

    for (const m of bezKomentarzy.matchAll(/io\.emit\(\s*"([^"]+)"/g)) {
      nazwy.add(m[1]);
    }
  }

  return nazwy;
}

/** Nazwy zdarzen, ktorych slucha front. */
function sluchane() {
  const katalog = path.join(KORZEN, "web", "src");

  const nazwy = new Set();

  const obejdz = (sciezka) => {
    for (const wpis of fs.readdirSync(sciezka, { withFileTypes: true })) {
      const pelna = path.join(sciezka, wpis.name);

      if (wpis.isDirectory()) {
        obejdz(pelna);
        continue;
      }

      if (!/\.(js|jsx)$/.test(wpis.name)) continue;

      const tresc = fs.readFileSync(pelna, "utf8");

      for (const m of tresc.matchAll(/\.(?:on|off)\(\s*"([^"]+)"/g)) {
        nazwy.add(m[1]);
      }
    }
  };

  obejdz(katalog);

  return nazwy;
}

test("serwer nie wysyla zdarzen, ktorych nikt nie slucha", () => {
  const odbierane = sluchane();

  const martwe = [...wysylane()].filter(
    (nazwa) => !odbierane.has(nazwa) && !ZNANE_MARTWE.has(nazwa),
  );

  assert.deepEqual(
    martwe,
    [],
    "te zdarzenia nie maja odbiorcy - wygladaja jak odswiezanie na zywo,\n" +
      "a nie robia nic. Albo dopisz nasluch we froncie, albo wyslij\n" +
      '"dashboard:refresh", ktorego front juz slucha:\n  ' +
      martwe.join("\n  "),
  );
});

test("lista znanych martwych zdarzen nie zawiera zmyslonych", () => {
  // Gdyby ktos naprawil ktores z nich, wpis ma zniknac z listy - inaczej
  // lista rosnie i przestaje cokolwiek znaczyc.
  const nadal = wysylane();

  for (const nazwa of ZNANE_MARTWE) {
    assert.ok(
      nadal.has(nazwa),
      `"${nazwa}" juz nie jest wysylane - skresl je z ZNANE_MARTWE`,
    );
  }
});

test("front nasluchuje czegokolwiek - inaczej straznik nic nie sprawdza", () => {
  // Gdyby nasluch kiedys znikl albo zmienil zapis, powyzsze testy
  // przechodzilyby zawsze i nikt by sie nie dowiedzial.
  const odbierane = sluchane();

  assert.ok(
    odbierane.has("dashboard:refresh"),
    "front przestal nasluchiwac dashboard:refresh - straznik oslepl",
  );
});

test("trasa map NIE wysyla juz martwego zdarzenia", () => {
  // Konkretny przypadek, od ktorego zaczal sie ten plik.
  const tresc = fs
    .readFileSync(path.join(KORZEN, "server", "routes", "matchOps.js"), "utf8")
    .replace(/\/\/[^\n]*/g, " ");

  assert.doesNotMatch(
    tresc,
    /io\.emit\(\s*"matchMapsUpdated"/,
    "martwe zdarzenie wrocilo",
  );
});
