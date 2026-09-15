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
