// Odpowiednik utils/mapLabels.js z bota.
//
// Discord nazywa mapy zgodnie z formatem serii ("Pick NAVI", "Decider"),
// a WWW pokazywało samo "Mapa 1 / 2 / 3". To nie jest kosmetyka: czyj jest
// pick i która mapa jest deciderem to informacja, na której gracz opiera typ.
//
// Kolejność picków jest taka sama jak w bocie:
//   BO3 → A, B, decider
//   BO5 → A, B, A, B, decider

export function getMapLabel(mapNo, bestOf, teamA, teamB) {
  const bo = Number(bestOf);
  const no = Number(mapNo);

  if (bo === 1) return "BO1";

  if (bo === 3) {
    if (no === 1) return `Pick ${teamA || "Team A"}`;
    if (no === 2) return `Pick ${teamB || "Team B"}`;
    if (no === 3) return "Decider";
  }

  if (bo === 5) {
    if (no === 1) return `Pick ${teamA || "Team A"}`;
    if (no === 2) return `Pick ${teamB || "Team B"}`;
    if (no === 3) return `Pick ${teamA || "Team A"}`;
    if (no === 4) return `Pick ${teamB || "Team B"}`;
    if (no === 5) return "Decider";
  }

  return `Mapa #${no}`;
}

export function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

/**
 * Nazwa mapy po veto, albo null gdy jeszcze nieznana.
 *
 * Etykieta ("Pick NAVI", "Decider") wynika z FORMATU serii i jest znana
 * od razu. Nazwa mapy wynika z VETO i pojawia sie dopiero tuz przed
 * meczem - albo nie pojawia wcale, jesli nikt jej nie wpisal i dostawca
 * jej nie zna. Dlatego to dwie osobne rzeczy, a nie jeden napis: brak
 * nazwy nie moze zabrac etykiety.
 */
export function mapNameFor(maps, mapNo) {
  if (!Array.isArray(maps)) return null;

  const wiersz = maps.find((m) => Number(m?.map_no) === Number(mapNo));

  const nazwa = wiersz?.map_name;

  return typeof nazwa === "string" && nazwa.trim() ? nazwa : null;
}

/**
 * Czy ktorakolwiek mapa przyszla od dostawcy.
 *
 * Regulamin CitoAPI: "You may display data obtained from our API in your
 * applications with proper attribution". Atrybucja ma stac przy danych,
 * ktore STAMTAD przyszly - nie przy mapach wpisanych recznie przez
 * administratora, bo te nie sa niczyje poza nasze.
 */
export function mapsAttribution(maps) {
  if (!Array.isArray(maps)) return null;

  return maps.some((m) => m?.source === "cito") ? "cito" : null;
}

/**
 * Etykieta mapy: KTO JA WYBRAL.
 *
 * Dwa zrodla, w tej kolejnosci:
 *
 *   1. PRAWDA z `picked_by`, gdy mapa przyszla od dostawcy znajacego veto.
 *   2. PRZYBLIZENIE z formatu serii, gdy prawdy nie mamy.
 *
 * DLACZEGO TA KOLEJNOSC MA ZNACZENIE. Przyblizenie ("mapa 1 to pick druzyny
 * A") bylo dotad jedynym zrodlem tej etykiety - i jest BLEDNE w 42%
 * przypadkow. Zmierzone na produkcji, 37 meczow ESL Pro League Season 24,
 * 113 map porownanych z prawdziwym przebiegiem veto: 65 zgodnych, 48
 * niezgodnych. O tym, kto wybiera pierwszy, decyduje procedura veto, a nie
 * to, ktora druzyne wpisano w panelu jako pierwsza.
 *
 *   #1 Falcons vs TYLOO  mapa 1 Mirage: pokazywalismy Falcons, pickowal TYLOO
 *   #3 Vitality vs 1win  mapa 1 Dust2:  pokazywalismy Vitality, pickowal 1win
 *
 * Przyblizenie zostaje tam, gdzie prawdy nie ma - lepsze niz puste miejsce,
 * bo decider trafia zawsze (ostatnia mapa jest deciderem niezaleznie od
 * wszystkiego), a to jest polowa informacji.
 */
export function pickLabelFor(maps, mapNo, bestOf, teamA, teamB) {
  const wiersz = Array.isArray(maps)
    ? maps.find((m) => Number(m?.map_no) === Number(mapNo))
    : null;

  const prawda = wiersz?.picked_by;

  if (prawda === "DECIDER") return "Decider";

  if (prawda === "TEAM_A") return `Pick ${teamA || "Team A"}`;

  if (prawda === "TEAM_B") return `Pick ${teamB || "Team B"}`;

  return getMapLabel(mapNo, bestOf, teamA, teamB);
}
