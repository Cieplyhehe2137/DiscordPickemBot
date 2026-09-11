// Przepisywanie komunikatow guardow z Discorda na WWW.
//
// Powod istnienia tego kodu jest konkretny: guardy pisza pod Discorda, wiec
// zaczynaja od emoji i pogrubiaja markdownem. React renderuje tekst doslownie,
// przez co gracz widzial na ekranie miedzy innymi podwojne emoji i surowa
// wartosc kolumny zamiast nazwy fazy:
//
//   ❌ ❌ Aktualna faza to **SWISS_STAGE1** - typowanie Play-In niedostepne.
//
// Testy pilnuja obu zamian naraz, bo to one razem daja zdanie do przeczytania.

const test = require("node:test");
const assert = require("node:assert/strict");

const MESSAGES = "../server/lib/messages.js";

test("identyfikator fazy zamienia sie na nazwe czytelna dla gracza", async () => {
  const { toWebMessage } = await import(MESSAGES);

  assert.equal(
    toWebMessage("Aktualna faza to **SWISS_STAGE1**."),
    "Aktualna faza to Swiss Stage 1.",
  );

  assert.equal(toWebMessage("**PLAYIN**"), "Play-In");
  assert.equal(toWebMessage("**DOUBLEELIM**"), "Double Elimination");
});

test("nieznana faza zostaje jak byla, zamiast zniknac", async () => {
  const { toWebMessage } = await import(MESSAGES);

  // Lepiej pokazac surowa wartosc niz puste miejsce - przynajmniej wiadomo,
  // czego szukac w bazie.
  assert.equal(toWebMessage("Faza **NOWA_FAZA_2027**"), "Faza NOWA_FAZA_2027");
});

test("zwykle pogrubienie traci gwiazdki, ale zachowuje tresc", async () => {
  const { toWebMessage } = await import(MESSAGES);

  assert.equal(toWebMessage("To jest **wazne** zdanie"), "To jest wazne zdanie");
});

test("emoji statusu znika tylko z poczatku", async () => {
  const { toWebMessage } = await import(MESSAGES);

  assert.equal(toWebMessage("❌ Typowanie zamkniete"), "Typowanie zamkniete");
  assert.equal(toWebMessage("⚠️ Uwaga"), "Uwaga");

  // W srodku zdania emoji jest trescia, nie ozdoba statusu.
  assert.equal(toWebMessage("Wynik 2:0 ✅ zapisany"), "Wynik 2:0 ✅ zapisany");
});

test("pelny komunikat guarda staje sie zdaniem do przeczytania", async () => {
  const { toWebMessage } = await import(MESSAGES);

  assert.equal(
    toWebMessage(
      "❌ Aktualna faza to **SWISS_STAGE1** — typowanie **Play-In** jest niedostępne.",
    ),
    "Aktualna faza to Swiss Stage 1 — typowanie Play-In jest niedostępne.",
  );
});

test("pusty komunikat schodzi do wartosci zastepczej", async () => {
  const { toWebMessage } = await import(MESSAGES);

  assert.equal(toWebMessage(null, "Brak dostępu"), "Brak dostępu");
  assert.equal(toWebMessage("", "Brak dostępu"), "Brak dostępu");
  assert.equal(toWebMessage(undefined), null, "bez podanej zastepczej - null");

  // Sam emoji bez tresci tez jest pusty po oczyszczeniu.
  assert.equal(toWebMessage("❌", "Brak dostępu"), "Brak dostępu");
});
