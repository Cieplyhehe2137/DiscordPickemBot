// Ktore originy wolno wpuscic w CORS.
//
// To jest decyzja bezpieczenstwa, a siedziala nieprzetestowana w srodku
// 12-tysiecznego pliku. Tutaj jest osobno i ma testy.
//
// Kontekst: domyslne wdrozenie jest jednoprocesowe - Express serwuje web/dist
// spod tego samego adresu co /api - wiec ciasteczko sesji jest same-site i CORS
// nie jest w ogole potrzebny. Rozdzielenie hostow (front na Cloudflare Pages)
// wymaga naraz dopuszczenia originu z credentials, SameSite=None; Secure na
// ciasteczku i HTTPS po stronie API; przegladarka odrzuci ciasteczko, jesli
// czegokolwiek zabraknie.

// WEB_ORIGIN przyjmuje liste po przecinku. Kazdy wpis jest przycinany i
// pozbawiany koncowych ukosnikow, zeby "https://a.pl/" i "https://a.pl"
// znaczyly to samo - inaczej jeden zapis w konfiguracji dziala, a drugi nie.
export function zbudujDozwoloneOriginy(webOrigin) {
  return String(webOrigin || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

// Zwraca funkcje sprawdzajaca - dzieki temu miejsca uzycia w app.js wolaja ja
// tak samo jak wczesniej, bez przekazywania konfiguracji przy kazdym zapytaniu.
//
// `sufiks` istnieje dla Cloudflare Pages: kazdy podglad dostaje wlasny adres
// <hash>.<projekt>.pages.dev, wiec pojedynczy wpis na liscie nie wystarcza.
export function utworzSprawdzanieOriginu({ dozwolone = [], sufiks = "" } = {}) {
  const lista = dozwolone;
  const koncowka = String(sufiks || "").trim();

  return function czyDozwolonyOrigin(origin) {
    // Brak naglowka Origin to zadanie nie z przegladarki (curl, health check)
    // albo same-origin - nie ma czego blokowac.
    if (!origin) return true;

    const czysty = String(origin).replace(/\/+$/, "");

    if (lista.includes(czysty)) return true;

    return Boolean(koncowka) && czysty.endsWith(koncowka);
  };
}
