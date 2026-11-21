// Limity Discorda na pola komponentow.
//
// Sprawdzone w @discordjs/builders: tytul modala i etykieta pola to 1..45
// znakow, opis embeda 1..4096, wartosc pola embeda do 1024. Wazne, ze pilnuje
// tego BUILDER, a nie API - wyjatek "Invalid string length" leci wiec jeszcze
// przed wyslaniem czegokolwiek i gracz widzi samo "interaction failed",
// bez zadnej podpowiedzi.
//
// Nazwy druzyn i turniejow wpisuje czlowiek, wiec zadnego z tych pol nie
// wolno skladac przez samo wstawienie nazwy w szablon.

const LIMITS = {
  MODAL_TITLE: 45,
  FIELD_LABEL: 45,
  BUTTON_LABEL: 80,
  OPTION_LABEL: 100,
  OPTION_DESCRIPTION: 100,
  FIELD_PLACEHOLDER: 100,
  SELECT_PLACEHOLDER: 150,

  // Embed. Opis ma takze DOLNA granice: pusty napis jest bledem, nie
  // pominietym polem, wiec setDescription("") wywala sie tak samo jak
  // za dlugi tekst.
  EMBED_TITLE: 256,
  EMBED_DESCRIPTION: 4096,
  EMBED_FIELD_NAME: 256,
  EMBED_FIELD_VALUE: 1024,
};

// Jeden znak, nie trzy kropki - przy ciasnym budzecie liczy sie kazdy.
const ELLIPSIS = "…";

// Ciecie po indeksach moze rozdzielic pare surogatow (emoji w nazwie) i
// zostawic polowke znaku.
function withoutSplitSurrogate(text) {
  if (!text) return text;

  const last = text.charCodeAt(text.length - 1);

  if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, -1);

  return text;
}

function truncate(text, limit) {
  const value = String(text ?? "").trim();

  if (!Number.isInteger(limit) || limit <= 0) return "";

  if (value.length <= limit) return value;

  if (limit === 1) return ELLIPSIS;

  const cut = withoutSplitSurrogate(value.slice(0, limit - 1)).trimEnd();

  return `${cut}${ELLIPSIS}`;
}

// Dwie nazwy w jednym polu (np. "A vs B"). Kazda dostaje polowe budzetu, a
// kto swojej nie wykorzysta, oddaje reszte drugiej - inaczej krotka nazwa
// marnuje miejsce, ktorego brakuje dlugiej.
function truncatePair(first, second, budget) {
  const a = String(first ?? "").trim();
  const b = String(second ?? "").trim();

  if (!Number.isInteger(budget) || budget <= 0) return ["", ""];

  if (a.length + b.length <= budget) return [a, b];

  const half = Math.floor(budget / 2);

  let limitA = half;
  let limitB = budget - half;

  if (a.length < limitA) limitB = budget - a.length;
  else if (b.length < limitB) limitA = budget - b.length;

  return [truncate(a, limitA), truncate(b, limitB)];
}

module.exports = {
  LIMITS,
  ELLIPSIS,
  truncate,
  truncatePair,
};
