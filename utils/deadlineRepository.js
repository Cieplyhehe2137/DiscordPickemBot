// utils/deadlineRepository.js
//
// Shared date-parsing/panel-lookup logic for commands/setDeadline.js and
// commands/setMatchDeadline.js, extracted so server/index.js can replicate
// the exact same write without duplicating the Europe/Warsaw parsing rules
// or the (deliberately different) panel lookup each command uses.
//
// Note: setDeadline.js resolves Swiss to a stage-specific active_panels row
// (phase = 'swiss_stageN', stage_key = 'stageN'), while setMatchDeadline.js
// always looks up by the raw phase string with no stage transform - Swiss
// match-deadlines are therefore not stage-specific in the current bot. This
// asymmetry is replicated as-is, not "fixed", to stay 1:1 with Discord.

const { DateTime } = require('luxon');

const VALID_PHASES = ['swiss', 'playoffs', 'doubleelim', 'playin'];

function parseDeadlineInput(rawInput) {
  const dt = DateTime.fromFormat(String(rawInput || ''), 'yyyy-MM-dd HH:mm', { zone: 'Europe/Warsaw' });

  if (!dt.isValid) {
    return { ok: false, error: 'Invalid date format. Use YYYY-MM-DD HH:mm.' };
  }

  if (dt <= DateTime.now()) {
    return { ok: false, error: 'Deadline must be in the future.' };
  }

  return { ok: true, utcDate: dt.toUTC().toJSDate() };
}

function resolveSwissStage(inputStage) {
  const stageNumber = String(inputStage || '').match(/\d+/)?.[0];
  if (!stageNumber) return null;
  return { dbPhase: `swiss_stage${stageNumber}`, dbStageKey: `stage${stageNumber}` };
}

// Pick/prediction deadline lookup (mirrors commands/setDeadline.js).
async function findPanelForDeadline(pool, guildId, phase, stage) {
  if (phase === 'swiss') {
    const resolved = resolveSwissStage(stage);

    if (!resolved) {
      return { error: 'Invalid Swiss stage. Use 1, 2, or 3.' };
    }

    const [rows] = await pool.query(
      `SELECT id FROM active_panels WHERE guild_id = ? AND phase = ? AND stage_key = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
      [guildId, resolved.dbPhase, resolved.dbStageKey]
    );

    return { row: rows[0] || null, lookupPhase: resolved.dbPhase, lookupStageKey: resolved.dbStageKey };
  }

  const [rows] = await pool.query(
    `SELECT id FROM active_panels WHERE guild_id = ? AND phase = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
    [guildId, phase]
  );

  return { row: rows[0] || null, lookupPhase: phase, lookupStageKey: null };
}

// Match-results deadline lookup (mirrors commands/setMatchDeadline.js) -
// deliberately does not transform swiss + stage into a stage-specific phase.
async function findPanelForMatchDeadline(pool, guildId, phase) {
  const [rows] = await pool.query(
    `SELECT id FROM active_panels WHERE guild_id = ? AND phase = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
    [guildId, phase]
  );

  return { row: rows[0] || null, lookupPhase: phase };
}

module.exports = { VALID_PHASES, parseDeadlineInput, findPanelForDeadline, findPanelForMatchDeadline };
