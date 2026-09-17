import { useState } from "react";

import { applyTheme, otherTheme, readTheme, saveTheme } from "../lib/theme.js";
import { useT } from "../i18n/useLanguage.js";

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
  const t = useT();

  const [theme, setTheme] = useState(() =>
    readTheme(typeof window === "undefined" ? null : window.localStorage),
  );

  const nastepny = otherTheme(theme);

  const przelacz = () => {
    const ustawiony = applyTheme(document.documentElement, nastepny);

    saveTheme(window.localStorage, ustawiony);

    setTheme(ustawiony);
  };

  // Całe zdanie w słowniku, a nie sklejane z "Przełącz na motyw" i nazwy
  // motywu: po niemiecku wychodzi "Zum hellen Design wechseln" - przymiotnik
  // stoi w środku, a po rosyjsku zmienia się jego końcówka. Sklejanie
  // działałoby wyłącznie po polsku.
  const opis =
    nastepny === "light" ? t("theme.toggle.light") : t("theme.toggle.dark");

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={przelacz}
      // Tytuł i etykieta mówią, co się STANIE po kliknięciu, a nie jaki
      // motyw jest teraz - ikona i tak pokazuje stan bieżący.
      title={opis}
      aria-label={opis}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
    </button>
  );
}

export default ThemeToggle;
