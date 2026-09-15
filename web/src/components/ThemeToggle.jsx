import { useState } from "react";

import { applyTheme, otherTheme, readTheme, saveTheme } from "../lib/theme.js";

// Przełącznik motywu.
//
// Stan początkowy czytany z zapisu przeglądarki, nie z atrybutu w dokumencie:
// atrybut ustawia wbudowany skrypt w index.html przed pierwszym malowaniem,
// więc oba źródła mówią to samo, a zapis jest tym, które przeżywa
// przeładowanie.
//
// Bez useEffect: motyw zmienia się wyłącznie od kliknięcia, a wtedy zapisanie
// go do dokumentu jest skutkiem zdarzenia, a nie synchronizacją stanu.

function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    readTheme(typeof window === "undefined" ? null : window.localStorage),
  );

  const nastepny = otherTheme(theme);

  const przelacz = () => {
    const ustawiony = applyTheme(document.documentElement, nastepny);

    saveTheme(window.localStorage, ustawiony);

    setTheme(ustawiony);
  };

  const opis = nastepny === "light" ? "jasny" : "ciemny";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={przelacz}
      // Tytuł i etykieta mówią, co się STANIE po kliknięciu, a nie jaki
      // motyw jest teraz - ikona i tak pokazuje stan bieżący.
      title={`Przełącz na motyw ${opis}`}
      aria-label={`Przełącz na motyw ${opis}`}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}

export default ThemeToggle;
