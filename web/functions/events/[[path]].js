import { isCrawler, eventMeta, rewriteHtml } from "../../src/lib/ogMeta.js";

// Podgląd linku do turnieju.
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

export async function onRequest({ request, env, params }) {
  const zasob = () => env.ASSETS.fetch(request);

  if (!isCrawler(request.headers.get("user-agent"))) {
    return zasob();
  }

  try {
    // params.path to tablica segmentów po /events/. Slug to pierwszy z nich;
    // podstrony turnieju (ranking, mecze, profil gracza) dostają kartę tego
    // samego turnieju, co jest i tak znacznie lepsze niż karta ogólna.
    const slug = Array.isArray(params?.path) ? params.path[0] : params?.path;

    if (!slug) return zasob();

    const odp = await fetch(`${env.API_URL || API}/api/public/events`, {
      signal: AbortSignal.timeout(LIMIT_MS),
      headers: { accept: "application/json" },
    });

    if (!odp.ok) return zasob();

    const dane = await odp.json();

    const event = (dane.events || []).find(
      (e) => e.slug === decodeURIComponent(slug),
    );

    const meta = eventMeta(event, new URL(request.url).pathname);

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
