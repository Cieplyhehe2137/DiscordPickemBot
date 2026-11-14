// Adresy stron serwisu - z jednego miejsca.
//
// Bot nie linkował na stronę ANI RAZU: zero wystąpień adresu w handlers,
// commands, utils i services. Serwis ma 26 widoków i 19 tysięcy rozliczonych
// typów, a cała społeczność siedzi na Discordzie i nikt jej tam nie wysyłał -
// stąd 375 wizyt w sumie i jedna dzisiaj.
//
// Adres idzie z PUBLIC_SITE_URL w config/_base.env, bo jest wspólny dla
// wszystkich serwerów, tak samo jak token bota. Brak tego klucza NIE jest
// błędem: funkcja zwraca wtedy null, a wiadomość wychodzi bez linków. Nowa
// konfiguracja nie może zepsuć postów, które działały wcześniej.
//
// Ścieżki odpowiadają trasom Reacta z web/src/App.jsx. Zmiana tam wymaga
// zmiany tutaj - i właśnie dlatego jest to jedno miejsce, a nie napis
// wklejony w każdym poście.

/**
 * Buduje adresy stron dla jednego serwera i jednego turnieju.
 *
 * @returns {null|{home:string, upsets:string, allTime:string,
 *                 server?:string, event?:string, leaderboard?:string,
 *                 myStats?:string}}
 */
function siteLinks({ baseUrl, guildSlug, eventSlug } = {}) {
  // Ucięty ogonek ukośników, żeby nie wyszło z tego "//events".
  const base = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");

  if (!base) return null;

  const links = {
    home: base,
    upsets: `${base}/upsets`,
    allTime: `${base}/all-time`,
  };

  const serwer = String(guildSlug || "").trim();

  if (serwer) {
    links.server = `${base}/servers/${encodeURIComponent(serwer)}`;
  }

  const turniej = String(eventSlug || "").trim();

  if (turniej) {
    const e = encodeURIComponent(turniej);

    links.event = `${base}/events/${e}`;
    links.leaderboard = `${base}/events/${e}/leaderboard`;
    links.myStats = `${base}/events/${e}/my-stats`;
  }

  return links;
}

module.exports = { siteLinks };
