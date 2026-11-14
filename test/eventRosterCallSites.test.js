// Czy bot pyta o roster TURNIEJU wszedzie, gdzie powinien.
//
// PO CO TEST CZYTAJACY PLIKI JAKO TEKST. Tych pietnastu wywolan nie pokrywa
// ANI JEDEN test wykonujacy kod: 118 handlerow bota nie ma testow wcale, bo
// kazdy z nich potrzebuje atrapy interakcji Discorda. Zrobienie pierwszego
// takiego testu to wieksza robota niz cala ta zmiana.
//
// Zostaje wiec to, co da sie sprawdzic bez Discorda - i akurat pokrywa to
// dwie rzeczy, ktore moga tu cicho zepsuc turniej:
//
//   1. POWROT ROSTERA SERWERA. loadActiveTeams odpowiada na pytanie "ktore
//      druzyny sa w slowniku tego serwera", a nie "ktore graja w TYM
//      turnieju". W sciezce turniejowej to drugie pytanie jest jedynym
//      sensownym, a odpowiedzi roznia sie dopiero wtedy, gdy ktos wskaze
//      roster - czyli blad bylby niewidoczny do pierwszego prawdziwego
//      uzycia.
//
//   2. CICHA ZMIANA KOLEJNOSCI. Dropdowny wynikow administratora pokazuja
//      druzyny w kolejnosci rozstawienia, a dropdowny typowania
//      alfabetycznie. Dotad widac to bylo po NAZWIE funkcji (dwa warianty);
//      dzis po argumencie `order`, ktory da sie pominac - i wtedy lista
//      przestawia sie bez zadnego bledu.
//
// Nie sprawdza, czy handlery DZIALAJA - tego bez Discorda nie da sie
// sprawdzic i nie udaje, ze da.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const KORZEN = path.join(__dirname, "..");
const HANDLERY = path.join(KORZEN, "handlers");

function wszystkiePliki(katalog) {
  const wynik = [];

  for (const wpis of fs.readdirSync(katalog, { withFileTypes: true })) {
    const pelna = path.join(katalog, wpis.name);

    if (wpis.isDirectory()) {
      wynik.push(...wszystkiePliki(pelna));
    } else if (wpis.name.endsWith(".js")) {
      wynik.push(pelna);
    }
  }

  return wynik;
}

function bezKomentarzy(tekst) {
  return tekst
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/[^\n]*$/gm, "");
}

const PLIKI = wszystkiePliki(HANDLERY).map((pelna) => ({
  nazwa: path.relative(KORZEN, pelna).replace(/\\/g, "/"),
  tresc: bezKomentarzy(fs.readFileSync(pelna, "utf8")),
}));

// Dropdowny, w ktorych ADMINISTRATOR wpisuje oficjalny wynik fazy. Kolejnosc
// rozstawienia ma w nich znaczenie, bo admin czyta drabinke z gory na dol.
const PO_ROZSTAWIENIU = [
  "handlers/playin/openPlayinResultsDropdown.js",
  "handlers/playoffs/openPlayoffsDropdown.js",
  "handlers/playoffs/openPlayoffsResultsDropdown.js",
  "handlers/swiss/openSwissResultsDropdown.js",
];

test("zaden handler nie pyta o roster SERWERA", () => {
  const winni = PLIKI.filter((p) => /\bloadActiveTeams\w*\s*\(/.test(p.tresc));

  assert.deepEqual(
    winni.map((p) => p.nazwa),
    [],
    "w sciezce turniejowej pytaniem jest 'kto gra w TYM turnieju', " +
      "a nie 'kto jest w slowniku serwera' - patrz utils/loadEventTeams.js",
  );
});

test("kazde pytanie o roster turnieju podaje turniej I kolejnosc", () => {
  // Brak eventId dalby liste z zapasu zawsze, czyli funkcje bez zadnego
  // efektu. Brak `order` przestawilby liste bez bledu.
  const wywolania = [];

  for (const plik of PLIKI) {
    const wzorzec = /loadEventTeamNames\s*\(\s*pool\s*,\s*\{([^}]*)\}/g;

    let m;

    while ((m = wzorzec.exec(plik.tresc)) !== null) {
      wywolania.push({ plik: plik.nazwa, argumenty: m[1] });
    }
  }

  assert.equal(
    wywolania.length,
    15,
    `oczekiwano 15 wywolan w handlerach, jest ${wywolania.length}`,
  );

  for (const w of wywolania) {
    assert.match(w.argumenty, /\beventId\b/, `${w.plik}: brak eventId`);
    assert.match(w.argumenty, /\bguildId\b/, `${w.plik}: brak guildId`);
    assert.match(w.argumenty, /\border\s*:/, `${w.plik}: brak kolejnosci`);
  }
});

test("wywolania ida OBIEKTEM, nie pozycyjnie", () => {
  // loadEventTeamNames(pool, eventId, guildId) jest poprawnym JavaScriptem
  // i cicho dawaloby liste z zapasu. Dwa identyfikatory obok siebie to
  // zaproszenie do pomylki, dlatego funkcja bierze obiekt.
  for (const plik of PLIKI) {
    const zle = plik.tresc.match(/loadEventTeamNames\s*\(\s*pool\s*,\s*[^{\s]/);

    assert.equal(zle, null, `${plik.nazwa}: wywolanie pozycyjne`);
  }
});

test("dropdowny wynikow admina pytaja po ROZSTAWIENIU, reszta alfabetycznie", () => {
  for (const plik of PLIKI) {
    const wzorzec = /loadEventTeamNames\s*\(\s*pool\s*,\s*\{([^}]*)\}/g;

    let m;

    while ((m = wzorzec.exec(plik.tresc)) !== null) {
      const oczekiwana = PO_ROZSTAWIENIU.includes(plik.nazwa)
        ? "sort_order"
        : "name";

      assert.match(
        m[1],
        new RegExp(`order:\\s*"${oczekiwana}"`),
        `${plik.nazwa}: oczekiwana kolejnosc "${oczekiwana}"`,
      );
    }
  }
});

test("lista dropdownow po rozstawieniu zgadza sie z rzeczywistoscia", () => {
  // Gdyby ktorys z tych plikow zniknal albo zostal przemianowany, test wyzej
  // przestalby czegokolwiek pilnowac - a przeszedlby.
  for (const nazwa of PO_ROZSTAWIENIU) {
    const plik = PLIKI.find((p) => p.nazwa === nazwa);

    assert.ok(plik, `brak pliku ${nazwa} - zaktualizuj liste w tescie`);

    assert.match(
      plik.tresc,
      /loadEventTeamNames\s*\(/,
      `${nazwa} nie pyta juz o roster - zaktualizuj liste w tescie`,
    );
  }
});
