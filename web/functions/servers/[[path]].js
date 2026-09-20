import { isCrawler, serverMeta, rewriteHtml } from "../../src/lib/ogMeta.js";

// Podgląd linku do strony społeczności (/servers/:slug).
//
// Serwis obsługuje kilka serwerów Discorda i to jest adres, który wysyła się
// „do siebie na kanał". Pokazywał kartę strony głównej.
//
// Lista serwerów to jedno zapytanie na cały zbiór (dziś 202 bajty), więc
// filtrujemy ją po slugu tutaj, zamiast prosić API o osobną trasę.
//
// Te same dwie zasady co w pozostałych funkcjach: zwykły użytkownik nie
// przechodzi przez przepisywanie, a każda awaria kończy się plikiem
// statycznym.

const API = "https://api.pickembot.pl";

const LIMIT_MS = 3000;

export async function onRequest({ request, env, params }) {
  const zasob = () => env.ASSETS.fetch(request);

  if (!isCrawler(request.headers.get("user-agent"))) {
    return zasob();
  }

  try {
    const slug = Array.isArray(params?.path) ? params.path[0] : params?.path;

    if (!slug) return zasob();

    const odp = await fetch(`${env.API_URL || API}/api/public/servers`, {
      signal: AbortSignal.timeout(LIMIT_MS),
      headers: { accept: "application/json" },
    });

    if (!odp.ok) return zasob();

    const dane = await odp.json();

    const server = (dane.servers || []).find(
      (s) => s.slug === decodeURIComponent(slug),
    );

    const meta = serverMeta(server, new URL(request.url).pathname);

    if (!meta) return zasob();

    const strona = await env.ASSETS.fetch(new URL("/index.html", request.url));

    const html = rewriteHtml(await strona.text(), meta);

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return zasob();
  }
}
