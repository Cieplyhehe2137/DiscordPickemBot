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

const { DateTime } = require("luxon");

const VALID_PHASES = ["swiss", "playoffs", "doubleelim", "playin"];

function parseDeadlineInput(rawInput) {
  const dt = DateTime.fromFormat(String(rawInput || ""), "yyyy-MM-dd HH:mm", {
    zone: "Europe/Warsaw",
  });

  if (!dt.isValid) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD HH:mm." };
  }

  if (dt <= DateTime.now()) {
    return { ok: false, error: "Deadline must be in the future." };
  }

  return { ok: true, utcDate: dt.toUTC().toJSDate() };
}

function resolveSwissStage(inputStage) {
  const stageNumber = String(inputStage || "").match(/\d+/)?.[0];
  if (!stageNumber) return null;
  return {
    dbPhase: `swiss_stage${stageNumber}`,
    dbStageKey: `stage${stageNumber}`,
  };
}

// Pick/prediction deadline lookup (mirrors commands/setDeadline.js).
async function findPanelForDeadline(pool, guildId, phase, stage) {
  if (phase === "swiss") {
    const resolved = resolveSwissStage(stage);

    if (!resolved) {
      return { error: "Invalid Swiss stage. Use 1, 2, or 3." };
    }

    const [rows] = await pool.query(
      `SELECT id, deadline
   FROM active_panels
   WHERE guild_id = ?
     AND phase = ?
     AND stage_key = ?
     AND active = 1
   ORDER BY id DESC
   LIMIT 1`,
      [guildId, resolved.dbPhase, resolved.dbStageKey],
    );

    return {
      row: rows[0] || null,
      lookupPhase: resolved.dbPhase,
      lookupStageKey: resolved.dbStageKey,
    };
  }

  const [rows] = await pool.query(
    `SELECT id, deadline
   FROM active_panels
   WHERE guild_id = ?
     AND phase = ?
     AND active = 1
   ORDER BY id DESC
   LIMIT 1`,
    [guildId, phase],
  );

  return { row: rows[0] || null, lookupPhase: phase, lookupStageKey: null };
}

// Match-results deadline lookup.
//
// Wcześniej szukało panelu po surowym `phase`, więc dla phase='swiss'
// nie znajdowało niczego: publisher zapisuje w active_panels.phase wartości
// 'swiss_stage1' / 'swiss_stage2' / 'swiss_stage3', a nie 'swiss'. Ustawienie
// deadline'u meczowego dla Swiss zawsze kończyło się 404.
//
// Deadline meczowy nadal NIE jest stage-specyficzny (jeden na całą fazę
// Swiss, tak jak w bocie) - bierzemy więc najnowszy panel dowolnego etapu.
async function findPanelForMatchDeadline(pool, guildId, phase) {
  if (phase === "swiss") {
    const [rows] = await pool.query(
      `SELECT id, phase FROM active_panels
        WHERE guild_id = ?
          AND phase IN ('swiss_stage1', 'swiss_stage2', 'swiss_stage3')
          AND active = 1
        ORDER BY id DESC LIMIT 1`,
      [guildId],
    );

    return { row: rows[0] || null, lookupPhase: rows[0]?.phase || "swiss" };
  }

  const [rows] = await pool.query(
    `SELECT id FROM active_panels WHERE guild_id = ? AND phase = ? AND active = 1 ORDER BY id DESC LIMIT 1`,
    [guildId, phase],
  );

  return { row: rows[0] || null, lookupPhase: phase };
}

// Read-side deadline checks for the web API. Deliberately NOT filtered by
// `active` and comparing in SQL (UTC_TIMESTAMP() >= deadline, same expression
// as utils/closeExpiredPanels.js): once a deadline fires, the bot's poller
// flips the panel to active=0, so an active-only lookup would treat "deadline
// passed and panel closed" as "no deadline at all" and reopen web predictions
// right after Discord locked them. Latest row per phase wins - posting a new
// panel (new row, no deadline yet) reopens predictions, matching the bot's
// lifecycle.
async function isPickDeadlinePassed(pool, guildId, phase, stage) {
  let rows;

  if (phase === "swiss") {
    const resolved = resolveSwissStage(stage);
    if (!resolved) return { passed: false, deadline: null };

    [rows] = await pool.query(
      `SELECT deadline, (deadline IS NOT NULL AND UTC_TIMESTAMP() >= deadline) AS passed
       FROM active_panels
       WHERE guild_id = ? AND phase = ? AND stage_key = ?
       ORDER BY id DESC LIMIT 1`,
      [guildId, resolved.dbPhase, resolved.dbStageKey],
    );
  } else {
    [rows] = await pool.query(
      `SELECT deadline, (deadline IS NOT NULL AND UTC_TIMESTAMP() >= deadline) AS passed
       FROM active_panels
       WHERE guild_id = ? AND phase = ?
       ORDER BY id DESC LIMIT 1`,
      [guildId, phase],
    );
  }

  const row = rows[0];
  return { passed: Boolean(row?.passed), deadline: row?.deadline ?? null };
}

async function isMatchDeadlinePassed(pool, guildId, phase) {
  // Strona odczytu musi patrzeć na te same wiersze co zapis - dla Swiss
  // deadline siedzi na panelu 'swiss_stageN', nie na 'swiss'.
  // Jak w isPickDeadlinePassed: BEZ filtra `active`, bo po minięciu deadline'u
  // poller bota gasi panel (active = 0) i zapytanie tylko po aktywnych
  // uznałoby "deadline minął" za "deadline'u nie ma".
  const phaseCondition =
    phase === "swiss"
      ? "phase IN ('swiss_stage1', 'swiss_stage2', 'swiss_stage3')"
      : "phase = ?";

  const params = phase === "swiss" ? [guildId] : [guildId, phase];

  const [rows] = await pool.query(
    `SELECT match_deadline, (match_deadline IS NOT NULL AND UTC_TIMESTAMP() >= match_deadline) AS passed
     FROM active_panels
     WHERE guild_id = ? AND ${phaseCondition}
     ORDER BY id DESC LIMIT 1`,
    params,
  );

  const row = rows[0];
  return {
    passed: Boolean(row?.passed),
    deadline: row?.match_deadline ?? null,
  };
}

module.exports = {
  VALID_PHASES,
  parseDeadlineInput,
  findPanelForDeadline,
  findPanelForMatchDeadline,
  isPickDeadlinePassed,
  isMatchDeadlinePassed,
};
