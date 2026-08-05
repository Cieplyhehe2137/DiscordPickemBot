function getMapLabel(mapNo, bestOf, teamA, teamB) {
  const bo = Number(bestOf);
  const no = Number(mapNo);

  if (bo === 1) return 'BO1';

  if (bo === 3) {
    if (no === 1) return `Pick ${teamA || 'Team A'}`;
    if (no === 2) return `Pick ${teamB || 'Team B'}`;
    if (no === 3) return 'Decider';
  }

  if (bo === 5) {
    if (no === 1) return `Pick ${teamA || 'Team A'}`;
    if (no === 2) return `Pick ${teamB || 'Team B'}`;
    if (no === 3) return `Pick ${teamA || 'Team A'}`;
    if (no === 4) return `Pick ${teamB || 'Team B'}`;
    if (no === 5) return 'Decider';
  }

  return `Mapa #${no}`;
}

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

module.exports = {
  getMapLabel,
  maxMapsFromBo
};