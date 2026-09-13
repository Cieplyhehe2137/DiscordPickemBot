// Kolejka powiadomien (web/src/lib/toastQueue.js).
//
// Powiadomienie zastepuje komunikat "Typy zapisane", ktory renderowal sie
// w stalym miejscu strony - na dlugim meczu poza ekranem, wiec gracz nie
// widzial, ze zapis sie udal.
//
// Testy pilnuja tego, co przy powiadomieniach psuje sie najczesciej: wiezy
// identycznych kafelkow przy wielokrotnym kliknieciu i stosu, ktory rosnie
// bez konca. Reszta komponentu to uklad CSS i nie ma czego sprawdzac.
//
// Modul nie importuje niczego, wiec dziala bez instalowania zaleznosci.

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const QUEUE = "../web/src/lib/toastQueue.js";

function toast(text, tone = "ok", id = null) {
  return { id: id ?? `id-${text}-${tone}`, text, tone };
}

test("pokazane powiadomienie trafia na koniec stosu", async () => {
  const { toastReducer } = await import(QUEUE);

  const stan = toastReducer([], { type: "show", toast: toast("pierwsze") });
  const dalej = toastReducer(stan, { type: "show", toast: toast("drugie") });

  assert.deepEqual(
    dalej.map((t) => t.text),
    ["pierwsze", "drugie"],
  );
});

test("ta sama tresc odswieza kafelek, zamiast dokladac drugi", async () => {
  // To jest ten przypadek z zycia: gracz klika "Zapisz" trzy razy, bo nie
  // jest pewien, czy cos sie stalo. Trzy identyczne kafelki wygladaja jak
  // usterka, a nie jak potwierdzenie.
  const { toastReducer } = await import(QUEUE);

  const pierwszy = toast("Typy zapisane", "ok", "stary");
  const drugi = toast("Typy zapisane", "ok", "nowy");

  const stan = toastReducer([], { type: "show", toast: pierwszy });
  const po = toastReducer(stan, { type: "show", toast: drugi });

  assert.equal(po.length, 1, "jedna tresc to jeden kafelek");
  assert.equal(
    po[0].id,
    "nowy",
    "nowy identyfikator restartuje odliczanie czasu",
  );
});

test("ta sama tresc w innym tonie to osobne powiadomienie", async () => {
  // "Nie udalo sie zapisac" jako blad i jako potwierdzenie to dwie rozne
  // wiadomosci, nawet gdyby mialy identyczna tresc.
  const { toastReducer } = await import(QUEUE);

  const stan = toastReducer([], { type: "show", toast: toast("Zapis", "ok") });
  const po = toastReducer(stan, {
    type: "show",
    toast: toast("Zapis", "danger"),
  });

  assert.equal(po.length, 2);
});

test("przy przepelnieniu wypada najstarsze, nie najnowsze", async () => {
  const { toastReducer, TOAST_LIMIT } = await import(QUEUE);

  let stan = [];

  for (let i = 1; i <= TOAST_LIMIT + 2; i += 1) {
    stan = toastReducer(stan, { type: "show", toast: toast(`nr ${i}`) });
  }

  assert.equal(stan.length, TOAST_LIMIT);
  assert.equal(
    stan.at(-1).text,
    `nr ${TOAST_LIMIT + 2}`,
    "swiezy komunikat dotyczy tego, co gracz wlasnie zrobil",
  );
  assert.equal(stan[0].text, "nr 3", "najstarsze odpadly");
});

test("schowanie dotyczy tylko wskazanego powiadomienia", async () => {
  const { toastReducer } = await import(QUEUE);

  const stan = [toast("a", "ok", "id-a"), toast("b", "ok", "id-b")];
  const po = toastReducer(stan, { type: "dismiss", id: "id-a" });

  assert.deepEqual(
    po.map((t) => t.id),
    ["id-b"],
  );
});

test("schowanie nieistniejacego identyfikatora nic nie psuje", async () => {
  // Zdarza sie normalnie: kafelek odswiezony nowym id zostawia po sobie
  // stary licznik czasu, ktory zglasza sie po swoje kilka sekund pozniej.
  const { toastReducer } = await import(QUEUE);

  const stan = [toast("a", "ok", "id-a")];
  const po = toastReducer(stan, { type: "dismiss", id: "id-nieistniejace" });

  assert.deepEqual(po.map((t) => t.id), ["id-a"]);
});

test("kazde wywolanie daje inny identyfikator", async () => {
  // Dwa powiadomienia w tej samej milisekundzie musza miec rozne klucze,
  // inaczej React przestaje je rozrozniac przy renderze listy.
  const { createToastId } = await import(QUEUE);

  const identyfikatory = new Set([
    createToastId(),
    createToastId(),
    createToastId(),
  ]);

  assert.equal(identyfikatory.size, 3);
});

test("czas zycia miesci sie w rozsadnych granicach", async () => {
  const { TOAST_DURATION_MS } = await import(QUEUE);

  assert.ok(TOAST_DURATION_MS >= 2000, "ponizej dwoch sekund nie da sie tego przeczytac");
  assert.ok(TOAST_DURATION_MS <= 10000, "powyzej dziesieciu sekund to juz nie jest powiadomienie");
});

test("klasa tonu jest wypisana doslownie, nie sklejana", async () => {
  // Ta sama pulapka co przy plakietkach stanu eventu: nazwa zbudowana przez
  // `ui-toast--${tone}` nie wystepuje w zrodle jako tekst, wiec przeglad
  // martwego CSS-a kasuje regule i powiadomienie cicho traci kolor.
  const { TOAST_TONE_CLASS } = await import(QUEUE);

  assert.equal(TOAST_TONE_CLASS.ok, "ui-toast--ok");
  assert.equal(TOAST_TONE_CLASS.warn, "ui-toast--warn");

  const src = readFileSync(
    path.join(__dirname, "..", "web", "src", "styles", "components.css"),
    "utf8",
  );

  for (const klasa of Object.values(TOAST_TONE_CLASS)) {
    assert.ok(
      src.includes(`.${klasa}`),
      `CSS musi miec regule dla ${klasa}`,
    );
  }
});
