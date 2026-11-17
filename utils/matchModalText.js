// Napisy modali dokladnego wyniku - zlozone tak, zeby nie dalo sie przekroczyc
// limitu Discorda, bez wzgledu na to, jak dluga jest nazwa druzyny.
//
// Trzy miejsca budowaly te same napisy przez wstawienie nazw w szablon
// (handlers/matches/matchUserExactOpen, matchAdminExactOpen,
// matchAdminExactSubmit) i przy parze dluzszej niz 25 znakow modal nie
// otwieral sie wcale.

const { getMapLabel } = require("./mapLabels");
const { LIMITY, skroc, skrocPare } = require("./discordLimits");

const PRZED_BO1 = "Dokładny wynik: ";
const MIEDZY = " vs ";
const PRZED_MAPY = "Dokładny wynik — ";
const PRZED_OFICJALNEGO = "Oficjalny dokładny wynik";

const PRZYROSTEK_WYNIKU = " — wynik";

// Tytul modala gracza. W BO1 nosi obie nazwy, w BO3/BO5 etykiete mapy
// ("Pick <druzyna>" / "Decider"), bo to ona mowi, ktory wynik sie wpisuje.
function tytulTypuGracza({ maxMaps, mapNo, bestOf, teamA, teamB }) {
  if (Number(maxMaps) === 1) {
    const budzet = LIMITY.TYTUL_MODALA - PRZED_BO1.length - MIEDZY.length;

    const [a, b] = skrocPare(teamA, teamB, budzet);

    if (!a && !b) return PRZED_BO1.replace(/:\s*$/, "");

    return `${PRZED_BO1}${a}${MIEDZY}${b}`;
  }

  const etykieta = getMapLabel(mapNo, bestOf, teamA, teamB);

  return skroc(`${PRZED_MAPY}${etykieta}`, LIMITY.TYTUL_MODALA);
}

// Tytul modala administratora. Swiadomie bez nazw druzyn - getMapLabel bez
// nich oddaje "Pick Team A", a nazwy i tak sa na etykietach pol.
function tytulWynikuOficjalnego({ maxMaps, mapNo, bestOf }) {
  if (Number(maxMaps) === 1) return PRZED_OFICJALNEGO;

  return skroc(
    `${PRZED_OFICJALNEGO} — ${getMapLabel(mapNo, bestOf)}`,
    LIMITY.TYTUL_MODALA,
  );
}

// Etykieta pola z wynikiem jednej druzyny. Przyrostek bywa dluzszy
// (np. " — wynik (np. 13)"), wiec budzet na nazwe liczy sie od niego.
function etykietaWyniku(nazwa, przyrostek = PRZYROSTEK_WYNIKU) {
  const su = String(przyrostek ?? "");

  const n = skroc(nazwa, LIMITY.ETYKIETA_POLA - su.length);

  return n ? `${n}${su}` : "Wynik";
}

module.exports = {
  PRZYROSTEK_WYNIKU,
  tytulTypuGracza,
  tytulWynikuOficjalnego,
  etykietaWyniku,
};
