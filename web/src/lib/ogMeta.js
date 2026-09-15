// Podgląd linku: tytuł, opis i adres dla konkretnej podstrony.
//
// Cloudflare Pages oddaje ten sam index.html pod każdym adresem (reguła
// w _redirects), a boty budujące podgląd nie wykonują JavaScriptu - więc
// tagi ustawione przez Reacta nie mają dla nich znaczenia. Sprawdzone:
// dziś wklejenie na Discorda adresu dowolnego turnieju daje kartę
// "Pick'Em — typuj mecze esportowe", tę samą co strona główna.
//
// Ten moduł jest CZYSTY - żadnego pobierania i żadnego Cloudflare.
// Funkcja brzegowa dostarcza dane i gotowy HTML, a tutaj zapada decyzja,
// co w nim podmienić. Dzięki temu całość da się przetestować zwyczajnie,
// bez środowiska Workers, którego lokalnie nie ma.

const STRONA = "https://pickembot.pl";

/**
 * Czy to bot budujący podgląd linku.
 *
 * Lista jest zamknięta i celowo krótka. Nie chodzi o wykrycie każdego bota,
 * tylko o to, żeby ZWYKŁY UŻYTKOWNIK nigdy nie przechodził przez przepisywanie:
 * dla niego funkcja ma oddać plik statyczny i nie robić nic więcej - bez
 * zapytania do API przy każdym wejściu i bez ryzyka, że błąd w podmianie
 * zepsuje stronę komuś, kto po prostu ją czyta.
 */
export function isCrawler(userAgent) {
  const ua = String(userAgent || "").toLowerCase();

  if (!ua) return false;

  return [
    "discordbot",
    "twitterbot",
    "facebookexternalhit",
    "slackbot",
    "telegrambot",
    "whatsapp",
    "linkedinbot",
    "embedly",
    "redditbot",
    "skypeuripreview",
    "vkshare",
    "bufferbot",
  ].some((bot) => ua.includes(bot));
}

// Znaki, które w atrybucie HTML kończyłyby wartość wcześniej, niż trzeba.
// Nazwy turniejów i drużyn wpisuje administrator, więc mogą zawierać
// cudzysłów - bez tego podmiana rozsypałaby cały znacznik.
export function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Opis turnieju: to, co widać na karcie pod tytułem.
 */
export function eventMeta(event, path) {
  if (!event?.name) return null;

  const czesci = [];

  if (event.participants > 0) czesci.push(`${event.participants} typujących`);

  if (event.matches_count > 0) czesci.push(`${event.matches_count} meczów`);

  const stan = event.is_archived
    ? "Turniej zakończony"
    : event.is_live
      ? "Trwa teraz"
      : "Zapowiedź";

  return {
    title: `${event.name} — Pick'Em`,

    description: czesci.length
      ? `${stan} · ${czesci.join(" · ")}. Typuj mecze i śledź ranking.`
      : `${stan}. Typuj mecze i śledź ranking.`,

    url: `${STRONA}${path}`,
  };
}

/**
 * Opis drużyny.
 */
export function teamMeta(team, path) {
  if (!team?.name) return null;

  const bilans =
    team.settled > 0
      ? `Bilans ${team.wins}–${team.losses}`
      : "Jeszcze bez rozegranych meczów";

  const zaufanie =
    team.trust !== null && team.trust !== undefined
      ? ` · ${team.trust}% typów stawiało na nią`
      : "";

  return {
    title: `${team.name} — Pick'Em`,
    description: `${bilans}${zaufanie}.`,
    url: `${STRONA}${path}`,
  };
}

/**
 * Wstawia tytuł, opis i adres do gotowego HTML-a.
 *
 * Podmiana, a nie doklejanie: znacznik, który wystąpi drugi raz, bywa
 * ignorowany przez jedne boty i brany przez inne, więc karta wyglądałaby
 * różnie w zależności od komunikatora.
 */
export function rewriteHtml(html, meta) {
  if (!html || !meta) return html;

  const title = escapeAttr(meta.title);
  const description = escapeAttr(meta.description);
  const url = escapeAttr(meta.url);

  // \s+ między atrybutami, bo część znaczników w index.html jest łamana na
  // kilka linii i tak zostaje po zbudowaniu - Vite nie zwija tam białych
  // znaków. Regex pisany pod jedną spację nie trafiłby w `description`
  // ani w `og:description` i podmiana po cichu nie zrobiłaby nic.
  return String(html)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${description}$2`,
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      `$1${title}$2`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      `$1${description}$2`,
    )
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`);
}
