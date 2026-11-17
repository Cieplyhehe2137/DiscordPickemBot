// Limity Discorda na pola komponentow.
//
// Sprawdzone w @discordjs/builders: tytul modala i etykieta pola to 1..45
// znakow. Wazne, ze pilnuje tego BUILDER, a nie API - wyjatek "Invalid string
// length" leci wiec jeszcze przed wyslaniem czegokolwiek i gracz widzi samo
// "interaction failed", bez zadnej podpowiedzi.
//
// Nazwy druzyn i turniejow wpisuje czlowiek, wiec zadnego z tych pol nie
// wolno skladac przez samo wstawienie nazwy w szablon.

const LIMITY = {
  TYTUL_MODALA: 45,
  ETYKIETA_POLA: 45,
  ETYKIETA_PRZYCISKU: 80,
  ETYKIETA_OPCJI: 100,
  OPIS_OPCJI: 100,
  PLACEHOLDER_POLA: 100,
  PLACEHOLDER_LISTY: 150,
};

// Jeden znak, nie trzy kropki - przy ciasnym budzecie liczy sie kazdy.
const WIELOKROPEK = "…";

// Ciecie po indeksach moze rozdzielic pare surogatow (emoji w nazwie) i
// zostawic polowke znaku.
function bezRozcietejPary(tekst) {
  if (!tekst) return tekst;

  const ostatni = tekst.charCodeAt(tekst.length - 1);

  if (ostatni >= 0xd800 && ostatni <= 0xdbff) return tekst.slice(0, -1);

  return tekst;
}

function skroc(tekst, limit) {
  const s = String(tekst ?? "").trim();

  if (!Number.isInteger(limit) || limit <= 0) return "";

  if (s.length <= limit) return s;

  if (limit === 1) return WIELOKROPEK;

  const przyciete = bezRozcietejPary(s.slice(0, limit - 1)).trimEnd();

  return `${przyciete}${WIELOKROPEK}`;
}

// Dwie nazwy w jednym polu (np. "A vs B"). Kazda dostaje polowe budzetu, a
// kto swojej nie wykorzysta, oddaje reszte drugiej - inaczej krotka nazwa
// marnuje miejsce, ktorego brakuje dlugiej.
function skrocPare(a, b, budzet) {
  const sa = String(a ?? "").trim();
  const sb = String(b ?? "").trim();

  if (!Number.isInteger(budzet) || budzet <= 0) return ["", ""];

  if (sa.length + sb.length <= budzet) return [sa, sb];

  const polowa = Math.floor(budzet / 2);

  let limitA = polowa;
  let limitB = budzet - polowa;

  if (sa.length < limitA) limitB = budzet - sa.length;
  else if (sb.length < limitB) limitA = budzet - sb.length;

  return [skroc(sa, limitA), skroc(sb, limitB)];
}

module.exports = {
  LIMITY,
  WIELOKROPEK,
  skroc,
  skrocPare,
};
