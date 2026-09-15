import { isCrawler, teamMeta, rewriteHtml } from "../../src/lib/ogMeta.js";

// Podgląd linku do drużyny. Te same dwie zasady co przy turniejach:
// zwykły użytkownik nie przechodzi przez przepisywanie, a każda awaria
// kończy się plikiem statycznym.

const API = "https://api.pickembot.pl";

const LIMIT_MS = 3000;

export async function onRequest({ request, env, params }) {
  const zasob = () => env.ASSETS.fetch(request);

  if (!isCrawler(request.headers.get("user-agent"))) {
    return zasob();
  }

  try {
    const nazwa = Array.isArray(params?.path) ? params.path[0] : params?.path;

    if (!nazwa) return zasob();

    // Nazwa w adresie jest czytelna dla człowieka ("/teams/FaZe") - trasa
    // po stronie API sama sprowadza ją do klucza.
    const odp = await fetch(
      `${env.API_URL || API}/api/public/teams/${encodeURIComponent(
        decodeURIComponent(nazwa),
      )}`,
      {
        signal: AbortSignal.timeout(LIMIT_MS),
        headers: { accept: "application/json" },
      },
    );

    if (!odp.ok) return zasob();

    const dane = await odp.json();

    const meta = teamMeta(dane.team, new URL(request.url).pathname);

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
