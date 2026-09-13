// NAGROBEK. Ten plik nie jest service workerem aplikacji - jest tym, co go
// usuwa. Do skasowania, ale nie od razu; warunek wyjścia jest na dole.
//
// Dlaczego nie dało się po prostu skasować poprzedniego pliku:
//
// Service worker, raz zarejestrowany, zostaje w przeglądarce i pracuje dalej,
// niezależnie od tego, co jest na serwerze. Przeglądarka sama sprawdza, czy
// jest nowa wersja skryptu, i wyrejestrowuje workera tylko wtedy, gdy dostanie
// 404 albo 410.
//
// A tu nie dostanie. public/_redirects oddaje index.html dla KAŻDEJ ścieżki,
// która nie jest plikiem - z kodem 200. Zapytanie o skasowany /sw.js wróciłoby
// więc jako strona HTML: aktualizacja przewróciłaby się na złym typie MIME,
// a stary worker zostałby aktywny. U każdego, kto wszedł na stronę w czasie,
// gdy aplikacja instalowalna była wdrożona. Na zawsze.
//
// Stąd ten plik: worker, który przy aktywacji kasuje pamięć poprzednika,
// wyrejestrowuje sam siebie i schodzi z drogi. Nie ma tu obsługi `fetch`,
// więc od chwili przejęcia nic już nie stoi między stroną a siecią.

self.addEventListener("install", () => {
  // Bez czekania na zamknięcie kart - im szybciej ten worker przejmie po
  // poprzedniku, tym szybciej zniknie ich obu.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const nazwa of await caches.keys()) {
        await caches.delete(nazwa);
      }

      await self.registration.unregister();

      // Strony otwarte w tej chwili są nadal kontrolowane przez workera,
      // który właśnie się wyrejestrował. Przeładowanie zdejmuje je spod jego
      // kontroli od razu, zamiast czekać, aż ktoś sam odświeży.
      for (const klient of await self.clients.matchAll({ type: "window" })) {
        klient.navigate(klient.url).catch(() => {});
      }
    })(),
  );
});

// KIEDY SKASOWAĆ TEN PLIK
//
// Wtedy, gdy można przyjąć, że każdy, kto miał zarejestrowanego workera, wszedł
// od tego czasu na stronę choć raz - bo dopiero to wejście uruchamia usunięcie.
// Miesiąc z zapasem wystarcza. Przedtem skasowanie go wraca do punktu wyjścia:
// zapytanie o /sw.js znowu oddawałoby HTML, a worker znowu zostawałby na stałe.
