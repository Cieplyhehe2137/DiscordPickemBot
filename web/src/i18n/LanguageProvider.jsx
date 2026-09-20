import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyLanguage,
  readLanguage,
  saveLanguage,
} from "../lib/language.js";
import { setApiTranslator } from "../lib/apiMessages.js";
import { createTranslator } from "./translate.js";
import { dostepneSlowniki, wczytajSlownik } from "./dictionaries.js";
import { LanguageContext } from "./languageContext.js";

// Język dla całej aplikacji.
//
// Stan początkowy czytany z zapisu przeglądarki, nie z atrybutu w dokumencie:
// atrybut ustawia wbudowany skrypt w index.html przed pierwszym malowaniem,
// więc oba źródła mówią to samo, a zapis jest tym, które przeżywa
// przeładowanie. Tak samo działa przełącznik motywu.
//
// SŁOWNIKI PRZYCHODZĄ Z dictionaries.js, a nie z index.js - polski jest
// w paczce, pozostałe cztery dociągane. Powód i liczby stoją w tamtym pliku.
// Import `createTranslator` idzie wprost z translate.js: przez index.js
// wciągnąłby za sobą komplet słowników i cała oszczędność by zniknęła.

export function LanguageProvider({ children }) {
  const [jezyk, setJezyk] = useState(() =>
    readLanguage(typeof window === "undefined" ? null : window.localStorage),
  );

  // Komplet tego, co da się dziś przetłumaczyć. W stanie stoi SAM ZBIÓR,
  // a nie licznik dociągnięć: dzięki temu zależność tłumacza jest prawdziwa
  // i widoczna, zamiast chować się za wywołaniem funkcji.
  const [slowniki, setSlowniki] = useState(dostepneSlowniki);

  useEffect(() => {
    // Sprawdzenie idzie po STANIE, a nie po pamięci dictionaries.js.
    //
    // Ta różnica to był prawdziwy błąd, złapany dopiero na przeładowaniu
    // strony z zapisanym niemieckim: pobieranie rusza już przy wczytaniu
    // modułu, więc potrafi skończyć się MIĘDZY ustawieniem stanu
    // początkowego a uruchomieniem tego efektu. Pytanie „czy słownik jest
    // w pamięci" dawało wtedy „tak", efekt kończył się bez niczego,
    // a w stanie dalej siedział sam polski - i strona zostawała po polsku
    // mimo lang="de".
    if (slowniki[jezyk]) return undefined;

    let aktualne = true;

    wczytajSlownik(jezyk).then(() => {
      if (aktualne) setSlowniki(dostepneSlowniki());
    });

    return () => {
      aktualne = false;
    };
  }, [jezyk, slowniki]);

  // Tłumacz budowany raz na język. Bez tego każde renderowanie dawałoby nową
  // funkcję `t`, a `t` trafia do kontekstu - czyli przerysowywałoby całą
  // aplikację przy każdej zmianie czegokolwiek.
  const t = useMemo(() => {
    // Zanim słownik dojdzie, createTranslator oddaje polski - to jego
    // udokumentowany zapas, ten sam co przy brakującym kluczu. Dlatego
    // dociąganie nie tworzy stanu „strona bez napisów".
    const tlumacz = createTranslator(jezyk, slowniki);

    // Komunikaty z serwera przychodzą poza Reactem, do zwykłego modułu
    // api.js - on nie ma jak sięgnąć po kontekst, więc dostaje tłumacza
    // tutaj, przy każdej zmianie języka. Patrz lib/apiMessages.js.
    setApiTranslator(tlumacz);

    return tlumacz;
  }, [jezyk, slowniki]);

  const zmienJezyk = useCallback((wybor) => {
    const ustawiony = applyLanguage(document.documentElement, wybor);

    saveLanguage(window.localStorage, ustawiony);

    // Pobranie rusza od razu z kliknięcia, a nie dopiero z efektu po
    // przerysowaniu - to jest różnica rzędu jednego przelotu renderowania,
    // ale przełącznik języka ma reagować natychmiast.
    wczytajSlownik(ustawiony);

    setJezyk(ustawiony);
  }, []);

  const value = useMemo(
    () => ({ jezyk, setJezyk: zmienJezyk, t }),
    [jezyk, zmienJezyk, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
