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
 * Dane Liquipedii sa na CC-BY-SA 3.0, co wymaga wskazania zrodla. Atrybucja
 * ma stac przy danych, ktore STAMTAD przyszly - nie przy mapach wpisanych
 * recznie przez administratora.
 */
export function mapsAttribution(maps) {
  if (!Array.isArray(maps)) return null;

  return maps.some((m) => m?.source === "liquipedia") ? "liquipedia" : null;
}
