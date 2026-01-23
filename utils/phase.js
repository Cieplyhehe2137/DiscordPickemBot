// utils/phase.js

// ===============================
// PHASE CHOICES (UI / Commands)
// ===============================
const PHASE_CHOICES = [
  { name: 'Łącznie', value: 'total' },
  { name: 'Swiss 1', value: 'swiss_1' },
  { name: 'Swiss 2', value: 'swiss_2' },
  { name: 'Swiss 3', value: 'swiss_3' },
  { name: 'Playoffs', value: 'playoffs' },
  { name: 'Double Elim', value: 'double_elim' },
  { name: 'Play-In', value: 'playin' },
];

// ===============================
// HUMAN LABEL
// ===============================
function humanPhase(value) {
  if (!value) return 'Łącznie';

  const v = String(value).toLowerCase();

  // DB-friendly fallback
  if (v === 'stage1') return 'Swiss 1';
  if (v === 'stage2') return 'Swiss 2';
  if (v === 'stage3') return 'Swiss 3';

  const item = PHASE_CHOICES.find(c => c.value === v);
  return item ? item.name : 'Łącznie';
}

// ===============================
// SWISS STAGE ALIASES (DB)
// ===============================
const SWISS_STAGE_ALIASES = {
  swiss_1: ['stage1', 'swiss_stage_1', 'swiss1', 'SWISS_1', 'SWISS1'],
  swiss_2: ['stage2', 'swiss_stage_2', 'swiss2', 'SWISS_2', 'SWISS2'],
  swiss_3: ['stage3', 'swiss_stage_3', 'swiss3', 'SWISS_3', 'SWISS3'],
};

// ===============================
// HELPERS
// ===============================

// Zwraca tablicę wartości do SQL: WHERE stage IN (...)
function getSwissStageAliases(phaseValue) {
  return SWISS_STAGE_ALIASES[phaseValue] || [];
}

// Zamienia phase z UI na *kanoniczny* stage DB
function phaseToDbStage(phaseValue) {
  if (phaseValue === 'swiss_1') return 'stage1';
  if (phaseValue === 'swiss_2') return 'stage2';
  if (phaseValue === 'swiss_3') return 'stage3';
  return null;
}

module.exports = {
  PHASE_CHOICES,
  humanPhase,
  getSwissStageAliases,
  phaseToDbStage,
};
