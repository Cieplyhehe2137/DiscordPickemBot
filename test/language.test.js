// Wybor jezyka strony (web/src/lib/language.js + web/src/i18n/).
//
// Trzy rzeczy, ktore ten plik pilnuje, i kazda konczy sie inaczej:
//
// 1. Mechanizm: smiec w zapisie przegladarki, localStorage rzucajacy
//    wyjatkiem, polski, ktory przestal byc domyslny. To samo, co przy
//    motywie - i z tych samych powodow.
//
// 2. Liczba mnoga. Polski, rosyjski i ukrainski dziela liczby na trzy
//    kategorie, angielski i niemiecki na dwie. Pomylka tutaj daje
//    "5 gracze" i nikt jej nie zglosi, bo strona dziala.
//
// 3. ZESTAWY KLUCZY. To jest najwazniejszy test w tym pliku. Brakujacy
//    klucz w de.js nie wywraca niczego - po prostu w srodku niemieckiej
//    strony pojawia sie polskie zdanie. Nikt tego nie zglosi, bo nikt nie
//    czyta calego serwisu w pieciu jezykach po kazdej zmianie.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../web/src/lib/language.js";
const TLUMACZ = "../web/src/i18n/translate.js";
const SLOWNIKI_MODUL = "../web/src/i18n/index.js";

// Atrapa <html>: tylko to, czego uzywa applyLanguage.
function fakeRoot() {
  const atrybuty = new Map();

  return {
    atrybuty,
    setAttribute(n, v) {
      atrybuty.set(n, v);
    },
    removeAttribute(n) {
      atrybuty.delete(n);
    },
    getAttribute(n) {
      return atrybuty.has(n) ? atrybuty.get(n) : null;
    },
  };
}

function fakeStorage(poczatkowe = {}) {
  const dane = new Map(Object.entries(poczatkowe));

  return {
    dane,
    getItem: (k) => (dane.has(k) ? dane.get(k) : null),
    setItem: (k, v) => dane.set(k, v),
  };
}

const magazynKtoryRzuca = {
  getItem() {
    throw new Error("dostep zabroniony");
  },
  setItem() {
    throw new Error("dostep zabroniony");
  },
};

// Napisy, ktore w kilku jezykach SA identyczne i tak ma zostac. Pilnuje tego
// test nizej, a ta lista jest jedynym sposobem, zeby go uciszyc - swiadomym
// i widocznym w diffie.
//
// Wpis tutaj to zdanie: "sprawdzilem, po niemiecku brzmi tak samo". Nie jest
// to miejsce na chwilowe wyciszenie nieprzetlumaczonego napisu.
const TAKIE_SAME_NAPRAWDE = new Set([
  // "TOP 10%" pisze sie tak samo po polsku, angielsku i niemiecku.
  // Rosyjski i ukrainski maja tu "ТОП" i nie potrzebuja wyjatku.
  "history.top",

  // Nazwy etapow turnieju zostaja po angielsku we wszystkich jezykach - tak
  // nazywaja je organizatorzy i tak stoja na drabince, ktora gracz ma przed
  // oczami. Krotsze nazwy ("Swiss", "Playoffs", "Play-In") sa jednoslowne,
  // wiec test i tak ich nie sprawdza.
  "phase.swissStage1",
  "phase.swissStage2",
  "phase.swissStage3",
  "phase.doubleElim",

  // "Exact" to slowo, ktore polska scena CS-a wziela z angielskiego i tak go
  // uzywa - a "Event" po niemiecku brzmi tak samo jak po polsku.
  "myStats.mapExact",
  "myStats.eventAverage",

  // Sam skrot MVP plus nazwa turnieju - nie ma tu czego tlumaczyc.
  "adminPage.section.mvp",

  // "TOP 10%" - ten sam powod, co przy history.top wyzej.
  "allTime.average",

  // "#5 / 523" to same liczby i ukosnik. Stalo tu kiedys "#5 z 523",
  // ale .ui-badge robi text-transform: uppercase i polskie "z" stawalo
  // sie krzyczacym "Z" - a niemieckie "von" "VON". Ukosnik czyta sie
  // tak samo we wszystkich pieciu jezykach i nie da sie go zepsuc.
  "allTime.bestPlace",

  // "6 / 149" - ten sam zabieg i ten sam powod, co wyzej.
  "upsets.hits",
]);

// --- Mechanizm --------------------------------------------------------------

test("polski jest domyslny", async () => {
  const { DOMYSLNY } = await import(MODUL);

  assert.equal(DOMYSLNY, "pl");
});

test("brak zapisu daje polski, a nie jezyk przegladarki", async () => {
  // Serwis od zawsze jest po polsku i tak ma zostac dla kogos, kto nic nie
  // zmienial - takze wtedy, gdy jego przegladarka woli angielski.
  const { readLanguage } = await import(MODUL);

  assert.equal(readLanguage(fakeStorage()), "pl");
});

test("zapisany wybor jest odczytywany", async () => {
  const { readLanguage, KLUCZ, LANGUAGES } = await import(MODUL);

  for (const kod of LANGUAGES) {
    assert.equal(readLanguage(fakeStorage({ [KLUCZ]: kod })), kod);
  }
});

test("smiec w zapisie wraca do domyslnego", async () => {
  const { readLanguage, normalizeLanguage, KLUCZ } = await import(MODUL);

  assert.equal(readLanguage(fakeStorage({ [KLUCZ]: "fr" })), "pl");
  assert.equal(readLanguage(fakeStorage({ [KLUCZ]: "" })), "pl");
  assert.equal(normalizeLanguage(null), "pl");
  assert.equal(normalizeLanguage(undefined), "pl");
  assert.equal(normalizeLanguage(42), "pl");
  assert.equal(normalizeLanguage("PL"), "pl", "kod z wielkich liter to smiec");
});

test("magazyn rzucajacy wyjatkiem nie wywraca ani odczytu, ani zapisu", async () => {
  const { readLanguage, saveLanguage } = await import(MODUL);

  assert.equal(readLanguage(magazynKtoryRzuca), "pl");
  assert.equal(readLanguage(null), "pl");

  assert.equal(saveLanguage(magazynKtoryRzuca, "de"), false);
  assert.equal(saveLanguage(null, "de"), false, "brak magazynu to nie sukces");
});

test("zapis odklada znormalizowana wartosc", async () => {
  const { saveLanguage, KLUCZ } = await import(MODUL);

  const s = fakeStorage();

  assert.equal(saveLanguage(s, "uk"), true);
  assert.equal(s.dane.get(KLUCZ), "uk");

  saveLanguage(s, "fr");
  assert.equal(s.dane.get(KLUCZ), "pl", "smiec zapisuje sie jako domyslny");
});

test("atrybut lang dostaje TAKZE polski", async () => {
  // Tu jest roznica wobec motywu, gdzie domyslny ciemny celowo nie dostaje
  // atrybutu. <html lang> czyta czytnik ekranu i wyszukiwarka, wiec pusty
  // albo nieprawdziwy jest gorszy niz nadmiarowy.
  const { applyLanguage } = await import(MODUL);

  const root = fakeRoot();

  applyLanguage(root, "pl");

  assert.equal(root.getAttribute("lang"), "pl");
});

test("smiec nie trafia do atrybutu lang", async () => {
  const { applyLanguage } = await import(MODUL);

  const root = fakeRoot();

  assert.equal(applyLanguage(root, "fr"), "pl");
  assert.equal(root.getAttribute("lang"), "pl");

  assert.equal(applyLanguage(null, "de"), "pl", "brak dokumentu nie wywraca");
});

test("klucz zapisu zgadza sie z tym w index.html", async () => {
  // Wbudowany skrypt w index.html czyta ten sam klucz PRZED uruchomieniem
  // Reacta. Gdyby sie rozjechaly, atrybut lang przez chwile mowilby "pl"
  // komus, kto wybral niemiecki - i nic by tego nie zglosilo.
  const fs = require("node:fs");
  const path = require("node:path");

  const { KLUCZ, LANGUAGES, DOMYSLNY } = await import(MODUL);

  const html = fs.readFileSync(
    path.join(__dirname, "..", "web", "index.html"),
    "utf8",
  );

  assert.ok(html.includes(KLUCZ), `index.html nie czyta klucza "${KLUCZ}"`);

  // Kazdy jezyk POZA domyslnym musi byc wymieniony w skrypcie - domyslny
  // stoi juz w samym <html lang="pl"> i nie ma go po co ustawiac.
  for (const kod of LANGUAGES.filter((k) => k !== DOMYSLNY)) {
    assert.ok(
      html.includes(`"${kod}"`),
      `index.html nie zna jezyka "${kod}" - wybor nie przezyje przeladowania`,
    );
  }
});

// --- Liczba mnoga -----------------------------------------------------------

test("polski dzieli liczby na trzy kategorie", async () => {
  const { pluralCategory } = await import(MODUL);

  const kat = (n) => pluralCategory("pl", n);

  assert.equal(kat(1), "one");
  assert.equal(kat(2), "few");
  assert.equal(kat(3), "few");
  assert.equal(kat(4), "few");
  assert.equal(kat(5), "many");
  assert.equal(kat(0), "many", "zero typow, a nie zero typ");

  // Nastki to wyjatek: "12 graczy", a nie "12 gracze".
  assert.equal(kat(11), "many");
  assert.equal(kat(12), "many");
  assert.equal(kat(13), "many");
  assert.equal(kat(14), "many");

  // Po dwudziestce "one" JUZ NIE WRACA: po polsku mowi sie "21 graczy",
  // a nie "21 gracz". To odroznia polski od rosyjskiego i ukrainskiego -
  // patrz test nizej.
  assert.equal(kat(21), "many");
  assert.equal(kat(22), "few");
  assert.equal(kat(25), "many");
  assert.equal(kat(101), "many");
  assert.equal(kat(111), "many", "sto jedenascie to tez nastka");
  assert.equal(kat(112), "many");
});

test("rosyjski i ukrainski dziela liczby prawie tak samo jak polski", async () => {
  // Prawie - bo przy koncowce 1 powyzej dziesiatki jest jedyna roznica
  // miedzy tymi trzema jezykami.
  const { pluralCategory } = await import(MODUL);

  for (const n of [0, 2, 4, 5, 11, 12, 14, 22, 25, 112]) {
    assert.equal(
      pluralCategory("ru", n),
      pluralCategory("pl", n),
      `rosyjski rozni sie od polskiego przy ${n}`,
    );

    assert.equal(
      pluralCategory("uk", n),
      pluralCategory("pl", n),
      `ukrainski rozni sie od polskiego przy ${n}`,
    );
  }
});

test("koncowka 1 to pojedyncza po rosyjsku i ukrainsku, ale nie po polsku", async () => {
  // "21 команда" po rosyjsku, ale "21 druzyn" po polsku. Napisana raz
  // regula slowianska dawala tu "21 druzyna" i tak to weszlo na strone -
  // zlapal to dopiero test porownujacy z odmien() bota.
  const { pluralCategory } = await import(MODUL);

  for (const n of [21, 31, 101, 1001]) {
    assert.equal(pluralCategory("ru", n), "one", `rosyjski przy ${n}`);
    assert.equal(pluralCategory("uk", n), "one", `ukrainski przy ${n}`);
    assert.equal(pluralCategory("pl", n), "many", `polski przy ${n}`);
  }

  // Jedenastka jest wyjatkiem we WSZYSTKICH trzech.
  for (const jezyk of ["pl", "ru", "uk"]) {
    assert.equal(pluralCategory(jezyk, 11), "many", jezyk);
    assert.equal(pluralCategory(jezyk, 111), "many", jezyk);
  }
});

test("angielski i niemiecki dziela liczby na dwie kategorie", async () => {
  const { pluralCategory } = await import(MODUL);

  for (const jezyk of ["en", "de"]) {
    assert.equal(pluralCategory(jezyk, 1), "one");
    assert.equal(pluralCategory(jezyk, 0), "other");
    assert.equal(pluralCategory(jezyk, 2), "other");
    assert.equal(pluralCategory(jezyk, 5), "other");
    assert.equal(pluralCategory(jezyk, 11), "other");
    assert.equal(pluralCategory(jezyk, 21), "other", "nie 'one' jak po polsku");
  }
});

test("nieliczba nie wywraca odmiany", async () => {
  // Do komponentu potrafi trafic undefined, zanim dane doleca z serwera.
  const { pluralCategory } = await import(MODUL);

  assert.equal(pluralCategory("pl", undefined), "many");
  assert.equal(pluralCategory("pl", null), "many");
  assert.equal(pluralCategory("pl", "x"), "many");
  assert.equal(pluralCategory("en", undefined), "other");
});

// --- Tlumacz ----------------------------------------------------------------

test("tlumacz oddaje napis w wybranym jezyku", async () => {
  const { createTranslator } = await import(TLUMACZ);

  const slowniki = {
    pl: { "a.b": "polski" },
    de: { "a.b": "niemiecki" },
  };

  assert.equal(createTranslator("de", slowniki)("a.b"), "niemiecki");
  assert.equal(createTranslator("pl", slowniki)("a.b"), "polski");
});

test("brak napisu w jezyku spada na polski, a nie na pustke", async () => {
  // Brakujacy napis to blad nasz, nie odwiedzajacego. Polskie zdanie
  // przynajmniej cos mowi; pilnuje tego test zestawow kluczy nizej.
  const { createTranslator } = await import(TLUMACZ);

  const slowniki = { pl: { "a.b": "polski" }, de: {} };

  assert.equal(createTranslator("de", slowniki)("a.b"), "polski");
});

test("klucz nieznany NIGDZIE wraca jako sam klucz", async () => {
  const { createTranslator } = await import(TLUMACZ);

  const t = createTranslator("de", { pl: {}, de: {} });

  assert.equal(t("nie.ma.takiego"), "nie.ma.takiego");
});

test("zmienne trafiaja w klamry", async () => {
  const { createTranslator } = await import(TLUMACZ);

  const t = createTranslator("pl", {
    pl: { "a.b": "Witaj, {name} - masz {count} typow" },
  });

  assert.equal(t("a.b", { name: "Ciepły", count: 3 }), "Witaj, Ciepły - masz 3 typow");
});

test("nieznana zmienna zostaje widoczna w klamrach", async () => {
  // Puste miejsce po literowce w nazwie wyglada jak zdanie urwane w polowie
  // i nikt tego nie zglosi. Widoczne "{name}" od razu mowi, co jest nie tak.
  const { createTranslator } = await import(TLUMACZ);

  const t = createTranslator("pl", { pl: { "a.b": "Witaj, {name}" } });

  assert.equal(t("a.b", { inne: "x" }), "Witaj, {name}");
});

test("liczba mnoga wybiera forme wedlug count", async () => {
  const { createTranslator } = await import(TLUMACZ);

  const slowniki = {
    pl: {
      "l.gracze": {
        one: "{count} gracz",
        few: "{count} graczy",
        many: "{count} graczy",
      },
    },
    en: {
      "l.gracze": { one: "{count} player", other: "{count} players" },
    },
  };

  const pl = createTranslator("pl", slowniki);
  const en = createTranslator("en", slowniki);

  assert.equal(pl("l.gracze", { count: 1 }), "1 gracz");
  assert.equal(pl("l.gracze", { count: 3 }), "3 graczy");
  assert.equal(pl("l.gracze", { count: 5 }), "5 graczy");

  assert.equal(en("l.gracze", { count: 1 }), "1 player");
  assert.equal(en("l.gracze", { count: 21 }), "21 players", "nie 'player'");
});

test("brakujaca forma nie zostawia pustego miejsca w zdaniu", async () => {
  // Gorzej odmieniony rzeczownik jest o niebo lepszy niz dziura w zdaniu.
  const { createTranslator } = await import(TLUMACZ);

  const t = createTranslator("pl", { pl: { "l.x": { one: "{count} typ" } } });

  assert.equal(t("l.x", { count: 5 }), "5 typ");
});

// --- Zestawy kluczy ---------------------------------------------------------

test("kazdy slownik ma DOKLADNIE te same klucze co polski", async () => {
  // NAJWAZNIEJSZY TEST W TYM PLIKU.
  //
  // Brakujacy klucz w de.js nie wywraca niczego - w srodku niemieckiej
  // strony pojawia sie polskie zdanie i tyle. Klucz nadmiarowy jest rownie
  // zly: to napis, ktorego nie ma po polsku, czyli albo literowka w nazwie,
  // albo pozostalosc po usunietym ekranie.
  const { SLOWNIKI } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES, DOMYSLNY } = await import(MODUL);

  const wzorzec = Object.keys(SLOWNIKI[DOMYSLNY]);

  assert.ok(wzorzec.length > 0, "polski slownik jest pusty");

  for (const kod of LANGUAGES) {
    const klucze = Object.keys(SLOWNIKI[kod]);

    const brakuje = wzorzec.filter((k) => !klucze.includes(k));
    const nadmiarowe = klucze.filter((k) => !wzorzec.includes(k));

    assert.deepEqual(brakuje, [], `${kod}.js: brakuje kluczy`);
    assert.deepEqual(nadmiarowe, [], `${kod}.js: klucze spoza polskiego`);
  }
});

test("kazdy jezyk ma swoj slownik", async () => {
  const { SLOWNIKI } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES } = await import(MODUL);

  for (const kod of LANGUAGES) {
    assert.ok(SLOWNIKI[kod], `brak slownika dla "${kod}"`);
  }
});

test("zaden napis nie zostal po polsku w obcym slowniku przez zapomnienie", async () => {
  // Nie da sie sprawdzic, czy tlumaczenie jest DOBRE. Da sie sprawdzic, czy
  // ktos nie wkleil polskiego zdania i nie zapomnial go zmienic - a to jest
  // najczestszy sposob, w jaki taki plik sie psuje.
  //
  // Wyjatki sa prawdziwe: "PickEmBot" to nazwa, a niemieckie "Start" i
  // "Events" to naprawde te same slowa co polskie. Dlatego porownujemy
  // tylko napisy DLUZSZE niz jedno slowo.
  const { SLOWNIKI } = await import(SLOWNIKI_MODUL);
  const { LANGUAGES, DOMYSLNY } = await import(MODUL);

  const polski = SLOWNIKI[DOMYSLNY];

  const podejrzane = [];

  for (const kod of LANGUAGES.filter((k) => k !== DOMYSLNY)) {
    for (const [klucz, wpis] of Object.entries(SLOWNIKI[kod])) {
      if (typeof wpis !== "string") continue;
      if (typeof polski[klucz] !== "string") continue;
      if (TAKIE_SAME_NAPRAWDE.has(klucz)) continue;

      const jednoSlowo = !wpis.trim().includes(" ");

      if (!jednoSlowo && wpis === polski[klucz]) {
        podejrzane.push(`${kod}.js: "${klucz}" = "${wpis}"`);
      }
    }
  }

  assert.deepEqual(
    podejrzane,
    [],
    "napisy zostaly po polsku - a jesli w tym jezyku brzmia tak samo, dopisz klucz do TAKIE_SAME_NAPRAWDE",
  );
});

// --- Nazwy jezykow ----------------------------------------------------------

test("kazdy jezyk jest podpisany w swoim wlasnym jezyku", async () => {
  // "Niemiecki" nie pomaga nikomu, kto szuka slowa "Deutsch" - a to on ma
  // znalezc swoj jezyk na liscie, nie my.
  const { NAZWY, LANGUAGES } = await import(MODUL);

  for (const kod of LANGUAGES) {
    assert.ok(NAZWY[kod], `brak nazwy jezyka "${kod}"`);
  }

  assert.equal(NAZWY.de, "Deutsch");
  assert.equal(NAZWY.ru, "Русский");
  assert.equal(NAZWY.uk, "Українська");
});
