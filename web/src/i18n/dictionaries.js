// Słowniki dla APLIKACJI: polski od razu, reszta dociągana, panel osobno.
//
// DLACZEGO TO SIĘ ZMIENIŁO. index.js wciągał wszystkie pięć na sztywno
// i uzasadnia to zdaniem, które przestało być prawdziwe: „całość tekstów to
// kilkadziesiąt kilobajtów - mniej niż jeden obrazek na stronie". Zmierzone
// dziś:
//
//   pl  104 736 B surowo,  24 131 B po brotli
//   en   95 115 B          21 454 B
//   de  100 827 B          23 807 B
//   ru  135 508 B          25 511 B
//   uk  135 234 B          25 545 B
//   --------------------------------------
//   razem po brotli 120 448 B, z czego 96 317 B to języki, których
//   odwiedzający NIE wybrał
//
// A obrazek, do którego je porównano - /og.jpg - waży 65 811 B. Napisy ważą
// więc 1,8 raza tyle, co obrazek, który miał być miarą „to niedużo". Przy
// 245 kB całego pobrania to jest blisko połowa.
//
// DRUGI PODZIAŁ, PROSTOPADLE DO PIERWSZEGO: napisy panelu administratora.
// Powyższe dzieli słowniki po JĘZYKU, a to po TYM, KTO je zobaczy. Panel
// otwiera kilka osób, a jego 336 kluczy - 21-22% każdego pliku - jechało do
// wszystkich. Zmierzone na zbudowanej paczce, brotli, całe pobranie strony:
//
//   polski      128 357 B -> 124 128 B   (-4 229 B, 3%)
//   angielski   145 199 B -> 136 951 B   (-8 248 B, 6%)
//   niemiecki   147 595 B -> 138 909 B   (-8 686 B, 6%)
//   rosyjski    149 150 B -> 140 215 B   (-8 935 B, 6%)
//   ukraiński   149 218 B -> 140 270 B   (-8 948 B, 6%)
//
// Mniej, niż sugeruje surowy rozmiar (22-30 kB na język): brotli bardzo
// dobrze ściska powtarzalny tekst słownika, a podział odbiera mu część
// wspólnego kontekstu. Polski oszczędza najmniej, bo jego plik panelu jest
// jedynym, który wychodzi z głównej paczki.
//
// index.js dalej wciąga KOMPLET, teraz z obu plików na język - to z niego
// korzystają testy, bo strażnik zestawów kluczy musi widzieć wszystko naraz.
// Aplikacja po prostu już z niego nie korzysta.
//
// OBAWA Z TAMTEGO KOMENTARZA jest słuszna i tu jest obsłużona: „dociąganie
// oznaczałoby moment, w którym strona stoi bez napisów". Nie stoi. Do czasu
// dociągnięcia `createTranslator` oddaje polski - to jego udokumentowany
// zapas, ten sam, który działa przy brakującym kluczu. Drugi tryb awaryjny
// nie powstaje, bo istniejący wystarcza: nieudane pobranie zostawia polski
// na stałe i nic się nie wywraca.

import pl from "./pl.js";
import { DOMYSLNY, KLUCZ, normalizeLanguage } from "../lib/language.js";

// Polski jest w paczce, reszta w osobnych plikach. Klucze statyczne, a nie
// sklejane z kodu języka: `import(\`./${kod}.js\`)` kazałoby Vite wciągnąć
// KAŻDY plik pasujący do wzorca, czyli dokładnie to, czego unikamy.
const DOCIAGANE = {
  en: () => import("./en.js"),
  de: () => import("./de.js"),
  ru: () => import("./ru.js"),
  uk: () => import("./uk.js"),
};

// Napisy panelu administratora leżą osobno i nie jadą do nikogo, kto do
// panelu nie wchodzi. Zmierzone: 336 kluczy panelu to 21-22% każdego
// słownika - od 22 kB w polskim do 30 kB w rosyjskim, surowo.
//
// Polski jest tu osobnym wpisem, choć podstawowy polski jest w paczce:
// ten plik dociąga się na żądanie jak każdy inny.
const PANELOWE = {
  pl: () => import("./pl.admin.js"),
  en: () => import("./en.admin.js"),
  de: () => import("./de.admin.js"),
  ru: () => import("./ru.admin.js"),
  uk: () => import("./uk.admin.js"),
};

const zaladowane = new Map([[DOMYSLNY, pl]]);
const panelowe = new Map();
const wLocie = new Map();

/** Czy ktoś wszedł do panelu - patrz zPanelem(). */
let panelPotrzebny = false;

// Kto chce wiedzieć, że doszedł nowy słownik. Bez tego dociągnięcie napisów
// panelu nie miałoby jak trafić na ekran: LanguageProvider trzyma słowniki
// w stanie i sam z siebie nie zagląda do tej mapy.
const sluchacze = new Set();

function powiadom() {
  for (const f of sluchacze) f();
}

/** Zgłasza chęć wiedzy o nowych słownikach. Zwraca funkcję odpinającą. */
export function naNowySlownik(f) {
  sluchacze.add(f);

  return () => sluchacze.delete(f);
}

/** Słownik, jeśli jest już w pamięci. */
export function slownikGotowy(kod) {
  return zaladowane.get(normalizeLanguage(kod));
}

/**
 * Komplet tego, co da się dziś przetłumaczyć.
 *
 * Napisy panelu doklejane są DO JĘZYKA, a nie trzymane obok: `t()` szuka
 * klucza w jednym obiekcie na język i nie ma pojęcia o tym podziale - i nie
 * powinno mieć, bo podział jest decyzją o pobieraniu, a nie o znaczeniu.
 */
export function dostepneSlowniki() {
  const gotowe = {};

  for (const [kod, slownik] of zaladowane) {
    const panel = panelowe.get(kod);

    gotowe[kod] = panel ? { ...slownik, ...panel } : slownik;
  }

  return gotowe;
}

/**
 * Dociąga słownik. Wywołana dwa razy dla tego samego języka oddaje tę samą
 * obietnicę - React w trybie ścisłym uruchamia efekty dwukrotnie, a to nie
 * może znaczyć dwóch pobrań.
 */
export function wczytajSlownik(kod) {
  const jezyk = normalizeLanguage(kod);

  if (zaladowane.has(jezyk)) return Promise.resolve(zaladowane.get(jezyk));

  if (wLocie.has(jezyk)) return wLocie.get(jezyk);

  const zaladuj = DOCIAGANE[jezyk];

  if (!zaladuj) return Promise.resolve(pl);

  const obietnica = zaladuj()
    .then((modul) => {
      zaladowane.set(jezyk, modul.default);

      // Panel już otwarty, a język się zmienił - jego napisy muszą pójść
      // w ślad za słownikiem, inaczej połowa ekranu zostałaby po polsku.
      if (panelPotrzebny) return wczytajPanel(jezyk).then(() => modul.default);

      powiadom();

      return modul.default;
    })
    .catch(() => {
      // Zostaje polski. Świadomie nie próbujemy ponownie w pętli: strona
      // działa, tylko po polsku, a kolejne wejście spróbuje od nowa.
      wLocie.delete(jezyk);

      return pl;
    });

  wLocie.set(jezyk, obietnica);

  return obietnica;
}

/** Dociąga napisy panelu dla jednego języka. Bez zapasu - patrz zPanelem(). */
function wczytajPanel(kod) {
  const jezyk = normalizeLanguage(kod);

  if (panelowe.has(jezyk)) return Promise.resolve(panelowe.get(jezyk));

  const zaladuj = PANELOWE[jezyk];

  if (!zaladuj) return Promise.resolve(null);

  return zaladuj()
    .then((modul) => {
      panelowe.set(jezyk, modul.default);

      powiadom();

      return modul.default;
    })
    .catch(() => null);
}

/**
 * Wpuszcza stronę panelu DOPIERO z jego napisami.
 *
 * Wywoływane w App.jsx zamiast gołego `import()`. Czekanie jest tu celowe:
 * gdyby strona weszła przed słownikiem, przez moment stałyby na niej gołe
 * klucze („adminPage.tile.users"), bo zapasowy polski też nie ma tych
 * napisów - one leżą w tym samym dociąganym pliku. Panel jest i tak za
 * `lazy` z ekranem ładowania, więc to żadne nowe czekanie, tylko kilka
 * kilobajtów doklejonych do pobrania, które już trwa.
 *
 * POLSKI DOCIĄGAMY ZAWSZE, nawet gdy ktoś ogląda stronę po niemiecku:
 * to zapas `createTranslator` i bez niego brakujący klucz w tłumaczeniu
 * panelu pokazałby się jako goły klucz, zamiast jako polskie zdanie.
 */
export function zPanelem(obietnicaModulu) {
  panelPotrzebny = true;

  const jezyk = biezacyJezyk();

  const slowniki = [wczytajPanel(DOMYSLNY)];

  if (jezyk !== DOMYSLNY) slowniki.push(wczytajSlownik(jezyk), wczytajPanel(jezyk));

  return Promise.all([obietnicaModulu, ...slowniki]).then(([modul]) => modul);
}

/** Język zapisany w przeglądarce - to samo źródło, co przy starcie niżej. */
function biezacyJezyk() {
  try {
    if (typeof window === "undefined") return DOMYSLNY;

    return normalizeLanguage(window.localStorage.getItem(KLUCZ));
  } catch {
    return DOMYSLNY;
  }
}

/**
 * Start pobierania JESZCZE PRZED pierwszym renderowaniem.
 *
 * Ten sam zapis czyta wbudowany skrypt w index.html, żeby ustawić atrybut
 * `lang` przed pierwszym malowaniem - więc język jest znany, zanim React
 * w ogóle wystartuje. Ruszenie stąd, a nie z efektu, skraca czas, przez
 * który ktoś z wybranym niemieckim widzi polskie napisy, do jednego
 * przelotu po sieci.
 */
try {
  if (typeof window !== "undefined") {
    const zapisany = normalizeLanguage(window.localStorage.getItem(KLUCZ));

    if (zapisany !== DOMYSLNY) wczytajSlownik(zapisany);
  }
} catch {
  /* brak dostępu do zapisu - zostaje polski, tak samo jak w index.html */
}
