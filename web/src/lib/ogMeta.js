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
 * Opis profilu gracza W JEDNYM TURNIEJU.
 *
 * To jest najczęściej wklejany rodzaj adresu w serwisie, który cały żyje
 * na Discordzie - „zobacz mój profil". Do tej pory dostawał kartę TURNIEJU,
 * bo funkcja brzegowa rozpoznawała tylko pierwszy segment ścieżki. Zmierzone
 * na produkcji: adres profilu zwycięzcy Budapesztu dawał kartę „StarLadder
 * Budapest Major 2025 · Turniej zakończony · 509 typujących" - ani nazwy
 * gracza, ani jego wyniku.
 *
 * Nazwa turnieju zostaje w tytule, bo bez niej „Lemonziiko — Pick'Em" nie
 * mówi, czego dotyczy link.
 */
export function playerEventMeta(profile, event, path) {
  const nazwa = profile?.displayname;

  if (!nazwa) return null;

  // NIEISTNIEJĄCY GRACZ TEŻ DOSTAJE ODPOWIEDŹ 200.
  //
  // Trasa profilu oddaje wtedy komplet zer, a jako `displayname` samo
  // user_id z adresu - bo tak wygląda gracz, którego nie ma w
  // user_profiles. Bez tego sprawdzenia podgląd zmyślonego adresu
  // pokazywał kartę „000000000000000000 — IEM Kraków 2026 · 0 pkt";
  // wyszło to dopiero na uruchomieniu funkcji brzegowej na żywym API.
  //
  // Ślad po udziale, a nie sama nazwa: ktoś bez miejsca, punktów
  // i typów nie ma na tej karcie czego pokazać, więc lepsza jest
  // karta turnieju.
  const zagral =
    profile.rank > 0 ||
    Number(profile.total_points) > 0 ||
    Number(profile.total_predictions) > 0;

  if (!zagral) return null;

  const czesci = [];

  // Miejsce razem ze stawką - „#1" bez „z 509" nie mówi, ile było warte.
  if (profile.rank > 0) {
    czesci.push(
      event?.participants > 0
        ? `#${profile.rank} z ${event.participants}`
        : `#${profile.rank}`,
    );
  }

  czesci.push(`${profile.total_points ?? 0} pkt`);

  // Skuteczność tylko wtedy, gdy stoi za nią choć jeden rozliczony mecz.
  // Turniej bez meczów w bazie ma ją zerową dla wszystkich i „0%" na karcie
  // czytałoby się jak ocena gracza, a nie jak brak danych.
  if (profile.finished_predictions > 0) {
    czesci.push(`${profile.accuracy}% trafień`);
  }

  const tytul = event?.name ? `${nazwa} — ${event.name}` : `${nazwa} — Pick'Em`;

  return {
    title: tytul,
    description: `${czesci.join(" · ")}.`,
    url: `${STRONA}${path}`,
  };
}

/**
 * Opis dorobku gracza PONAD turniejami (/player/:id).
 *
 * Ten adres nie miał własnej karty wcale - dostawał kartę strony głównej,
 * razem z jej adresem, więc podgląd potrafił prowadzić gdzie indziej niż
 * wklejony link.
 */
export function playerCareerMeta(dane, path) {
  const nazwa = dane?.player?.displayname;

  if (!nazwa) return null;

  const s = dane.summary || {};

  const czesci = [];

  if (s.starts > 0) {
    czesci.push(s.starts === 1 ? "1 start" : `${s.starts} starty`);
  }

  if (s.total_points > 0) czesci.push(`${s.total_points} pkt łącznie`);

  // Najlepszy start mówi więcej niż średnia: to jest zdanie, które
  // wkleja się znajomym.
  if (s.best?.rank > 0 && s.best?.name) {
    czesci.push(
      s.best.participants > 0
        ? `najlepiej #${s.best.rank} z ${s.best.participants} (${s.best.name})`
        : `najlepiej #${s.best.rank} (${s.best.name})`,
    );
  }

  return {
    title: `${nazwa} — dorobek w Pick'Em`,

    description: czesci.length
      ? `${czesci.join(" · ")}.`
      : "Jeszcze bez rozliczonego startu.",

    url: `${STRONA}${path}`,
  };
}

/**
 * Opis społeczności (/servers/:slug).
 *
 * Serwis obsługuje kilka serwerów Discorda i to jest adres, który wysyła
 * się „do siebie na kanał" - a pokazywał kartę strony głównej.
 */
export function serverMeta(server, path) {
  if (!server?.name) return null;

  const ile = Number(server.events_count) || 0;

  const turnieje =
    ile === 1 ? "1 turniej" : ile > 1 && ile < 5 ? `${ile} turnieje` : `${ile} turniejów`;

  const otwarte = Number(server.open_events) || 0;

  return {
    title: `${server.name} — Pick'Em`,

    description: ile
      ? `${turnieje}${otwarte > 0 ? ", typowanie otwarte" : ""}. Ranking społeczności i statystyki graczy.`
      : "Ranking społeczności i statystyki graczy.",

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
