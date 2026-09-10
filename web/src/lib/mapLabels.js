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
