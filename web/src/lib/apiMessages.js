// Tłumaczenie komunikatów, które przychodzą z serwera.
//
// PROBLEM: API odpowiada gotowym zdaniem po polsku - `{ error: "Błąd bazy
// danych." }` - a strona to zdanie wyświetla wprost, w kilkudziesięciu
// miejscach, zwykle jako `err.message`. Po przetłumaczeniu reszty serwisu
// zostałyby jedyne polskie zdania na niemieckiej stronie, i to akurat te,
// które czyta się w najgorszym momencie: gdy coś poszło nie tak.
//
// ROZWIĄZANIE: serwer dokłada do odpowiedzi `code` - stały identyfikator
// komunikatu, taki sam we wszystkich językach. Tłumaczenie zostaje tam,
// gdzie cała reszta, czyli w web/src/i18n/. Polskie zdanie NIE ZNIKA
// z odpowiedzi: jest zapasem dla klienta, który kodu nie zna, i dla
// wywołań spoza przeglądarki.
//
// DLACZEGO REJESTR, A NIE HOOK: to musi zadziałać w api.js, czyli w zwykłym
// module, do którego nie da się wstrzyknąć kontekstu Reacta. Tłumacz jest
// więc odkładany raz, przez LanguageProvider, przy każdej zmianie języka.
// Modułowa zmienna jest tu uczciwsza niż udawanie, że api.js jest
// komponentem.

let tlumacz = null;

/**
 * Odkłada tłumacza używanego przez odpowiedzi API.
 *
 * Woła to wyłącznie LanguageProvider.
 */
export function setApiTranslator(t) {
  tlumacz = typeof t === "function" ? t : null;
}

/**
 * Zdanie dla kodu z serwera albo tekst, który serwer przysłał.
 *
 * Zapas wraca w trzech przypadkach: gdy serwer nie przysłał kodu (stara
 * wersja API), gdy tłumacza jeszcze nie ma (błąd przed pierwszym
 * renderowaniem) i gdy słownik tego kodu nie zna. To ostatnie poznajemy po
 * tym, że `t` oddaje sam klucz - tak działa z założenia, patrz translate.js.
 */
export function translateApiMessage(code, zapas, zmienne) {
  if (!code || !tlumacz) return zapas;

  // Zmienne biorą się z CAŁEJ odpowiedzi: gdy zdanie ma w sobie klamrę,
  // serwer odsyła jej treść osobnym polem obok `code`. Dzięki temu
  // "Nie można zmienić tych faz: {phases}" składa się po naszej stronie,
  // w języku strony, a nie jest sklejane po polsku na serwerze.
  const tekst = tlumacz(code, zmienne);

  return tekst === code ? zapas : tekst;
}
