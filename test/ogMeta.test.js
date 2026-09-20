// Podglad linku (web/src/lib/ogMeta.js).
//
// Najwazniejszy test w tym pliku sprawdza podmiane na PRAWDZIWYM
// web/index.html, a nie na wycinku napisanym pod regexy. Powod jest
// konkretny: dwa znaczniki w tym pliku - description i og:description -
// sa lamane na kilka linii i zostaja takie po zbudowaniu. Regex pisany
// pod jedna spacje nie trafia w nie wcale i podmiana po cichu nie robi nic,
// a wynik wyglada poprawnie, bo tytul sie zmienil.
//
// Taki sam blad siedzi dzis w server/app.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MODUL = "../web/src/lib/ogMeta.js";

const INDEX = path.join(__dirname, "..", "web", "index.html");

const META = {
  title: "IEM Kraków 2026 — Pick'Em",
  description: "Turniej zakończony · 262 typujących · 50 meczów.",
  url: "https://pickembot.pl/events/iem-krakow-2026",
};

// --- rozpoznawanie botow ---------------------------------------------------

test("boty budujace podglad sa rozpoznawane", async () => {
  const { isCrawler } = await import(MODUL);

  for (const ua of [
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Twitterbot/1.0",
    "facebookexternalhit/1.1",
    "Slackbot-LinkExpanding 1.0",
    "TelegramBot (like TwitterBot)",
    "WhatsApp/2.19.81 A",
  ]) {
    assert.ok(isCrawler(ua), `nierozpoznany: ${ua}`);
  }
});

test("zwykla przegladarka NIE jest botem", async () => {
  // To jest cala ochrona przed tym, zeby blad w podmianie dotknal czytelnika.
  const { isCrawler } = await import(MODUL);

  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari/605.1",
    "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0",
  ]) {
    assert.ok(!isCrawler(ua), `wzieta za bota: ${ua}`);
  }
});

test("brak naglowka User-Agent to nie bot", async () => {
  const { isCrawler } = await import(MODUL);

  assert.equal(isCrawler(""), false);
  assert.equal(isCrawler(null), false);
  assert.equal(isCrawler(undefined), false);
});

// --- podmiana w prawdziwym pliku -------------------------------------------

test("podmiana trafia we WSZYSTKIE znaczniki prawdziwego index.html", async () => {
  const { rewriteHtml } = await import(MODUL);

  const html = fs.readFileSync(INDEX, "utf8");
  const wynik = rewriteHtml(html, META);

  // Kazdy znacznik osobno, zeby bylo widac KTORY nie trafil.
  assert.ok(
    wynik.includes(`<title>${META.title}</title>`),
    "tytul strony nie podmieniony",
  );

  assert.ok(
    /<meta\s+property="og:title"\s+content="IEM Kraków 2026 — Pick'Em"/.test(wynik),
    "og:title nie podmieniony",
  );

  assert.ok(
    /<meta\s+property="og:description"\s+content="Turniej zakończony/.test(wynik),
    "og:description nie podmieniony - to ten lamany na kilka linii",
  );

  assert.ok(
    /<meta\s+name="description"\s+content="Turniej zakończony/.test(wynik),
    "description nie podmieniony - to ten lamany na kilka linii",
  );

  assert.ok(
    wynik.includes(`content="${META.url}"`),
    "og:url nie podmieniony",
  );
});

test("po podmianie nie zostaje ani slad domyslnego opisu", async () => {
  // Gdyby ktorys regex nie trafil, w pliku zostalby stary opis - i cz.esc
  // botow wzielaby wlasnie ten.
  const { rewriteHtml } = await import(MODUL);

  const html = fs.readFileSync(INDEX, "utf8");
  const wynik = rewriteHtml(html, META);

  assert.ok(
    !wynik.includes("Platforma Pick'Em dla społeczności esportowej"),
    "domyslny opis przetrwal podmiane",
  );

  assert.ok(
    !wynik.includes("<title>Pick'Em — typuj mecze esportowe</title>"),
    "domyslny tytul przetrwal podmiane",
  );
});

test("obrazek i pozostale znaczniki zostaja nietkniete", async () => {
  const { rewriteHtml } = await import(MODUL);

  const html = fs.readFileSync(INDEX, "utf8");
  const wynik = rewriteHtml(html, META);

  assert.ok(wynik.includes('content="https://pickembot.pl/og.jpg"'));
  assert.ok(wynik.includes('content="summary_large_image"'));
  assert.ok(wynik.includes('property="og:site_name"'));
});

test("brak danych zostawia HTML bez zmian", async () => {
  const { rewriteHtml } = await import(MODUL);

  const html = fs.readFileSync(INDEX, "utf8");

  assert.equal(rewriteHtml(html, null), html);
  assert.equal(rewriteHtml(html, undefined), html);
});

// --- znaki specjalne -------------------------------------------------------

test("cudzyslow w nazwie nie rozwala znacznika", async () => {
  // Nazwy turniejow i druzyn wpisuje administrator.
  const { rewriteHtml, escapeAttr } = await import(MODUL);

  assert.equal(escapeAttr('Turniej "X"'), "Turniej &quot;X&quot;");

  const html = fs.readFileSync(INDEX, "utf8");

  const wynik = rewriteHtml(html, {
    title: 'Puchar "Zimowy" — Pick\'Em',
    description: "Opis",
    url: "https://pickembot.pl/events/x",
  });

  assert.ok(wynik.includes("Puchar &quot;Zimowy&quot;"));

  // Po podmianie liczba znacznikow ma zostac ta sama - rozwalony atrybut
  // dalby tu inny wynik.
  const przed = (html.match(/<meta/g) || []).length;
  const po = (wynik.match(/<meta/g) || []).length;

  assert.equal(po, przed);
});

test("ostry nawias w nazwie nie wstrzykuje znacznika", async () => {
  const { escapeAttr } = await import(MODUL);

  assert.equal(
    escapeAttr('<script>alert(1)</script>'),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
});

// --- opisy -----------------------------------------------------------------

test("opis turnieju niesie stan i liczby", async () => {
  const { eventMeta } = await import(MODUL);

  const m = eventMeta(
    {
      name: "IEM Kraków 2026",
      participants: 262,
      matches_count: 50,
      is_archived: true,
    },
    "/events/iem-krakow-2026",
  );

  assert.equal(m.title, "IEM Kraków 2026 — Pick'Em");
  assert.ok(m.description.includes("Turniej zakończony"));
  assert.ok(m.description.includes("262 typujących"));
  assert.ok(m.description.includes("50 meczów"));
  assert.equal(m.url, "https://pickembot.pl/events/iem-krakow-2026");
});

test("turniej bez meczow nie chwali sie zerem meczow", async () => {
  // StarLadder Budapest ma 509 typujacych i ZERO meczow - taki turniej
  // istnieje w bazie naprawde.
  const { eventMeta } = await import(MODUL);

  const m = eventMeta(
    { name: "Budapeszt", participants: 509, matches_count: 0, is_archived: true },
    "/events/b",
  );

  assert.ok(m.description.includes("509 typujących"));
  assert.ok(!m.description.includes("0 meczów"));
});

test("turniej trwajacy i zapowiedziany maja inny stan", async () => {
  const { eventMeta } = await import(MODUL);

  const trwa = eventMeta({ name: "A", is_live: true }, "/events/a");
  const zapowiedz = eventMeta({ name: "B" }, "/events/b");

  assert.ok(trwa.description.includes("Trwa teraz"));
  assert.ok(zapowiedz.description.includes("Zapowiedź"));
});

test("brak turnieju daje null, a nie karte o niczym", async () => {
  const { eventMeta, teamMeta } = await import(MODUL);

  assert.equal(eventMeta(null, "/x"), null);
  assert.equal(eventMeta({}, "/x"), null);
  assert.equal(teamMeta(null, "/x"), null);
});

test("opis druzyny niesie bilans i zaufanie", async () => {
  const { teamMeta } = await import(MODUL);

  const m = teamMeta(
    { name: "FURIA", settled: 13, wins: 10, losses: 3, trust: 72 },
    "/teams/FURIA",
  );

  assert.equal(m.title, "FURIA — Pick'Em");
  assert.ok(m.description.includes("10–3"));
  assert.ok(m.description.includes("72%"));
});

test("druzyna bez rozegranych meczow nie pokazuje bilansu 0-0", async () => {
  const { teamMeta } = await import(MODUL);

  const m = teamMeta({ name: "Nowa", settled: 0, wins: 0, losses: 0 }, "/teams/N");

  assert.ok(m.description.includes("Jeszcze bez rozegranych"));
  assert.ok(!m.description.includes("0–0"));
});

// --- Karta profilu gracza ---------------------------------------------------

test("karta profilu mowi, KTO i jak mu poszlo", async () => {
  // Zmierzone na produkcji: ten adres dawal karte turnieju - "StarLadder
  // Budapest Major 2025 - Turniej zakonczony - 509 typujacych". Ani nazwy
  // gracza, ani wyniku, mimo ze to zwyciezca tego turnieju.
  const { playerEventMeta } = await import(MODUL);

  const meta = playerEventMeta(
    { displayname: "pieka", rank: 1, total_points: 316, accuracy: 69, finished_predictions: 106 },
    { name: "IEM Cologne Major 2026", participants: 523 },
    "/events/iem-cologne-major-2026/player/1216263156742094870",
  );

  assert.equal(meta.title, "pieka — IEM Cologne Major 2026");
  assert.equal(meta.description, "#1 z 523 · 316 pkt · 69% trafień.");
  assert.equal(
    meta.url,
    "https://pickembot.pl/events/iem-cologne-major-2026/player/1216263156742094870",
  );
});

test("turniej bez meczow nie chwali sie zerowa skutecznoscia", async () => {
  // Lemonziiko wygral StarLadder Budapest 2025 z 47 punktami, a jego
  // accuracy wynosi 0, bo ten turniej NIE MA w bazie ani jednego meczu.
  // "0% trafien" na karcie czytaloby sie jako ocena gracza.
  const { playerEventMeta } = await import(MODUL);

  const meta = playerEventMeta(
    { displayname: "Lemonziiko", rank: 1, total_points: 47, accuracy: 0, finished_predictions: 0 },
    { name: "StarLadder Budapest Major 2025", participants: 509 },
    "/events/starladder-budapest-major-2025/player/421726542104625163",
  );

  assert.equal(meta.description, "#1 z 509 · 47 pkt.");
  assert.ok(!meta.description.includes("%"));
});

test("gracz bez miejsca w rankingu dostaje karte bez zmyslonej pozycji", async () => {
  // Typowal, wiec karta ma sens - ale tabela jeszcze go nie klasyfikuje,
  // bo nic nie zostalo rozliczone. Miejsce ma wtedy zniknac, a nie
  // pokazac sie jako #0.
  const { playerEventMeta } = await import(MODUL);

  const meta = playerEventMeta(
    {
      displayname: "nowy",
      rank: null,
      total_points: 0,
      total_predictions: 12,
      accuracy: 0,
      finished_predictions: 0,
    },
    { name: "IEM Kraków 2026", participants: 262 },
    "/events/iem-krakow-2026/player/1",
  );

  assert.equal(meta.description, "0 pkt.");
  assert.ok(!meta.description.includes("#"));
});

test("brak nazwy gracza daje null, a nie karte o nikim", async () => {
  const { playerEventMeta } = await import(MODUL);

  assert.equal(playerEventMeta(null, { name: "X" }, "/a"), null);
  assert.equal(playerEventMeta({ rank: 1 }, { name: "X" }, "/a"), null);
});

test("gracz-widmo nie dostaje karty z wlasnym identyfikatorem", async () => {
  // Trasa profilu oddaje 200 takze dla adresu wymyslonego: komplet zer,
  // a jako displayname samo user_id. Bez straznika podglad zmyslonego
  // adresu pokazywal karte "000000000000000000 - IEM Krakow 2026 - 0 pkt".
  //
  // Wyszlo to dopiero na URUCHOMIENIU funkcji brzegowej na zywym API -
  // zaden test na samych danych by tego nie zlapal, bo dane wygladaly
  // poprawnie.
  const { playerEventMeta } = await import(MODUL);

  const widmo = {
    displayname: "000000000000000000",
    rank: null,
    total_points: 0,
    total_predictions: 0,
    accuracy: 0,
    finished_predictions: 0,
  };

  assert.equal(
    playerEventMeta(widmo, { name: "IEM Kraków 2026", participants: 262 }, "/a"),
    null,
    "brak sladu udzialu ma oddac karte turnieju, a nie karte o nikim",
  );

  // Ktos, kto typowal, ale nie ma jeszcze punktow ani miejsca, ZOSTAJE.
  const nowicjusz = { ...widmo, displayname: "ktos", total_predictions: 3 };

  assert.ok(playerEventMeta(nowicjusz, { name: "X" }, "/a"));
});

test("nieznany turniej nie wywraca karty gracza", async () => {
  // Funkcja brzegowa bierze turniej z listy, a profil osobnym zapytaniem -
  // jedno moze wrocic bez drugiego.
  const { playerEventMeta } = await import(MODUL);

  const meta = playerEventMeta(
    { displayname: "pieka", rank: 4, total_points: 100 },
    null,
    "/events/x/player/1",
  );

  assert.equal(meta.title, "pieka — Pick'Em");
  assert.equal(meta.description, "#4 · 100 pkt.");
});

// --- Karta dorobku ponad turniejami -----------------------------------------

test("karta dorobku niesie starty, punkty i najlepszy wynik", async () => {
  const { playerCareerMeta } = await import(MODUL);

  const meta = playerCareerMeta(
    {
      player: { displayname: "Lemonziiko" },
      summary: {
        starts: 2,
        total_points: 222,
        best: { rank: 1, participants: 509, name: "StarLadder Budapest Major 2025" },
      },
    },
    "/player/421726542104625163",
  );

  assert.equal(meta.title, "Lemonziiko — dorobek w Pick'Em");
  assert.match(meta.description, /^2 starty · 222 pkt łącznie · najlepiej #1 z 509/);

  // Adres MUSI byc adresem profilu. Dotad karta niosla adres strony
  // glownej, wiec podglad potrafil prowadzic gdzie indziej niz link.
  assert.equal(meta.url, "https://pickembot.pl/player/421726542104625163");
});

test("gracz z jednym startem nie dostaje liczby mnogiej", async () => {
  const { playerCareerMeta } = await import(MODUL);

  const meta = playerCareerMeta(
    { player: { displayname: "ktos" }, summary: { starts: 1, total_points: 47 } },
    "/player/1",
  );

  assert.match(meta.description, /^1 start · /);
});

test("gracz bez rozliczonego startu ma zdanie, a nie pusty opis", async () => {
  const { playerCareerMeta } = await import(MODUL);

  const meta = playerCareerMeta(
    { player: { displayname: "ktos" }, summary: {} },
    "/player/1",
  );

  assert.equal(meta.description, "Jeszcze bez rozliczonego startu.");
});

test("brak gracza daje null", async () => {
  const { playerCareerMeta } = await import(MODUL);

  assert.equal(playerCareerMeta(null, "/player/1"), null);
  assert.equal(playerCareerMeta({ summary: { starts: 3 } }, "/player/1"), null);
});

// --- Karta spolecznosci -----------------------------------------------------

test("karta serwera odmienia liczbe turniejow", async () => {
  const { serverMeta } = await import(MODUL);

  const opis = (n) =>
    serverMeta({ name: "Hyperland", events_count: n }, "/servers/hyperland").description;

  assert.match(opis(1), /^1 turniej\./);
  assert.match(opis(2), /^2 turnieje\./);
  assert.match(opis(7), /^7 turniejów\./);
});

test("otwarte typowanie jest na karcie, bo to powod, zeby kliknac", async () => {
  const { serverMeta } = await import(MODUL);

  const meta = serverMeta(
    { name: "Hyperland", events_count: 2, open_events: 1 },
    "/servers/hyperland",
  );

  assert.equal(meta.title, "Hyperland — Pick'Em");
  assert.match(meta.description, /typowanie otwarte/);
  assert.equal(meta.url, "https://pickembot.pl/servers/hyperland");
});

test("serwer bez turniejow nie pokazuje zera", async () => {
  const { serverMeta } = await import(MODUL);

  const meta = serverMeta({ name: "Test Server", events_count: 0 }, "/servers/testserwer");

  assert.ok(!meta.description.includes("0"));
});

test("nieznany serwer daje null", async () => {
  const { serverMeta } = await import(MODUL);

  assert.equal(serverMeta(undefined, "/servers/x"), null);
});

test("kazda nowa karta przechodzi przez to samo zabezpieczenie znakow", async () => {
  // Nazwy graczy pochodza z Discorda, wiec moga zawierac cudzyslow
  // i ostry nawias. rewriteHtml escapuje, ale tylko jesli karta w ogole
  // do niego trafi - ten test pilnuje calej drogi.
  const { playerCareerMeta, rewriteHtml } = await import(MODUL);

  const meta = playerCareerMeta(
    { player: { displayname: '"><script>x</script>' }, summary: { starts: 1 } },
    "/player/1",
  );

  const html = rewriteHtml(
    '<title>a</title><meta property="og:title" content="b" />',
    meta,
  );

  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&quot;&gt;&lt;script&gt;"));
});
