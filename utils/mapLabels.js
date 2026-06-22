function getMapLabel(mapNo, bestOf) {
  const bo = Number(bestOf);
  const no = Number(mapNo);

  if (bo === 1) return 'BO1';

  if (no === 1) return 'Pick Team A';
  if (no === 2) return 'Pick Team B';
  if (no === 3) return 'Decider';

  return `Mapa #${no}`;
}

module.exports = {
  getMapLabel
};