// utils/phase.js
// Lista wyboru do komend
module.exports.PHASE_CHOICES = [
  { name: 'Łącznie', value: 'total' },
  { name: 'Swiss 1', value: 'swiss_1' },
  { name: 'Swiss 2', value: 'swiss_2' },
  { name: 'Swiss 3', value: 'swiss_3' },
  { name: 'Playoffs', value: 'playoffs' },
  { name: 'Double Elim', value: 'double_elim' },
  { name: 'Play-In', value: 'playin' },
];

// Human-readable nazwy
module.exports.humanPhase = (value) => {
  const item = module.exports.PHASE_CHOICES.find(c => c.value === value);
  return item ? item.name : 'Łącznie';
};

/**
 * Alias map dla Swiss — różne możliwe wartości w kolumnie `stage` w DB.
 * Dzięki temu SQL może użyć WHERE stage IN (...)
 */
const SWISS_STAGE_ALIASES = {
  swiss_1: ['stage1', 'swiss_stage_1', 'swiss1', 'SWISS_1', 'SWISS1'],
  swiss_2: ['stage2', 'swiss_stage_2', 'swiss2', 'SWISS_2', 'SWISS2'],
  swiss_3: ['stage3', 'swiss_stage_3', 'swiss3', 'SWISS_3', 'SWISS3'],
};

module.exports.getSwissStageAliases = (phaseValue) => {
  return SWISS_STAGE_ALIASES[phaseValue] || [];
};
