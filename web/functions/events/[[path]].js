import {
  isCrawler,
  eventMeta,
  playerEventMeta,
  rewriteHtml,
} from "../../src/lib/ogMeta.js";

// Podgląd linku do turnieju i do profilu gracza w turnieju.
//
// Cloudflare Pages oddaje ten sam index.html pod każdym adresem, a boty
// budujące podgląd nie wykonują JavaScriptu - więc bez tej funkcji wklejenie
// na Discorda adresu dowolnego turnieju daje kartę "Pick'Em — typuj mecze
// esportowe", tę samą co strona główna.
//
// DWIE ZASADY, OD KTÓRYCH ZALEŻY BEZPIECZEŃSTWO TEJ FUNKCJI:
//
//  1. Zwykły użytkownik NIE przechodzi przez przepisywanie. Wychodzi w
//     pierwszej linii z plikiem statycznym, dokładnie tym co dziś. Dzięki
//     temu błąd w podmianie może dotknąć wyłącznie bota, a nie człowieka
//     czytającego stronę - a przy okazji nie ma zapytania do API przy
//     każdym wejściu na stronę turnieju.
//
//  2. KAŻDA awaria kończy się plikiem statycznym. Brak API, zły JSON, timeout,
//     nieznany slug - wszystko schodzi do `return zasob()`, czyli do
//     zachowania sprzed tej zmiany. Najgorszy możliwy skutek to karta taka
//     jak dziś, nigdy strona, która się nie otwiera.

const API = "https://api.pickembot.pl";

// Bot czekający na podgląd i tak czeka, ale nie w nieskończoność - bez tego
// zawieszone API zawiesza też funkcję.
const LIMIT_MS = 3000;

async function pobierzJson(url) {
  const odp = await fetch(url, {
    signal: AbortSignal.timeout(LIMIT_MS),
    headers: { accept: "application/json" },
  });

  return odp.ok ? odp.json() : null;
}

export async function onRequest({ request, env, params }) {
  const zasob = () => env.ASSETS.fetch(request);

  if (!isCrawler(request.headers.get("user-agent"))) {
    return zasob();
  }

  try {
    // params.path to tablica segmentów po /events/.
    const czesci = Array.isArray(params?.path)
      ? params.path
      : [params?.path].filter(Boolean);

    const slug = czesci[0];

    if (!slug) return zasob();

    const api = env.API_URL || API;

    // PROFIL GRACZA MA WŁASNĄ KARTĘ.
    //
    // To jest najczęściej wklejany adres w serwisie - „zobacz mój profil" -
    // a dostawał kartę turnieju: nazwę imprezy i liczbę typujących, bez
    // słowa o tym, czyj to profil i jak mu poszło.
    //
    // Pozostałe podstrony turnieju (ranking, mecze, typy na fazy, pojedynek)
    // zostają przy karcie turnieju. Dla nich to jest właściwa odpowiedź na
    // pytanie „co to za link", a pojedynek dwóch graczy wymagałby dwóch
    // dodatkowych zapytań o same nazwy.
    const userId = czesci[1] === "player" ? czesci[2] : null;

    const adresProfilu = userId
      ? `${api}/api/public/events/${encodeURIComponent(slug)}/players/${encodeURIComponent(userId)}`
      : null;

    // Oba zapytania naraz: żadne nie potrzebuje wyniku drugiego, a bot
    // czeka na podgląd tylko tyle, ile trwa wolniejsze z nich.
    const [dane, profil] = await Promise.all([
      pobierzJson(`${api}/api/public/events`),
      adresProfilu ? pobierzJson(adresProfilu).catch(() => null) : null,
    ]);

    if (!dane) return zasob();

    const event = (dane.events || []).find(
      (e) => e.slug === decodeURIComponent(slug),
    );

    const sciezka = new URL(request.url).pathname;

    // Gdy profilu nie udało się pobrać, zostaje karta turnieju - a nie brak
    // karty. Ta sama zasada, co przy każdej innej awarii w tym pliku.
    const meta =
      (profil?.profile && playerEventMeta(profil.profile, event, sciezka)) ||
      eventMeta(event, sciezka);

    if (!meta) return zasob();

    const strona = await env.ASSETS.fetch(
      new URL("/index.html", request.url),
    );

    const html = rewriteHtml(await strona.text(), meta);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",

        // Podgląd u bota i tak jest buforowany po jego stronie; krótki bufor
        // na brzegu oszczędza API przy linku wklejonym na kilku kanałach.
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    // Celowo po cichu: to jest ścieżka podglądu, nie strony. Wyjątek tutaj
    // nie może zabrać nikomu dostępu do serwisu.
    return zasob();
  }
}
