// Mapa strony i robots.txt (web/src/lib/sitemap.js, web/public/robots.txt).
//
// Oba pliki maja te wlasciwosc, ze zepsute NIE DAJA bledu, ktory ktokolwiek
// zobaczy. Zly XML wyszukiwarka odrzuca w calosci i milczy; "Disallow: /"
// w robots.txt wyprowadza caly serwis z wynikow wyszukiwania i tez milczy.
// Stad te testy.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const MODUL = "../web/src/lib/sitemap.js";

const ROBOTS = path.join(__dirname, "..", "web", "public", "robots.txt");

const ORIGIN = "https://pickembot.pl";

const EVENTY = [
  { slug: "iem-krakow-2026" },
  { slug: "starladder-budapest-major-2025" },
];

const DRUZYNY = [
  { name: "FaZe" },
  { name: "Ninjas in Pyjamas" },
  { name: "BC.Game" },
  { name: "THUNDER dOWNUNDER" },
];

// Prosty sprawdzian poprawnosci: kazdy "&" musi byc poczatkiem encji.
// Surowy ampersand to najczestszy sposob na zepsucie XML-a i jedyny, ktory
// realnie grozi przy nazwach druzyn.
function bezSurowychAmpersandow(xml) {
  return !/&(?!(amp|lt|gt|quot|apos);)/.test(xml);
}

// --- ucieczka znakow -------------------------------------------------------

test("escapeXml zamienia wszystkie znaki o znaczeniu skladniowym", async () => {
  const { escapeXml } = await import(MODUL);

  assert.equal(escapeXml("a & b"), "a &amp; b");
  assert.equal(escapeXml("<tag>"), "&lt;tag&gt;");
  assert.equal(escapeXml(`"cudzyslow"`), "&quot;cudzyslow&quot;");
  assert.equal(escapeXml("apostrof'"), "apostrof&apos;");
});

test("escapeXml znosi brak wartosci", async () => {
  const { escapeXml } = await import(MODUL);

  assert.equal(escapeXml(null), "");
  assert.equal(escapeXml(undefined), "");
});

// --- lista adresow ---------------------------------------------------------

test("sa strony stale, a kazdy turniej daje trzy adresy", async () => {
  const { pageUrls } = await import(MODUL);

  const adresy = pageUrls({ origin: ORIGIN, events: EVENTY, teams: [] });
  const loc = adresy.map((a) => a.loc);

  for (const s of ["/", "/events", "/teams", "/scoring"]) {
    assert.ok(loc.includes(`${ORIGIN}${s}`), `brak strony stalej ${s}`);
  }

  for (const e of EVENTY) {
    for (const przyrostek of ["", "/leaderboard", "/matches"]) {
      assert.ok(
        loc.includes(`${ORIGIN}/events/${e.slug}${przyrostek}`),
        `brak adresu turnieju ${e.slug}${przyrostek}`,
      );
    }
  }
});

test("nazwa druzyny trafia do adresu zakodowana", async () => {
  // Adres zawiera NAZWE, nie klucz - tak samo jak link na stronie drużyn.
  // Nazwy maja spacje i kropki, wiec bez kodowania powstaje adres, ktory
  // nie prowadzi tam, gdzie powinien.
  const { pageUrls } = await import(MODUL);

  const loc = pageUrls({ origin: ORIGIN, events: [], teams: DRUZYNY }).map(
    (a) => a.loc,
  );

  assert.ok(loc.includes(`${ORIGIN}/teams/FaZe`));
  assert.ok(loc.includes(`${ORIGIN}/teams/Ninjas%20in%20Pyjamas`));
  assert.ok(loc.includes(`${ORIGIN}/teams/BC.Game`));
  assert.ok(loc.includes(`${ORIGIN}/teams/THUNDER%20dOWNUNDER`));
});

test("wpisy bez sluga i bez nazwy sa pomijane", async () => {
  const { pageUrls } = await import(MODUL);

  const adresy = pageUrls({
    origin: ORIGIN,
    events: [{ slug: null }, {}, { slug: "ok" }],
    teams: [{ name: "" }, {}, { name: "FaZe" }],
  });

  const turnieje = adresy.filter((a) => a.loc.includes("/events/"));
  const druzyny = adresy.filter((a) => a.loc.includes("/teams/"));

  assert.equal(turnieje.length, 3, "tylko turniej ze slugiem, trzy jego adresy");
  assert.equal(druzyny.length, 1, "tylko druzyna z nazwa");
});

test("ukosnik na koncu origin nie podwaja sie w adresach", async () => {
  const { pageUrls } = await import(MODUL);

  const loc = pageUrls({ origin: `${ORIGIN}/`, events: [], teams: [] }).map(
    (a) => a.loc,
  );

  assert.ok(!loc.some((a) => a.includes("//events")), `podwojony ukosnik: ${loc}`);
});

test("w mapie nie ma profili graczy ani stron za logowaniem", async () => {
  // Profili jest ponad tysiac i zaden nie odpowiada na pytanie, ktore ktos
  // wpisuje w wyszukiwarke. Strony za logowaniem pokazuja robotowi wylacznie
  // prosbe o zalogowanie.
  const { pageUrls } = await import(MODUL);

  const loc = pageUrls({ origin: ORIGIN, events: EVENTY, teams: DRUZYNY })
    .map((a) => a.loc)
    .join("\n");

  for (const zakazane of ["/player/", "/h2h/", "/my-picks", "/my-stats", "/admin"]) {
    assert.ok(!loc.includes(zakazane), `mapa zawiera ${zakazane}`);
  }
});

// --- gotowy dokument -------------------------------------------------------

test("dokument jest poprawnym XML-em", async () => {
  const { sitemapXml } = await import(MODUL);

  const xml = sitemapXml({
    origin: ORIGIN,
    events: EVENTY,
    teams: DRUZYNY,
    lastmod: "2026-09-16",
  });

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
  assert.ok(xml.trimEnd().endsWith("</urlset>"));

  const otwarte = (xml.match(/<url>/g) || []).length;
  const zamkniete = (xml.match(/<\/url>/g) || []).length;

  assert.equal(otwarte, zamkniete, "niedomkniete znaczniki <url>");
  assert.equal(otwarte, 4 + EVENTY.length * 3 + DRUZYNY.length);

  assert.ok(bezSurowychAmpersandow(xml), "surowy & w dokumencie");
});

test("nazwa z ampersandem nie psuje dokumentu", async () => {
  // Dzis zadna druzyna takiej nazwy nie ma i encodeURIComponent zamienilby
  // "&" na "%26". To jest jednak dokladnie ten rodzaj zalozenia, ktory
  // przestaje byc prawdziwy po dodaniu jednej druzyny.
  const { sitemapXml } = await import(MODUL);

  const xml = sitemapXml({
    origin: ORIGIN,
    events: [],
    teams: [{ name: "Tom & Jerry" }, { name: "<script>" }],
  });

  assert.ok(bezSurowychAmpersandow(xml), "surowy & w dokumencie");
  assert.ok(!/<loc>[^<]*<script>/.test(xml), "niezaekranowany znacznik w loc");
});

test("bez lastmod dokument nie ma pustego znacznika", async () => {
  const { sitemapXml } = await import(MODUL);

  const xml = sitemapXml({ origin: ORIGIN, events: [], teams: [] });

  assert.ok(!xml.includes("<lastmod>"), "pusty lastmod zamiast braku");
});

// --- robots.txt ------------------------------------------------------------

test("robots.txt nie wyprowadza serwisu z wyszukiwarek", async () => {
  // "Disallow: /" to jedna linijka, ktora usuwa caly serwis z wynikow i nie
  // daje przy tym zadnego bledu. Tego pilnuje ten test i tylko tego.
  const tresc = fs.readFileSync(ROBOTS, "utf8");

  const linie = tresc
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  assert.ok(
    !linie.some((l) => /^Disallow:\s*\/\s*$/i.test(l)),
    "robots.txt blokuje cala witryne",
  );

  assert.ok(
    linie.some((l) => /^Allow:\s*\/\s*$/i.test(l)),
    "brak jawnego Allow: /",
  );
});

test("robots.txt wskazuje sitemape i odcina strony za logowaniem", async () => {
  const tresc = fs.readFileSync(ROBOTS, "utf8");

  assert.ok(
    /^Sitemap:\s*https:\/\/pickembot\.pl\/sitemap\.xml\s*$/m.test(tresc),
    "brak wpisu Sitemap albo zly adres",
  );

  for (const sciezka of ["/admin", "my-picks", "my-stats", "h2h"]) {
    assert.ok(
      new RegExp(`^Disallow:.*${sciezka.replace("/", "\\/")}`, "m").test(tresc),
      `robots.txt nie odcina ${sciezka}`,
    );
  }
});

// --- funkcja brzegowa ------------------------------------------------------
//
// Srodowiska Workers nie ma lokalnie, ale onRequest to zwykly modul ESM.
// To NIE jest test routingu Pages (czy plik "sitemap.xml.js" faktycznie
// oddaje /sitemap.xml) - tego sprawdzic sie stad nie da i trzeba zobaczyc
// na zywym adresie po wdrozeniu.

const { pathToFileURL } = require("node:url");

const FUNKCJA = pathToFileURL(
  path.join(__dirname, "..", "web", "functions", "sitemap.xml.js"),
).href;

async function wywolajFunkcje({ odpowiedzApi }) {
  const { onRequest } = await import(FUNKCJA);

  const oryginalny = globalThis.fetch;

  globalThis.fetch = async (url) => odpowiedzApi(String(url));

  try {
    return await onRequest({
      request: new Request("https://pickembot.pl/sitemap.xml"),
      env: {},
    });
  } finally {
    globalThis.fetch = oryginalny;
  }
}

function odpowiedzJson(dane) {
  return new Response(JSON.stringify(dane), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("funkcja oddaje XML z wlasciwym typem tresci", async () => {
  const res = await wywolajFunkcje({
    odpowiedzApi: (url) =>
      odpowiedzJson(
        url.includes("/teams") ? { teams: DRUZYNY } : { events: EVENTY },
      ),
  });

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/xml/);

  const xml = await res.text();

  assert.ok(xml.includes("<urlset"));
  assert.ok(xml.includes("https://pickembot.pl/events/iem-krakow-2026"));
  assert.ok(xml.includes("https://pickembot.pl/teams/Ninjas%20in%20Pyjamas"));
  assert.ok(bezSurowychAmpersandow(xml));
});

test("padniete API nie psuje sitemapy - zostaja strony stale", async () => {
  // Sitemapa z samymi stronami stalymi jest nadal poprawna i uzyteczna.
  // Sitemapa, ktora oddala blad albo pusta odpowiedz, nie jest.
  const res = await wywolajFunkcje({
    odpowiedzApi: () => {
      throw new Error("brak sieci");
    },
  });

  assert.equal(res.status, 200);

  const xml = await res.text();

  assert.ok(xml.includes("<urlset"), "brak poprawnego dokumentu");
  assert.ok(xml.includes("https://pickembot.pl/scoring"));
  assert.ok(!xml.includes("/events/"), "bez API nie ma skad wziac turniejow");
});

test("blad HTTP z API traktowany jest jak brak danych", async () => {
  const res = await wywolajFunkcje({
    odpowiedzApi: () => new Response("nie", { status: 500 }),
  });

  const xml = await res.text();

  assert.equal(res.status, 200);
  assert.ok(xml.includes("https://pickembot.pl/teams"));
  assert.ok(!xml.includes("/teams/"), "bez API nie ma skad wziac druzyn");
});
