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
 * ZNANE MARTWE ZDARZENIA - nazwy, ktorych nikt nie slucha.
 *
 * Wszystkie trzy sa NADMIAREM, a nie brakiem: w kazdym miejscu, w ktorym
 * wystepuja, leci takze zywe odswiezenie. Za zadnym z nich nie stoi zmiana,
 * o ktorej nikt sie nie dowie - sa do skasowania, kiedy ktos uzna, ze warto.
 *
 *   event:status_updated   obok zywego odswiezenia (eventCleanup.js, events.js)
 *   match:updated          obok zywego odswiezenia (matches.js)
 *   match:score_updated    obok zywego odswiezenia (matchOps.js)
 *
 * POPRZEDNIA WERSJA TEGO KOMENTARZA KLAMALA i warto wiedziec, dlaczego.
 * Twierdzila, ze zmiana statusu turnieju i wpisanie wyniku nie odswiezaja
 * nikomu otwartej strony. Policzylem to recznie, szukajac
 * io.emit("dashboard:refresh") - i przeoczylem, ze zywe odswiezenie ma DRUGA
 * DROGE: emitDashboardRefresh() z utils/socket.js, ktorego taki grep nie
 * widzi. W events.js stoi dokladnie to wywolanie, dziesiec linii wyzej.
 *
 * Dlatego ten komentarz nie rozstrzyga juz, co jest nadmiarem, a co brakiem.
 * Robi to test ponizej, ktory LICZY to przy kazdym uruchomieniu.
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

/**
 * Trasy, ktore wysylaja cos, czego nikt nie slucha, i NIC poza tym.
 *
 * Plik dzielony na kawalki po rejestracjach tras - inaczej "obok" znaczy
 * tyle, ile akurat widac na ekranie. Dla kazdego kawalka z jakimkolwiek
 * io.emit pytanie brzmi: czy leci tez cos, czego front slucha.
 *
 * ZYWE ODSWIEZENIE MA DWIE DROGI i obie licza sie tak samo:
 *
 *   io.emit("dashboard:refresh", ...)   wprost
 *   emitDashboardRefresh(...)           przez utils/socket.js
 *
 * Przeoczenie drugiej z nich to dokladnie ten blad, ktory ten test ma
 * wylapywac - raz juz kosztowal tygodniowy wpis w komentarzu wyzej,
 * twierdzacy, ze dwie dzialajace trasy nie powiadamiaja nikogo.
 */
function trasyBezPowiadomienia() {
  const katalog = path.join(KORZEN, "server", "routes");

  const gluche = [];

  for (const plik of fs.readdirSync(katalog)) {
    if (!plik.endsWith(".js")) continue;

    const tresc = fs
      .readFileSync(path.join(katalog, plik), "utf8")
      // Komentarze zastapione spacjami, zeby numery linii sie nie rozjechaly.
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

    const linie = tresc.split(/\r?\n/);

    const granice = [0];

    linie.forEach((l, i) => {
      if (/app\.(get|post|put|patch|delete)\(/.test(l)) granice.push(i);
    });

    granice.push(linie.length);

    for (let g = 0; g < granice.length - 1; g += 1) {
      const kawalek = linie.slice(granice[g], granice[g + 1]).join("\n");

      const wysylaCokolwiek = /io\.emit\(\s*"/.test(kawalek);

      if (!wysylaCokolwiek) continue;

      const powiadamia =
        /io\.emit\(\s*"dashboard:refresh"/.test(kawalek) ||
        /emitDashboardRefresh\(/.test(kawalek);

      if (powiadamia) continue;

      const sciezka =
        /["'](\/api\/[^"']+)["']/.exec(kawalek)?.[1] || "(poza trasa)";

      gluche.push(`${plik}:${granice[g] + 1}  ${sciezka}`);
    }
  }

  return gluche;
}

test("kazda trasa, ktora cos wysyla, POWIADAMIA kogokolwiek", () => {
  const gluche = trasyBezPowiadomienia();

  assert.deepEqual(
    gluche,
    [],
    "te trasy zmieniaja stan i wysylaja zdarzenie, ktorego nikt nie slucha,\n" +
      "a nic poza tym - czyli nikt sie o zmianie nie dowie. Dopisz\n" +
      "emitDashboardRefresh(...) albo io.emit(\"dashboard:refresh\", ...):\n  " +
      gluche.join("\n  "),
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
