import { isCrawler, playerCareerMeta, rewriteHtml } from "../../src/lib/ogMeta.js";

// Podgląd linku do dorobku gracza ponad turniejami (/player/:id).
//
// Ten adres nie miał własnej karty w ogóle: wklejony na Discorda pokazywał
// kartę strony głównej, razem z JEJ adresem w og:url - czyli podgląd
// potrafił prowadzić gdzie indziej niż link, który się wkleiło.
//
// Te same dwie zasady co przy turniejach i drużynach: zwykły użytkownik nie
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
    const userId = Array.isArray(params?.path) ? params.path[0] : params?.path;

    if (!userId) return zasob();

    const odp = await fetch(
      `${env.API_URL || API}/api/public/players/${encodeURIComponent(userId)}`,
      {
        signal: AbortSignal.timeout(LIMIT_MS),
        headers: { accept: "application/json" },
      },
    );

    if (!odp.ok) return zasob();

    const meta = playerCareerMeta(
      await odp.json(),
      new URL(request.url).pathname,
    );

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
