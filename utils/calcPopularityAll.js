const db = require('../db');
const logger = require('./logger');

/** ===============================
 *  HELPERS
 *  =============================== */

/** Prosty parser: JSON lub CSV/separator ; , */
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
    out.push({
      team,
      count,
      pct: total ? (count / total) * 100 : 0
    });
  });

  return out.sort(
    (a, b) =>
      b.count - a.count ||
      b.pct - a.pct ||
      a.team.localeCompare(b.team)
  );
}

/** UWAGA:
 * table jest HARDCODED (bez inputu usera) – bezpieczne
 */
async function pickExistingColumn(pool, table, candidates) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM ${table}`);
  const names = new Set(cols.map(c => c.Field));
  return candidates.find(c => names.has(c)) || null;
}

/** ===============================
 *  SWISS
 *  =============================== */
async function calcSwiss(pool, guildId, stage, onlyActive) {
  const table = 'swiss_predictions';

  const c30    = await pickExistingColumn(pool, table, ['pick_3_0']);
  const c03    = await pickExistingColumn(pool, table, ['pick_0_3']);
  const cA     = await pickExistingColumn(pool, table, ['advancing']);
  const cStage = await pickExistingColumn(pool, table, ['stage']);
  const cActive = await pickExistingColumn(pool, table, ['active']);

  const where = ['guild_id = ?'];
  const params = [guildId];

  if (cStage && stage) {
    where.push(`${cStage} = ?`);
    params.push(stage);
  }
  if (cActive && onlyActive) {
    where.push(`${cActive} = 1`);
  }

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

  const m30 = new Map();
  const m03 = new Map();
  const mA  = new Map();

  for (const r of rows) {
    parseList(r.pick30).forEach(t => bump(m30, t));
    parseList(r.pick03).forEach(t => bump(m03, t));
    parseList(r.adv).forEach(t => bump(mA, t));
  }

  return {
    totalUsers: total,
    buckets: {
      '3-0': toPercentList(m30, total),
      '0-3': toPercentList(m03, total),
      'Awans': toPercentList(mA, total),
    },
  };
}

/** ===============================
 *  PLAYOFFS
 *  =============================== */
async function calcPlayoffs(pool, guildId, onlyActive) {
  const table = 'playoffs_predictions';

  const cSF = await pickExistingColumn(pool, table, ['semifinalists']);
  const cF  = await pickExistingColumn(pool, table, ['finalists']);
  const cW  = await pickExistingColumn(pool, table, ['winner']);
  const cTP = await pickExistingColumn(pool, table, ['third_place_winner']);
  const cActive = await pickExistingColumn(pool, table, ['active']);

  const where = ['guild_id = ?'];
  const params = [guildId];

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

  const [rows] = await pool.query(sql, params);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const mSF = new Map();
  const mF  = new Map();
  const mW  = new Map();
  const mT3 = new Map();

  for (const r of rows) {
    parseList(r.sf).forEach(t => bump(mSF, t));
    parseList(r.f).forEach(t => bump(mF, t));
    parseList(r.w).forEach(t => bump(mW, t));
    parseList(r.t3).forEach(t => bump(mT3, t));
  }

  const buckets = {
    'Półfinaliści': toPercentList(mSF, total),
    'Finaliści':    toPercentList(mF, total),
    'Zwycięzca':    toPercentList(mW, total),
  };

  const t3 = toPercentList(mT3, total);
  if (t3.length) buckets['3. miejsce'] = t3;

  return { totalUsers: total, buckets };
}

/** ===============================
 *  DOUBLE ELIM
 *  =============================== */
async function calcDoubleElim(pool, guildId, onlyActive) {
  const table = 'doubleelim_predictions';

  const cUFA = await pickExistingColumn(pool, table, ['upper_final_a']);
  const cLFA = await pickExistingColumn(pool, table, ['lower_final_a']);
  const cUFB = await pickExistingColumn(pool, table, ['upper_final_b']);
  const cLFB = await pickExistingColumn(pool, table, ['lower_final_b']);
  const cActive = await pickExistingColumn(pool, table, ['active']);

  const where = ['guild_id = ?'];
  const params = [guildId];

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

  const [rows] = await pool.query(sql, params);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const mUFA = new Map();
  const mLFA = new Map();
  const mUFB = new Map();
  const mLFB = new Map();

  for (const r of rows) {
    parseList(r.ufa).forEach(t => bump(mUFA, t));
    parseList(r.lfa).forEach(t => bump(mLFA, t));
    parseList(r.ufb).forEach(t => bump(mUFB, t));
    parseList(r.lfb).forEach(t => bump(mLFB, t));
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

/** ===============================
 *  PLAY-IN
 *  =============================== */
async function calcPlayIn(pool, guildId, onlyActive) {
  const table = 'playin_predictions';

  const cTeams = await pickExistingColumn(pool, table, ['teams']);
  const cActive = await pickExistingColumn(pool, table, ['active']);

  const where = ['guild_id = ?'];
  const params = [guildId];

  if (cActive && onlyActive) where.push(`${cActive} = 1`);

  const sql = `
    SELECT user_id, ${cTeams || 'NULL'} AS teams
    FROM ${table}
    WHERE ${where.join(' AND ')}
  `;

  const [rows] = await pool.query(sql, params);

  const users = new Set(rows.map(r => r.user_id));
  const total = users.size;

  const m = new Map();
  for (const r of rows) {
    parseList(r.teams).forEach(t => bump(m, t));
  }

  return {
    totalUsers: total,
    buckets: {
      'Awans': toPercentList(m, total)
    },
  };
}

/** ===============================
 *  PUBLIC API
 *  =============================== */
async function calculatePopularityForPanel({
  guildId,
  phase,
  stage = null,
  onlyActive = false
}) {
  if (!guildId) throw new Error('guildId is required');

  const pool = db.getPoolForGuild(guildId);
  const p = String(phase || '').toLowerCase();

  try {
    if (p.includes('swiss') || stage) {
      const st = stage || 'stage1';
      return await calcSwiss(pool, guildId, st, onlyActive);
    }

    if (p.includes('playoffs')) {
      return await calcPlayoffs(pool, guildId, onlyActive);
    }

    if (p.includes('double')) {
      return await calcDoubleElim(pool, guildId, onlyActive);
    }

    if (p.includes('playin') || p.includes('play-in')) {
      return await calcPlayIn(pool, guildId, onlyActive);
    }

    return { totalUsers: 0, buckets: {} };
  } catch (err) {
    logger.error('stats', 'calculatePopularityForPanel failed', {
      guildId,
      phase,
      stage,
      message: err.message,
      stack: err.stack
    });
    return { totalUsers: 0, buckets: {} };
  }
}

module.exports = { calculatePopularityForPanel };
