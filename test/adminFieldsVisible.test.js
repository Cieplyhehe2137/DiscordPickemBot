// Pola formularzy w panelu admina MUSZA miec klase .ui-input.
//
// CO SIE STALO. Administrator nie mogl dodac druzyny, bo przycisk "Dodaj
// druzyne" byl wyszarzony - a byl wyszarzony slusznie: pilnuje go
// `!newTeamName.trim()`, a w polu nazwy nic nie bylo, bo TEGO POLA NIE BYLO
// WIDAC. Zaden pasek, zadne tlo, zaden obrys; na karcie wisial sam tekst
// zastepczy, ktory czyta sie jak podpis, a nie jak pole do wpisania.
//
// DLACZEGO GOLE POLE JEST NIEWIDOCZNE. web/src/index.css wnosi preflight
// Tailwinda (i robi to swiadomie - patrz komentarz na gorze tego pliku),
// ktory zdejmuje formularzom tlo, obramowanie i padding. Cala widocznosc
// pola trzyma .ui-input. Zmierzone na produkcyjnym arkuszu, motyw ciemny,
// to samo pole na tej samej karcie:
//
//                tlo                  obramowanie   padding   wysokosc
//   gole          rgba(0,0,0,0)        0px           0         21 px
//   z .ui-input   rgba(0,0,0,0.25)     1px           8/12      40 px
//
// Tlo karty to rgb(23,23,27), czyli gole pole bylo doslownie przezroczyste.
//
// DLACZEGO TYLKO PANEL. Strony publiczne tez maja gole kontrolki, ale kazda
// z nich siedzi w kontenerze, ktory je stylizuje: `.leaderboard-search input`
// (uzywa tego takze lista druzyn), `.matches-filters select`,
// `.language-toggle__select`, `.ui-field__input`. Panel nie ma ani jednej
// takiej reguly, wiec tam gole pole znaczy pole niewidoczne - i stad ten
// straznik obejmuje panel, a nie caly serwis.
//
// Checkboxy i radia sa poza zakresem: stylizuje je design-system.css osobno.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const KORZEN = path.join(__dirname, "..");
const PANEL = path.join(KORZEN, "web", "src", "pages", "AdminPage.jsx");
const KATALOG_PANELU = path.join(KORZEN, "web", "src", "components", "admin");

const POMIJANE_TYPY = new Set(["checkbox", "radio", "hidden", "file"]);

/** Wszystkie pliki panelu: strona i jej komponenty. */
function plikiPanelu() {
  const komponenty = fs
    .readdirSync(KATALOG_PANELU)
    .filter((nazwa) => nazwa.endsWith(".jsx"))
    .map((nazwa) => path.join(KATALOG_PANELU, nazwa));

  return [PANEL, ...komponenty];
}

/**
 * Znajduje otwierajace tagi pol formularza razem z numerem linii.
 *
 * Czytamy po tekscie, a nie po drzewie JSX - tak samo jak pozostali
 * straznicy w tym katalogu. Wystarcza, bo pytanie jest proste: czy w tym
 * tagu stoi ui-input.
 */
function polaFormularza(tresc) {
  const znalezione = [];
  const wzor = /<(input|select|textarea)\b/g;

  let trafienie = wzor.exec(tresc);

  for (; trafienie !== null; trafienie = wzor.exec(tresc)) {
    const koniec = tresc.indexOf(">", trafienie.index);

    if (koniec === -1) continue;

    const tag = tresc.slice(trafienie.index, koniec + 1);
    const typ = /type="(\w+)"/.exec(tag);

    if (typ && POMIJANE_TYPY.has(typ[1])) continue;

    znalezione.push({
      rodzaj: trafienie[1],
      tag,
      linia: tresc.slice(0, trafienie.index).split("\n").length,
    });
  }

  return znalezione;
}

test("kazde pole w panelu admina ma klase ui-input", () => {
  const bezKlasy = [];
  let zbadanych = 0;

  for (const plik of plikiPanelu()) {
    const tresc = fs.readFileSync(plik, "utf8").replace(/\r\n/g, "\n");

    for (const pole of polaFormularza(tresc)) {
      zbadanych += 1;

      if (pole.tag.includes("ui-input")) continue;

      bezKlasy.push(
        `${path.basename(plik)}:${pole.linia} <${pole.rodzaj}> bez ui-input`,
      );
    }
  }

  // Gdyby ktos przepisal panel na komponenty i te kontrolki znikly, straznik
  // przestalby czegokolwiek pilnowac, nie mowiac o tym ani slowa.
  assert.ok(
    zbadanych >= 20,
    `straznik przestal cokolwiek widziec - pol w panelu: ${zbadanych}`,
  );

  assert.deepEqual(
    bezKlasy,
    [],
    `pola bez .ui-input sa na ciemnej karcie NIEWIDOCZNE:\n  ${bezKlasy.join("\n  ")}`,
  );
});

test("ui-input naprawde daje polu tlo, obramowanie i padding", () => {
  // Sama klasa nie wystarczy - gdyby kiedys zostala z niej pusta skorupa,
  // test wyzej dalej by przechodzil, a pola znow byly niewidoczne.
  const css = fs.readFileSync(
    path.join(KORZEN, "web", "src", "styles", "components.css"),
    "utf8",
  );

  const poczatek = css.indexOf(".ui-input {");

  assert.ok(poczatek !== -1, "nie ma w ogole reguly .ui-input");

  const regula = css.slice(poczatek, css.indexOf("}", poczatek));

  for (const wlasciwosc of ["background", "border", "padding", "color"]) {
    assert.ok(
      regula.includes(`${wlasciwosc}:`),
      `.ui-input nie ustawia ${wlasciwosc} - pole bedzie nie do zobaczenia`,
    );
  }
});

test("preflight Tailwinda jest wciagany - to on zdejmuje style pol", () => {
  // Powod, dla ktorego gole pole jest przezroczyste. Gdyby ten import
  // zniknal, pola odzyskalyby wyglad domyslny przegladarki, a reszta
  // systemu stylow (wyzerowane naglowki) by sie rozjechala - wiec to jest
  // informacja dla tego, kto bedzie czytal powyzsze testy.
  const css = fs.readFileSync(
    path.join(KORZEN, "web", "src", "index.css"),
    "utf8",
  );

  assert.ok(
    css.includes('@import "tailwindcss"'),
    "zniknal import preflightu - sprawdz, czy pola nadal potrzebuja ui-input",
  );
});
