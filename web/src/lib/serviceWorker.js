// Rejestracja service workera - warunek instalacji aplikacji na telefonie.
//
// Wyłącznie w wersji produkcyjnej. Worker w trybie deweloperskim to klasyczna
// pułapka: przechwytuje moduły podawane przez Vite i zaczyna serwować
// poprzednią wersję pliku, którego się właśnie nie może doczekać. Objaw
// wygląda jak zepsuty kod, a przyczyną jest pamięć podręczna.
//
// Rejestracja po `load`, a nie od razu: pobranie workera konkuruje wtedy
// z pobieraniem tego, co jest potrzebne do pokazania pierwszego ekranu.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Brak workera oznacza brak instalacji i brak trybu bez sieci - i tyle.
      // Strona działa dalej, więc to nie jest powód, żeby cokolwiek przerywać.
      console.error("SERVICE WORKER ERROR:", err);
    });
  });
}
