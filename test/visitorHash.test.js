// Licznik odwiedzin: rozpoznawanie powracającego bez zapisywania IP.
//
// Trzy rzeczy muszą być prawdziwe naraz, bo inaczej licznik albo kłamie,
// albo staje się zbiorem danych osobowych:
//
//   1. ten sam odwiedzający tego samego dnia daje ten sam skrót (inaczej
//      każde odświeżenie liczy się jako nowa osoba),
//   2. ten sam odwiedzający w dwa różne dni daje RÓŻNE skróty (inaczej
//      z tabeli da się odtworzyć historię odwiedzin konkretnej osoby),
//   3. w skrócie nie ma nic, z czego da się odczytać adres IP.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/visitorHash.js";

const IP = "203.0.113.7";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0";
const SEKRET = "sekret-testowy";

test("ten sam gość tego samego dnia to jeden skrót", async () => {
  const { visitorHash } = await import(MODUL);

  const a = visitorHash({ ip: IP, userAgent: UA, day: "2026-09-12", secret: SEKRET });
  const b = visitorHash({ ip: IP, userAgent: UA, day: "2026-09-12", secret: SEKRET });

  assert.deepEqual(a, b, "odświeżenie strony policzyłoby się drugi raz");
});

test("ten sam gość w inny dzień to inny skrót", async () => {
  const { visitorHash } = await import(MODUL);

  const poniedzialek = visitorHash({
    ip: IP,
    userAgent: UA,
    day: "2026-09-12",
    secret: SEKRET,
  });

  const wtorek = visitorHash({
    ip: IP,
    userAgent: UA,
    day: "2026-09-13",
    secret: SEKRET,
  });

  assert.notDeepEqual(
    poniedzialek,
    wtorek,
    "skróty z dwóch dni dają się powiązać, czyli powstaje historia osoby",
  );
});

test("różne adresy dają różne skróty", async () => {
  const { visitorHash } = await import(MODUL);

  const pierwszy = visitorHash({
    ip: "203.0.113.7",
    userAgent: UA,
    day: "2026-09-12",
    secret: SEKRET,
  });

  const drugi = visitorHash({
    ip: "203.0.113.8",
    userAgent: UA,
    day: "2026-09-12",
    secret: SEKRET,
  });

  assert.notDeepEqual(pierwszy, drugi, "dwie osoby policzyłyby się jako jedna");
});

test("przesunięcie granicy pól daje inny skrót", async () => {
  const { visitorHash } = await import(MODUL);

  // Gdyby pola sklejać spacją, te dwa zestawy dałyby identyczny ciąg
  // wejściowy - a to są dwie różne osoby. Dlatego rozdziela je znak, który
  // nie może wystąpić ani w adresie, ani w User-Agencie.
  const pierwszy = visitorHash({
    ip: "1.2.3",
    userAgent: "4 Chrome",
    day: "2026-09-12",
    secret: SEKRET,
  });

  const drugi = visitorHash({
    ip: "1.2.3 4",
    userAgent: "Chrome",
    day: "2026-09-12",
    secret: SEKRET,
  });

  assert.notDeepEqual(pierwszy, drugi);
});

test("skrót nie niesie adresu ani przeglądarki", async () => {
  const { visitorHash } = await import(MODUL);

  const skrot = visitorHash({
    ip: IP,
    userAgent: UA,
    day: "2026-09-12",
    secret: SEKRET,
  });

  assert.equal(skrot.length, 16, "16 bajtów, tyle wchodzi do BINARY(16)");

  const tekst = skrot.toString("latin1");

  assert.ok(!tekst.includes(IP), "adres IP w skrócie");
  assert.ok(!tekst.includes("Mozilla"), "User-Agent w skrócie");
});

test("bez sekretu skrótów nie da się odtworzyć", async () => {
  const { visitorHash } = await import(MODUL);

  const zSekretem = visitorHash({
    ip: IP,
    userAgent: UA,
    day: "2026-09-12",
    secret: SEKRET,
  });

  const zInnym = visitorHash({
    ip: IP,
    userAgent: UA,
    day: "2026-09-12",
    secret: "inny-sekret",
  });

  // To jest powód, dla którego sól siedzi w zmiennej środowiskowej, a nie
  // w bazie: sam dostęp do MySQL-a nie wystarcza, żeby przemielić adresy.
  assert.notDeepEqual(zSekretem, zInnym);
});

test("automaty nie są liczone", async () => {
  const { isBot } = await import(MODUL);

  for (const ua of [
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "Mozilla/5.0 HeadlessChrome/120.0",
    "UptimeRobot/2.0",
    "facebookexternalhit/1.1",
  ]) {
    assert.equal(isBot(ua), true, `przepuszczony automat: ${ua}`);
  }
});

test("brak User-Agenta traktujemy jak automat", async () => {
  const { isBot } = await import(MODUL);

  // Przeglądarki zawsze go wysyłają; jego brak to prawie zawsze skrypt.
  assert.equal(isBot(""), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot(undefined), true);
});

test("prawdziwe przeglądarki są liczone", async () => {
  const { isBot } = await import(MODUL);

  for (const ua of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
  ]) {
    assert.equal(isBot(ua), false, `odrzucona przeglądarka: ${ua}`);
  }
});

test("dzień liczony jest lokalnie i zawsze tak samo", async () => {
  const { dayKey } = await import(MODUL);

  assert.equal(dayKey(new Date(2026, 8, 12, 13, 30)), "2026-09-12");

  // Jednocyfrowy miesiąc i dzień muszą mieć zero wiodące, inaczej MySQL
  // dostaje "2026-1-5" i data nie wchodzi do kolumny DATE.
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 1)), "2026-01-05");

  // Ostatnia minuta doby to nadal ten sam dzień - granica jest o północy
  // czasu serwera, nie gdzie indziej.
  assert.equal(dayKey(new Date(2026, 8, 12, 23, 59)), "2026-09-12");
});

test("sól z konfiguracji wygrywa z losową", async () => {
  const { resolveSecret } = await import(MODUL);

  assert.equal(resolveSecret({ VISIT_SALT: "z-konfiguracji" }), "z-konfiguracji");

  // Bez zmiennej losujemy - dwa procesy dostaną różne sole, co jest
  // udokumentowanym kosztem nieustawienia jej.
  const pierwsza = resolveSecret({});
  const druga = resolveSecret({});

  assert.notEqual(pierwsza, druga);
  assert.ok(pierwsza.length >= 32, "sól musi być długa, nie symboliczna");
});
