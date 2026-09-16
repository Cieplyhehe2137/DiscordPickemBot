// Mapa strony dla wyszukiwarek.
//
// Adresy /robots.txt i /sitemap.xml oddawały do tej pory STRONĘ z kodem 200,
// bo łapała je reguła `/*  /index.html  200` z web/public/_redirects. Dla
// wyszukiwarki wyglądało to jak sitemapa, która nie jest XML-em - czyli
// gorzej niż jej brak.
//
// robots.txt jest plikiem statycznym (web/public/robots.txt), bo się nie
// zmienia. Sitemapa musi znać listę turniejów i drużyn, więc powstaje
// w funkcji brzegowej Pages - patrz web/functions/sitemap.xml.js.
//
// Ten moduł jest czysty i NIE IMPORTUJE niczego: dzięki temu da się go
// zaimportować w teście node:test, tak samo jak web/src/lib/scoring.js.

/**
 * Znaki, które w XML-u znaczą coś innego niż same siebie.
 *
 * Adresy przechodzą przez encodeURIComponent, który zamienia "&" na "%26",
 * więc dziś żadna nazwa drużyny tego nie potrzebuje. Ucieczka zostaje mimo
 * to, bo to jest dokładnie ten rodzaj założenia, który przestaje być prawdą
 * po dodaniu jednej drużyny - a zepsuty XML wyszukiwarka odrzuca w całości,
 * nie tylko ten jeden wiersz.
 */
export function escapeXml(wartosc) {
  return String(wartosc ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Lista adresów do sitemapy.
 *
 * Świadomie NIE MA tu profili graczy. Jest ich ponad tysiąc, każdy to strona
 * o jednej osobie w jednym turnieju i żadna nie odpowiada na pytanie, które
 * ktoś wpisuje w wyszukiwarkę. Sitemapa ma pokazać, co w serwisie jest warte
 * znalezienia, a nie wszystko, co da się otworzyć.
 *
 * Nie ma też stron wymagających logowania (moje typy, moje statystyki) ani
 * panelu - te same adresy odcina robots.txt.
 */
export function pageUrls({ origin, events = [], teams = [] }) {
  const baza = String(origin || "").replace(/\/+$/, "");

  const adresy = [
    { loc: `${baza}/`, priority: "1.0" },
    { loc: `${baza}/events`, priority: "0.8" },
    { loc: `${baza}/teams`, priority: "0.8" },
    { loc: `${baza}/scoring`, priority: "0.5" },
  ];

  for (const event of events) {
    if (!event?.slug) continue;

    const slug = encodeURIComponent(event.slug);

    adresy.push({ loc: `${baza}/events/${slug}`, priority: "0.9" });

    // Ranking i lista meczów to osobne, pełnowartościowe strony tego samego
    // turnieju - a nie zakładki dorysowane na kliencie.
    adresy.push({ loc: `${baza}/events/${slug}/leaderboard`, priority: "0.7" });
    adresy.push({ loc: `${baza}/events/${slug}/matches`, priority: "0.7" });
  }

  for (const team of teams) {
    if (!team?.name) continue;

    // Ta sama zamiana co w linku na stronie drużyn: adres zawiera NAZWĘ,
    // nie klucz, a nazwy mają spacje i kropki ("Ninjas in Pyjamas", "BC.Game").
    adresy.push({
      loc: `${baza}/teams/${encodeURIComponent(team.name)}`,
      priority: "0.6",
    });
  }

  return adresy;
}

/**
 * Gotowy dokument sitemapy.
 *
 * `lastmod` jest wspólny dla całej mapy i celowo podawany z zewnątrz: żadne
 * z tych danych nie niesie własnej daty zmiany, a zmyślanie jej per adres
 * byłoby informacją nieprawdziwą.
 */
export function sitemapXml({ origin, events, teams, lastmod }) {
  const wiersze = pageUrls({ origin, events, teams }).map((adres) => {
    const data = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : "";

    return (
      `  <url>\n` +
      `    <loc>${escapeXml(adres.loc)}</loc>${data}\n` +
      `    <priority>${adres.priority}</priority>\n` +
      `  </url>`
    );
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${wiersze.join("\n")}\n` +
    `</urlset>\n`
  );
}
