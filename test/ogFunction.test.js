// Funkcje brzegowe Cloudflare Pages (web/functions/**).
//
// Srodowiska Workers nie ma lokalnie, ale sama procedura onRequest to zwykly
// modul ESM - da sie ja wywolac w Node z atrapa ASSETS i atrapa API. To NIE
// jest test srodowiska Cloudflare (routing plikow [[path]], binding ASSETS,
// wdrozenie) - tego sprawdzic sie stad nie da i trzeba to zobaczyc na zywym
// adresie po wdrozeniu.
//
// Sprawdzane jest to, co da sie sprawdzic i co decyduje o bezpieczenstwie:
// ze czlowiek NIGDY nie przechodzi przez przepisywanie ani nie wywoluje API,
// i ze KAZDA awaria konczy sie plikiem statycznym, a nie bledem.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const INDEX = path.join(__dirname, "..", "web", "index.html");

const FUNKCJA_EVENT = pathToFileURL(
  path.join(__dirname, "..", "web", "functions", "events", "[[path]].js"),
).href;

const FUNKCJA_TEAM = pathToFileURL(
  path.join(__dirname, "..", "web", "functions", "teams", "[[path]].js"),
).href;

const UA_BOT = "Mozilla/5.0 (compatible; Discordbot/2.0)";
const UA_CZLOWIEK =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";

const EVENT = {
  slug: "iem-krakow-2026",
  name: "IEM Kraków 2026",
  participants: 262,
  matches_count: 50,
  is_archived: true,
};

const TEAM = { name: "FURIA", settled: 13, wins: 10, losses: 3, trust: 72 };

// Atrapa ASSETS: liczy wywolania i oddaje prawdziwy index.html.
function fakeEnv() {
  const wywolania = [];

  return {
    wywolania,
    API_URL: "https://atrapa.test",
    ASSETS: {
      fetch(req) {
        wywolania.push(typeof req === "string" ? req : (req.url ?? String(req)));

        return Promise.resolve(
          new Response(fs.readFileSync(INDEX, "utf8"), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        );
      },
    },
  };
}

function fakeRequest(url, userAgent) {
  return new Request(url, { headers: { "user-agent": userAgent } });
}

// Podmiana globalnego fetch na czas jednego wywolania.
async function zFetchem(odpowiedz, fn) {
  const oryginal = globalThis.fetch;

  const zapytania = [];

  globalThis.fetch = async (url, opcje) => {
    zapytania.push(String(url));

    return odpowiedz(String(url), opcje);
  };

  try {
    return await fn(zapytania);
  } finally {
    globalThis.fetch = oryginal;
  }
}

function json(dane, status = 200) {
  return new Response(JSON.stringify(dane), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// --- czlowiek --------------------------------------------------------------

test("zwykly uzytkownik dostaje plik statyczny i NIE pyta API", async () => {
  // To jest cala ochrona: blad w przepisywaniu nie moze dotknac kogos, kto
  // po prostu czyta strone. Przy okazji zadne wejscie na strone turnieju
  // nie generuje ruchu do API.
  const { onRequest } = await import(FUNKCJA_EVENT);

  const env = fakeEnv();

  await zFetchem(
    () => {
      throw new Error("API nie powinno byc wolane dla czlowieka");
    },
    async (zapytania) => {
      const res = await onRequest({
        request: fakeRequest(
          "https://pickembot.pl/events/iem-krakow-2026",
          UA_CZLOWIEK,
        ),
        env,
        params: { path: ["iem-krakow-2026"] },
      });

      const html = await res.text();

      assert.equal(zapytania.length, 0, "API zostalo wywolane dla czlowieka");
      assert.ok(html.includes("<title>Pick'Em — typuj mecze esportowe</title>"));
      assert.equal(env.wywolania.length, 1, "dokladnie jedno siegniecie po plik");
    },
  );
});

// --- bot -------------------------------------------------------------------

test("bot dostaje kartę z nazwą turnieju", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => json({ events: [EVENT] }),
    async () => {
      const res = await onRequest({
        request: fakeRequest(
          "https://pickembot.pl/events/iem-krakow-2026",
          UA_BOT,
        ),
        env: fakeEnv(),
        params: { path: ["iem-krakow-2026"] },
      });

      const html = await res.text();

      assert.equal(res.status, 200);
      assert.ok(html.includes("<title>IEM Kraków 2026 — Pick'Em</title>"));
      assert.ok(html.includes("262 typujących"));
      assert.ok(html.includes("50 meczów"));
      assert.ok(
        html.includes("https://pickembot.pl/events/iem-krakow-2026"),
        "og:url ma wskazywac te podstrone",
      );

      assert.ok(
        !html.includes("Platforma Pick'Em dla społeczności esportowej"),
        "domyslny opis przetrwal",
      );
    },
  );
});

test("podstrona turnieju dostaje kartę tego samego turnieju", async () => {
  // /events/:slug/leaderboard tez bywa wklejane na Discorda.
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => json({ events: [EVENT] }),
    async () => {
      const res = await onRequest({
        request: fakeRequest(
          "https://pickembot.pl/events/iem-krakow-2026/leaderboard",
          UA_BOT,
        ),
        env: fakeEnv(),
        params: { path: ["iem-krakow-2026", "leaderboard"] },
      });

      const html = await res.text();

      assert.ok(html.includes("IEM Kraków 2026"));
      assert.ok(
        html.includes("/events/iem-krakow-2026/leaderboard"),
        "og:url ma wskazywac dokladnie ten adres",
      );
    },
  );
});

test("drużyna dostaje kartę z bilansem", async () => {
  const { onRequest } = await import(FUNKCJA_TEAM);

  await zFetchem(
    () => json({ team: TEAM, matches: [] }),
    async (zapytania) => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/teams/FURIA", UA_BOT),
        env: fakeEnv(),
        params: { path: ["FURIA"] },
      });

      const html = await res.text();

      assert.ok(html.includes("<title>FURIA — Pick'Em</title>"));
      assert.ok(html.includes("10–3"));
      assert.ok(zapytania[0].includes("/api/public/teams/FURIA"));
    },
  );
});

// --- awarie ----------------------------------------------------------------

test("padniete API konczy sie plikiem statycznym, nie bledem", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => {
      throw new Error("polaczenie odrzucone");
    },
    async () => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/events/x", UA_BOT),
        env: fakeEnv(),
        params: { path: ["x"] },
      });

      assert.equal(res.status, 200);

      const html = await res.text();

      assert.ok(html.includes("<title>Pick'Em — typuj mecze esportowe</title>"));
    },
  );
});

test("API oddajace piecsetke konczy sie plikiem statycznym", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => new Response("bum", { status: 500 }),
    async () => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/events/x", UA_BOT),
        env: fakeEnv(),
        params: { path: ["x"] },
      });

      assert.equal(res.status, 200);
      assert.ok((await res.text()).includes("Pick'Em — typuj mecze"));
    },
  );
});

test("smieci zamiast JSON-a koncza sie plikiem statycznym", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => new Response("<html>nie json</html>", { status: 200 }),
    async () => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/events/x", UA_BOT),
        env: fakeEnv(),
        params: { path: ["x"] },
      });

      assert.equal(res.status, 200);
      assert.ok((await res.text()).includes("Pick'Em — typuj mecze"));
    },
  );
});

test("nieznany turniej dostaje kartę domyślną, a nie pustą", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => json({ events: [EVENT] }),
    async () => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/events/nie-ma-takiego", UA_BOT),
        env: fakeEnv(),
        params: { path: ["nie-ma-takiego"] },
      });

      const html = await res.text();

      assert.ok(html.includes("<title>Pick'Em — typuj mecze esportowe</title>"));
      assert.ok(!html.includes("undefined"));
    },
  );
});

test("brak sluga konczy sie plikiem statycznym", async () => {
  const { onRequest } = await import(FUNKCJA_EVENT);

  await zFetchem(
    () => {
      throw new Error("nie powinno dojsc do API");
    },
    async (zapytania) => {
      const res = await onRequest({
        request: fakeRequest("https://pickembot.pl/events/", UA_BOT),
        env: fakeEnv(),
        params: { path: [] },
      });

      assert.equal(res.status, 200);
      assert.equal(zapytania.length, 0);
    },
  );
});
