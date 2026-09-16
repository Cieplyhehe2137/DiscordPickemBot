import { sitemapXml } from "../src/lib/sitemap.js";

// Mapa strony budowana przy zapytaniu.
//
// Funkcja, a nie plik statyczny, bo lista turniejów i drużyn zmienia się bez
// przebudowy frontu. Plik statyczny generowany w czasie budowania byłby
// nieaktualny od pierwszego nowego turnieju, a przy okazji uzależniałby
// budowanie od tego, czy API akurat odpowiada.
//
// Nazwa pliku "sitemap.xml.js" daje trasę /sitemap.xml - Pages obcina samo
// rozszerzenie .js.

const API = "https://api.pickembot.pl";

const LIMIT_MS = 3000;

// Jedna godzina. Sitemapa zmienia się przy nowym turnieju albo nowej drużynie,
// czyli kilka razy w roku - a odpytują ją roboty, nie ludzie.
const CACHE = "public, max-age=3600";

async function pobierz(url) {
  // Każde źródło osobno i każde wolno stracić. Sitemapa z samymi stronami
  // stałymi jest nadal poprawna i użyteczna; sitemapa, która nie odpowiedziała,
  // nie jest.
  try {
    const odp = await fetch(url, {
      signal: AbortSignal.timeout(LIMIT_MS),
      headers: { accept: "application/json" },
    });

    if (!odp.ok) return null;

    return await odp.json();
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  const api = env.API_URL || API;

  // Origin z zapytania, nie wpisany na sztywno: wtedy wdrożenie podglądowe
  // wystawia sitemapę z własnymi adresami, a nie z produkcyjnymi.
  const { origin } = new URL(request.url);

  const [eventy, druzyny] = await Promise.all([
    pobierz(`${api}/api/public/events`),
    pobierz(`${api}/api/public/teams`),
  ]);

  const xml = sitemapXml({
    origin,
    events: eventy?.events ?? [],
    teams: druzyny?.teams ?? [],
    lastmod: new Date().toISOString().slice(0, 10),
  });

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": CACHE,
    },
  });
}
