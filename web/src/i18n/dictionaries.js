// Słowniki dla APLIKACJI: polski od razu, reszta dociągana.
//
// DLACZEGO TO SIĘ ZMIENIŁO. index.js wciąga wszystkie pięć na sztywno
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
// index.js ZOSTAJE bez zmian i dalej wciąga komplet - to z niego korzystają
// testy, bo strażnik zestawów kluczy musi widzieć wszystkie pięć naraz.
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

const zaladowane = new Map([[DOMYSLNY, pl]]);
const wLocie = new Map();

/** Słownik, jeśli jest już w pamięci. */
export function slownikGotowy(kod) {
  return zaladowane.get(normalizeLanguage(kod));
}

/** Komplet tego, co da się dziś przetłumaczyć. */
export function dostepneSlowniki() {
  return Object.fromEntries(zaladowane);
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
