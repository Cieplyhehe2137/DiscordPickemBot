// Komunikaty guardow przepisane z Discorda na WWW.
//
// Guardy w utils/protectionsGuards.js pisza pod Discorda i to sie nie zmienia -
// tam markdown i emoji renderuja sie poprawnie. Czyscimy je dopiero na granicy
// HTTP, bo React renderuje tekst doslownie.


// ======================================================
// KOMUNIKATY GUARDA -> WWW
// ======================================================
//
// Guardy w utils/protectionsGuards.js piszą komunikaty pod Discorda: emoji na
// początku i **pogrubienie** markdownem. API oddawało je bez zmian, a React
// renderuje tekst dosłownie, więc gracz widział na ekranie:
//
//   ❌ ❌ Aktualna faza to **SWISS_STAGE1** — typowanie Play-In jest niedostępne.
//
// (drugie ❌ dokleja frontend). Do tego SWISS_STAGE1 to surowa wartość kolumny.
//
// Nie zmieniamy tekstów w guardzie, bo Discord renderuje je poprawnie -
// czyścimy je dopiero na granicy HTTP.

export const WEB_PHASE_NAMES = {
  SWISS: "Swiss",
  SWISS_STAGE1: "Swiss Stage 1",
  SWISS_STAGE2: "Swiss Stage 2",
  SWISS_STAGE3: "Swiss Stage 3",
  PLAYOFFS: "Playoffs",
  PLAYIN: "Play-In",
  DOUBLEELIM: "Double Elimination",
  MATCHES: "mecze",
  NOT_STARTED: "nierozpoczęty",
  UNKNOWN: "nieznana",
};

export function toWebMessage(text, fallback = null) {
  if (!text) return fallback;

  return (
    String(text)
      // identyfikatory faz -> nazwy czytelne dla gracza
      .replace(/\*\*([A-Z0-9_]+)\*\*/g, (_match, phase) =>
        WEB_PHASE_NAMES[phase] ? WEB_PHASE_NAMES[phase] : phase,
      )
      // reszta pogrubień markdownem
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // emoji statusu na początku (Discord je potrzebuje, WWW ma własne style)
      .replace(/^[\s\p{Extended_Pictographic}️]+/u, "")
      .trim() || fallback
  );
}
