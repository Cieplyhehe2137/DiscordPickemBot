// Wyszukiwanie napisu w słowniku.
//
// Ten moduł importuje WYŁĄCZNIE lib/language.js - tak samo jak on nie wciąga
// niczego z Vite, więc da się go zaimportować w teście node:test.
//
// KLUCZE SĄ PŁASKIE, z kropkami w środku: "nav.start", a nie zagnieżdżone
// obiekty. Powód jest praktyczny: `grep '"nav.start"'` pokazuje od razu pięć
// linii w pięciu słownikach, po jednej na język. Przy zagnieżdżeniu trzeba
// czytać strukturę, żeby w ogóle zobaczyć, gdzie ten napis leży - a poprawka
// jednego zdania w jednym języku ma być zmianą jednej linii w jednym pliku.

import { DOMYSLNY, normalizeLanguage, pluralCategory } from "../lib/language.js";

/**
 * Wybiera formę liczby mnogiej.
 *
 * Zwykły napis nie ma form i wraca taki, jaki jest. Obiekt ma formy nazwane
 * kategoriami z pluralCategory - i wtedy o wyborze decyduje `count`.
 *
 * Gdyby brakowało akurat tej formy, lecimy przez pozostałe zamiast oddawać
 * pustkę: gorzej odmieniony rzeczownik jest o niebo lepszy niż puste miejsce
 * w zdaniu.
 */
export function selectForm(wpis, jezyk, zmienne) {
  if (typeof wpis === "string") return wpis;

  if (!wpis || typeof wpis !== "object") return null;

  const kategoria = pluralCategory(jezyk, zmienne?.count);

  return (
    wpis[kategoria] ??
    wpis.other ??
    wpis.many ??
    wpis.few ??
    wpis.one ??
    null
  );
}

/**
 * Wstawia zmienne w miejsca oznaczone klamrami.
 *
 * Nieznana nazwa ZOSTAJE w tekście jako "{cos}". To celowe: puste miejsce po
 * literówce w nazwie zmiennej wygląda jak zdanie urwane w połowie i nikt tego
 * nie zgłosi, a widoczne klamry od razu mówią, co jest nie tak.
 */
export function interpolate(tekst, zmienne) {
  if (typeof tekst !== "string" || !zmienne) return tekst;

  return tekst.replace(/\{(\w+)\}/g, (calosc, nazwa) =>
    Object.prototype.hasOwnProperty.call(zmienne, nazwa)
      ? String(zmienne[nazwa])
      : calosc,
  );
}

/**
 * Buduje funkcję `t` dla jednego języka.
 *
 * Kolejność szukania: wybrany język, potem polski, potem sam klucz.
 *
 * DLACZEGO POLSKI JAKO ZAPAS, A NIE OD RAZU KLUCZ: brakujący napis to błąd
 * nasz, nie użytkownika. "leaderboard.empty" w środku strony jest dla niego
 * bez znaczenia, a polskie zdanie przynajmniej coś mówi. Przed brakami
 * pilnuje test porównujący zestawy kluczy - to on ma je łapać, nie
 * odwiedzający.
 *
 * Sam klucz wraca dopiero wtedy, gdy nie ma go NIGDZIE, czyli gdy ktoś woła
 * klucz, którego nie zdefiniowano wcale. Wtedy widoczny "nav.start" jest
 * najlepszą możliwą podpowiedzią.
 */
export function createTranslator(jezyk, slowniki) {
  const wybrany = normalizeLanguage(jezyk);

  const slownik = slowniki?.[wybrany] ?? {};
  const zapasowy = slowniki?.[DOMYSLNY] ?? {};

  return function t(klucz, zmienne) {
    const wpis = klucz in slownik ? slownik[klucz] : zapasowy[klucz];

    const tekst = selectForm(wpis, wybrany, zmienne);

    if (tekst === null || tekst === undefined) return klucz;

    return interpolate(tekst, zmienne);
  };
}
