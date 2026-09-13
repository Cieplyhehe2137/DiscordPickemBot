// Service worker: tyle, ile trzeba, żeby aplikacja dała się zainstalować
// i żeby coś pokazała bez sieci. Pisany ręcznie, bez Workboksa - całość mieści
// się na jednym ekranie i widać dokładnie, co i kiedy trafia do pamięci.
//
// Zasada nadrzędna: PAMIĘĆ NIGDY NIE DOTYKA API. Wyniki meczów, rankingi
// i sesja logowania idą prosto do sieci i nic z nich nie jest zapisywane.
// Nieświeży wynik meczu jest gorszy niż brak wyniku - pokazany z pamięci
// wyglądałby dokładnie tak samo jak prawdziwy.

// Nazwa z numerem: podbicie numeru kasuje wszystko, co zostało po poprzedniej
// wersji. Przy zwykłym wdrożeniu nie trzeba tego ruszać - pliki w /assets/
// mają skrót treści w nazwie, więc nowe wersje to po prostu nowe adresy.
const CACHE = "pickem-v1";

// Powłoka aplikacji: dokument, który React wypełnia. Trzymamy go pod stałym
// adresem, bo każda ścieżka w aplikacji dostaje ten sam index.html
// (patrz public/_redirects).
const POWLOKA = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // `reload` omija pamięć podręczną przeglądarki - przy instalacji chcemy
      // dokument z sieci, a nie kopię sprzed wdrożenia.
      await cache.add(new Request(POWLOKA, { cache: "reload" }));

      // Nowy worker przejmuje od razu, bez czekania, aż użytkownik zamknie
      // wszystkie karty. Przy sieci-pierwszej dla nawigacji nie grozi to
      // pokazaniem starej wersji.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const nazwa of await caches.keys()) {
        if (nazwa !== CACHE) await caches.delete(nazwa);
      }

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Tylko GET. Zapis typu to POST i nie ma go po co przechwytywać.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Obce pochodzenie - czyli API na api.pickembot.pl i awatary z Discorda.
  // Brak respondWith oznacza "przeglądarko, zrób to po swojemu".
  if (url.origin !== self.location.origin) return;

  // API przez pośrednika na tym samym pochodzeniu (tak działa serwer
  // deweloperski) - ta sama zasada.
  if (url.pathname.startsWith("/api/")) return;

  // Nawigacja: sieć pierwsza. Dzięki temu świeże wdrożenie wchodzi od razu,
  // a pamięć jest wyłącznie zapasem na brak sieci.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const odpowiedz = await fetch(request);

          const cache = await caches.open(CACHE);
          await cache.put(POWLOKA, odpowiedz.clone());

          return odpowiedz;
        } catch {
          const zapas = await caches.match(POWLOKA);

          return zapas ?? Response.error();
        }
      })(),
    );

    return;
  }

  // Pliki z /assets/ mają skrót treści w nazwie, więc ten sam adres zawsze
  // znaczy tę samą zawartość. Pamięć pierwsza jest tu bezpieczna z definicji
  // i to ona sprawia, że aplikacja wstaje bez sieci.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const zPamieci = await caches.match(request);

        if (zPamieci) return zPamieci;

        const odpowiedz = await fetch(request);

        if (odpowiedz.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, odpowiedz.clone());
        }

        return odpowiedz;
      })(),
    );
  }
});
