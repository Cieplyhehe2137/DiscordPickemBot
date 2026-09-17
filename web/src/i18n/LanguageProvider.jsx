import { useCallback, useMemo, useState } from "react";

import {
  applyLanguage,
  readLanguage,
  saveLanguage,
} from "../lib/language.js";
import { setApiTranslator } from "../lib/apiMessages.js";
import { createTranslator, SLOWNIKI } from "./index.js";
import { LanguageContext } from "./languageContext.js";

// Język dla całej aplikacji.
//
// Stan początkowy czytany z zapisu przeglądarki, nie z atrybutu w dokumencie:
// atrybut ustawia wbudowany skrypt w index.html przed pierwszym malowaniem,
// więc oba źródła mówią to samo, a zapis jest tym, które przeżywa
// przeładowanie. Tak samo działa przełącznik motywu.
//
// Bez useEffect: język zmienia się wyłącznie od kliknięcia, a wtedy wpisanie
// go do dokumentu jest skutkiem zdarzenia, a nie synchronizacją stanu.

export function LanguageProvider({ children }) {
  const [jezyk, setJezyk] = useState(() =>
    readLanguage(typeof window === "undefined" ? null : window.localStorage),
  );

  // Tłumacz budowany raz na język. Bez tego każde renderowanie dawałoby nową
  // funkcję `t`, a `t` trafia do kontekstu - czyli przerysowywałoby całą
  // aplikację przy każdej zmianie czegokolwiek.
  const t = useMemo(() => {
    const tlumacz = createTranslator(jezyk, SLOWNIKI);

    // Komunikaty z serwera przychodzą poza Reactem, do zwykłego modułu
    // api.js - on nie ma jak sięgnąć po kontekst, więc dostaje tłumacza
    // tutaj, przy każdej zmianie języka. Patrz lib/apiMessages.js.
    setApiTranslator(tlumacz);

    return tlumacz;
  }, [jezyk]);

  const zmienJezyk = useCallback((wybor) => {
    const ustawiony = applyLanguage(document.documentElement, wybor);

    saveLanguage(window.localStorage, ustawiony);

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
