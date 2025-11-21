// utils/calcPopularityAll.js
const pool = require('../db');

/** Prosty parser: JSON lub CSV/separator ; ,  */
function parseList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return String(val)
    .replace(/[\[\]"']/g, '')
    .split(/[;,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function bump(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function toPercentList(counter, total) {
  const out = [];
  counter.forEach((count, team) => {
    const pct = total ? (count / total) * 100 : 0;
    out.push({ team, count, pct });
  });
  out.sort((a, b) =>
    b.count - a.count ||
    b.pct - a.pct ||
    a.team.localeCompare(b.team)
  );
  return out;
}

/** Pobiera listę kolumn tabeli i pozwala wybrać pierwszą istniejącą z kandydatów */
async function pickExistingColumn(table, candidates) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  const names = new Set(cols.map(c => c.Field));
  for (const c of candidates) {
    if (names.has(c)) return c;
  }
  return null;
}

/** ===== Swiss ===== */
async function calcSwiss(stage, onlyActive) {
  const table = 'swiss_predictions';
  // Elastycznie: obsłuż różne nazwy kolumn spotykane u Ciebie
  const c30 = await pickExistingColumn(table, ['pick_3_0', 'three_zero', 'threeZero', 'threezero']);
  const c03 = await pickExistingColumn(table, ['pick_0_3', 'zero_three', 'zeroThree', 'zerothree']);
  const cA  = await pickExistingColumn(table, ['advancing', 'advance', 'awans', 'qualified']);
  const cStage = await pickExistingColumn(table, ['stage', 'swiss_stage']);
  const cActive = await pickExistingColumn(table, ['active', 'is_active']);

  const where = ['1=1'];
  const params = [];
  if (cStage && stage) { where.push(`${cStage} = ?`); params.push(stage); }
  if (cActive && onlyActive) { where.push(`${cActive} = 1`); }

  const sql = `
    SELECT user_id,
           ${c30 || 'NULL'} AS pick30,
           ${c03 || 'NULL'} AS pick03,
           ${cA  || 'NULL'} AS adv
      FROM ${table}
     WHERE ${where.join(' AND ')}
  `;
  const [rows] = await pool.query(sql, params);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const m30 = new Map(), m03 = new Map(), mA = new Map();
  for (const r of rows) {
    for (const t of parseList(r.pick30)) bump(m30, t);
    for (const t of parseList(r.pick03)) bump(m03, t);
    for (const t of parseList(r.adv))    bump(mA,  t);
  }

  return {
    totalUsers: total,
    buckets: {
      '3-0':   toPercentList(m30, total),
      '0-3':   toPercentList(m03, total),
      'Awans': toPercentList(mA,  total),
    },
  };
}

/** ===== Playoffs =====
 * zakładamy kolumny: semifinalists (4), finalists (2), winner (1), third_place_winner (opcjonalna)
 */
async function calcPlayoffs(onlyActive) {
  const table = 'playoffs_predictions';
  const cSF   = await pickExistingColumn(table, ['semifinalists', 'semi_finalists', 'semis']);
  const cF    = await pickExistingColumn(table, ['finalists', 'finals']);
  const cW    = await pickExistingColumn(table, ['winner', 'champion']);
  const cTP   = await pickExistingColumn(table, ['third_place_winner', 'third_place', 'third']);
  const cActive = await pickExistingColumn(table, ['active', 'is_active']);

  const where = ['1=1'];
  if (cActive && onlyActive) where.push(`${cActive} = 1`);

  const sql = `
    SELECT user_id,
           ${cSF || 'NULL'} AS sf,
           ${cF  || 'NULL'} AS f,
           ${cW  || 'NULL'} AS w,
           ${cTP || 'NULL'} AS t3
      FROM ${table}
     WHERE ${where.join(' AND ')}
  `;
  const [rows] = await pool.query(sql);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const mSF = new Map(), mF = new Map(), mW = new Map(), mT3 = new Map();
  for (const r of rows) {
    for (const t of parseList(r.sf)) bump(mSF, t);
    for (const t of parseList(r.f))  bump(mF,  t);
    for (const t of parseList(r.w))  bump(mW,  t);
    for (const t of parseList(r.t3)) bump(mT3, t);
  }

  const buckets = {
    'Półfinaliści': toPercentList(mSF, total),
    'Finaliści':    toPercentList(mF,  total),
    'Zwycięzca':    toPercentList(mW,  total),
  };
  // 3. miejsce jest opcjonalne – pokaż tylko jeśli coś jest
  const t3 = toPercentList(mT3, total);
  if (t3.length) buckets['3. miejsce'] = t3;

  return { totalUsers: total, buckets };
}

/** ===== Double Elimination =====
 * Minimalny wariant zgodny z Twoim opisem:
 *   upper_final_a, lower_final_a, upper_final_b, lower_final_b
 */
async function calcDoubleElim(onlyActive) {
  const table = 'doubleelim_predictions';
  const cUFA = await pickExistingColumn(table, ['upper_final_a','ufa','upperA']);
  const cLFA = await pickExistingColumn(table, ['lower_final_a','lfa','lowerA']);
  const cUFB = await pickExistingColumn(table, ['upper_final_b','ufb','upperB']);
  const cLFB = await pickExistingColumn(table, ['lower_final_b','lfb','lowerB']);
  const cActive = await pickExistingColumn(table, ['active', 'is_active']);

  const where = ['1=1'];
  if (cActive && onlyActive) where.push(`${cActive} = 1`);

  const sql = `
    SELECT user_id,
           ${cUFA || 'NULL'} AS ufa,
           ${cLFA || 'NULL'} AS lfa,
           ${cUFB || 'NULL'} AS ufb,
           ${cLFB || 'NULL'} AS lfb
      FROM ${table}
     WHERE ${where.join(' AND ')}
  `;
  const [rows] = await pool.query(sql);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const mUFA = new Map(), mLFA = new Map(), mUFB = new Map(), mLFB = new Map();
  for (const r of rows) {
    for (const t of parseList(r.ufa)) bump(mUFA, t);
    for (const t of parseList(r.lfa)) bump(mLFA, t);
    for (const t of parseList(r.ufb)) bump(mUFB, t);
    for (const t of parseList(r.lfb)) bump(mLFB, t);
  }

  return {
    totalUsers: total,
    buckets: {
      'Upper Final – Grupa A': toPercentList(mUFA, total),
      'Lower Final – Grupa A': toPercentList(mLFA, total),
      'Upper Final – Grupa B': toPercentList(mUFB, total),
      'Lower Final – Grupa B': toPercentList(mLFB, total),
    },
  };
}

/** ===== Play-In =====
 * Najprościej: jedna lista drużyn, które wskazano – bucket "Awans"
 */
async function calcPlayIn(onlyActive) {
  const table = 'playin_predictions';
  const cTeams = await pickExistingColumn(table, ['teams','picks','awans']);
  const cActive = await pickExistingColumn(table, ['active', 'is_active']);

  const where = ['1=1'];
  if (cActive && onlyActive) where.push(`${cActive} = 1`);

  const sql = `
    SELECT user_id, ${cTeams || 'NULL'} AS teams
      FROM ${table}
     WHERE ${where.join(' AND ')}
  `;
  const [rows] = await pool.query(sql);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const m = new Map();
  for (const r of rows) {
    for (const t of parseList(r.teams)) bump(m, t);
  }

  return {
    totalUsers: total,
    buckets: { 'Awans': toPercentList(m, total) },
  };
}

/** Publiczne API: jedna funkcja do wszystkich faz */
async function calculatePopularityForPanel({ phase, stage = null, onlyActive = false }) {
  const p = String(phase || '').toLowerCase();

  if (p.includes('swiss') || /stage[ _-]?(1|2|3)|\b(1|2|3)\b/i.test(p) || stage) {
    // standaryzuj stage do 'stage1|2|3' jeśli przyszedł numer
    let st = stage;
    if (!st) {
      const m = p.match(/stage[ _-]?(1|2|3)|\b(1|2|3)\b/i);
      if (m) st = 'stage' + (m[1] || m[2]);
    }
    return calcSwiss(st || 'stage1', onlyActive);
  }
  if (p.includes('playoffs')) return calcPlayoffs(onlyActive);
  if (p.includes('double'))   return calcDoubleElim(onlyActive);
  if (p.includes('playin') || p.includes('play-in') || p.includes('play_in')) return calcPlayIn(onlyActive);

  // fallback – nic nie wiemy
  return { totalUsers: 0, buckets: {} };
}

module.exports = { calculatePopularityForPanel };
