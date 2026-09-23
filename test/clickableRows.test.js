// Wiersz listy, ktory gdzies prowadzi.
//
// SKAD SIE TO WZIELO. Wiersz rankingu wygladal jak karta z ramka i rozjasnial
// sie pod kursorem, ale klikalny byl wylacznie blok z nickiem. Zmierzone na
// rankingu Kolonii: podswietlal sie CALY wiersz, a odnosnik zajmowal 28% jego
// powierzchni - kliniecie w punkty, w numer miejsca albo w plakietki nie
// robilo nic. Piecdziesiat takich wierszy na strone.
//
// Naprawia to `.ui-row-item--link`: odnosnik rozciagniety przez ::after na
// cala karte. Ten zabieg ma jednak ostry warunek - wiersz moze miec DOKLADNIE
// JEDEN odnosnik. Rozciagniete ::after przykrywa wszystko pod soba, wiec
// wiersz z dwoma celami (lista rywali: nick prowadzi na profil, bilans na
// strone pojedynku) stracilby jeden z nich BEZ SLADU: element dalej jest
// w drzewie, dalej ma href, tylko nie da sie w niego trafic myszka.
//
// Test pilnuje tego warunku, bo taka awaria nie wywala niczego i nie widac
// jej na zrzucie ekranu.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const KORZEN = path.join(__dirname, "..");

function czytaj(wzgledna) {
  return fs.readFileSync(path.join(KORZEN, wzgledna), "utf8");
}

/** Pliki frontu, ktore w ogole rysuja wiersz listy. */
function plikiZWierszami() {
  const katalogi = ["web/src/pages", "web/src/components", "web/src/components/admin"];
  const znalezione = [];

  for (const k of katalogi) {
    for (const nazwa of fs.readdirSync(path.join(KORZEN, k))) {
      if (!nazwa.endsWith(".jsx")) continue;

      const wzgledna = `${k}/${nazwa}`;

      if (czytaj(wzgledna).includes("ui-row-item")) znalezione.push(wzgledna);
    }
  }

  return znalezione;
}

test("rozciagniety odnosnik nadal stoi w arkuszu", () => {
  // Bez tej reguly modyfikator zostaje pustym slowem: wiersz dalej mowi
  // kursorem "kliknij mnie", a klikalne zostaje te 28%.
  const css = czytaj("web/src/styles/components.css");

  const selektor = ".ui-row-item--link > a:only-of-type::after";

  const blok = css.slice(
    css.indexOf(selektor),
    css.indexOf("}", css.indexOf(selektor)),
  );

  assert.ok(blok.includes("position: absolute"), "brak position: absolute");
  assert.ok(blok.includes("inset: 0"), "brak inset: 0");
  assert.ok(
    css.includes(".ui-row-item--link {") && css.includes("cursor: pointer"),
    "wiersz nie ma lapki",
  );
});

test("wiersz z DWOMA odnosnikami nie dostaje rozciagniecia", () => {
  // Lista rywali ma dwa cele w jednym wierszu i to jest zamierzone - nick
  // prowadzi na profil, bilans na strone pojedynku. Dodanie jej tego
  // modyfikatora "dla spojnosci" skasowaloby drugi odnosnik po cichu.
  const rivals = czytaj("web/src/components/Rivals.jsx");

  const odnosnikow = (rivals.match(/<Link/g) || []).length;

  assert.ok(
    odnosnikow >= 2,
    "Rivals mial dwa odnosniki w wierszu - jesli juz nie ma, ten test opisuje nieistniejacy uklad",
  );

  assert.ok(
    !rivals.includes("ui-row-item--link"),
    "wiersz rywali ma dwa cele, wiec rozciagniecie przykryloby jeden z nich",
  );
});

test("rozciagniecie samo sie wylacza przy drugim odnosniku", () => {
  // To jest bezpiecznik, nie ozdoba skladni. Bez `:only-of-type` dopisanie
  // modyfikatora do wiersza z dwoma celami skasowaloby jeden z nich po
  // cichu - element zostaje w drzewie, ma href, tylko mysz go nie dosiega.
  const css = czytaj("web/src/styles/components.css");

  assert.ok(
    css.includes(".ui-row-item--link > a:only-of-type::after"),
    "rozciagniecie stosuje sie do KAZDEGO odnosnika w wierszu",
  );
});

test("odnosnik w tekscie ma podkreslenie, a nie sam kolor", () => {
  // Kolor sam w sobie nie jest znakiem: przy daltonizmie, na wydruku
  // i w trybie wysokiego kontrastu zostaje z niego zwykly tekst.
  const css = czytaj("web/src/styles/components.css");

  const blok = css.slice(
    css.indexOf(".ui-link {"),
    css.indexOf("}", css.indexOf(".ui-link {")),
  );

  assert.ok(blok.includes("text-decoration: underline"), "brak podkreslenia");
  assert.ok(blok.includes("color:"), "brak koloru");
});

test("wiersz decyzji ma odnosnik na WLASCIWYM poziomie", () => {
  // USTERKA, KTORA TO ZAMRAZA. Rozciagniecie stoi na `> a:only-of-type`,
  // czyli na BEZPOSREDNIM dziecku wiersza. Pierwsza wersja sekcji "Mecze,
  // ktore zrobily roznice" chowala odnosnik o poziom glebiej, w <span>
  // z opisem - regula wiec nie trafiala, klikalna zostawala sama nazwa
  // meczu, a caly wiersz i tak podswietlal sie pod kursorem. Dokladnie ten
  // blad, ktory ten plik mial lapac, tylko popelniony od nowa.
  //
  // Sprawdzone w przegladarce: po poprawce wszystkie trzy punkty wiersza
  // (nazwa, pusty srodek, prawa krawedz z poparciem) trafiaja w odnosnik.
  const css = czytaj("web/src/index.css");
  const jsx = czytaj("web/src/pages/PlayerProfilePage.jsx");

  const selektor = ".decision > a:only-of-type::after";

  assert.ok(
    css.includes(selektor),
    "wiersz decyzji stracil rozciagniecie albo zmienil selektor",
  );

  // Odnosnik musi byc dzieckiem <li className="decision">, a nie wnukiem.
  const wiersz = jsx.slice(
    jsx.indexOf('<li className="decision">'),
    jsx.indexOf("</li>", jsx.indexOf('<li className="decision">')),
  );

  assert.ok(wiersz.length > 0, "nie znaleziono wiersza decyzji w JSX");

  const przedOdnosnikiem = wiersz.slice(0, wiersz.indexOf("<Link"));

  assert.ok(
    !przedOdnosnikiem.includes("<span"),
    "odnosnik siedzi w <span> - rozciagniecie `> a` go nie obejmie",
  );

  // I dokladnie jeden - inaczej `:only-of-type` wylaczy rozciagniecie.
  assert.equal(
    (wiersz.match(/<Link/g) || []).length,
    1,
    "wiersz decyzji ma miec jeden cel",
  );
});
