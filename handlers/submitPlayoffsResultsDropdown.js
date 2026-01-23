// handlers/submitPlayoffsResultsDropdown.js
const db = require('../db');
const logger = require('../logger');

// GLOBAL CACHE per guild + admin
if (!global._resultsPlayoffsCache) global._resultsPlayoffsCache = {};
const cache = global._resultsPlayoffsCache;

// ===============================
// DB helpers
// ===============================
async function loadTeamsFromDB(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
}

async function getCurrentPlayoffs(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT correct_semifinalists,
            correct_finalists,
            correct_winner,
            correct_third_place_winner
     FROM playoffs_results
     WHERE guild_id = ?
       AND active = 1
     ORDER BY id DESC
     LIMIT 1`,
    [guildId]
  );

  if (!rows.length) {
    return { semifinalists: [], finalists: [], winner: [], third: [] };
  }

  const toArr = (s) =>
    !s ? [] : String(s).split(',').map(v => v.trim()).filter(Boolean);

  const r = rows[0];
  return {
    semifinalists: toArr(r.correct_semifinalists),
    finalists: toArr(r.correct_finalists),
    winner: toArr(r.correct_winner),
    third: toArr(r.correct_third_place_winner),
  };
}

// ===============================
// utils
// ===============================
function cleanList(arr = []) {
  const seen = new Set();
  return arr.filter(v => {
    const k = String(v).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// cap = 1 → replace, reszta → merge z limitem
function pickOrKeep(baseArr, addArr, cap) {
  baseArr = baseArr || [];

  if (cap === 1) {
    const pick = addArr?.length ? String(addArr.at(-1)) : baseArr[0];
    return { ok: true, merged: pick ? [pick] : [] };
  }

  if (addArr?.length) {
    const merged = cleanList([...baseArr, ...addArr]);
    if (merged.length > cap) {
      return { ok: false, err: `Limit ${cap} (jest ${merged.length})` };
    }
    return { ok: true, merged };
  }

  return { ok: true, merged: baseArr };
}

// ===============================
// HANDLER
// ===============================
module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const guildId = interaction.guildId;
  const adminId = interaction.user.id;
  const username = interaction.user.username;

  const pool = db.getPoolForGuild(guildId);

  if (!cache[guildId]) cache[guildId] = {};
  if (!cache[guildId][adminId]) cache[guildId][adminId] = {};

  const local = cache[guildId][adminId];

  // ===============================
  // DROPDOWNS
  // ===============================
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith('results_playoffs_')
  ) {
    const type = interaction.customId.replace('results_playoffs_', '');
    local[type] = interaction.values;

    logger.info(
      `[Playoffs Results] ${username} (${adminId}) [${guildId}] ${type}: ${interaction.values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // ===============================
  // CONFIRM
  // ===============================
  if (interaction.isButton() && interaction.customId === 'confirm_playoffs_results') {
    await interaction.deferReply({ ephemeral: true });

    const current = await getCurrentPlayoffs(pool, guildId);

    const mSemi   = pickOrKeep(current.semifinalists, local.semifinalists, 4);
    const mFinal  = pickOrKeep(current.finalists, local.finalists, 2);
    const mWinner = pickOrKeep(current.winner, local.winner, 1);
    const mThird  = pickOrKeep(current.third, local.third_place_winner, 1);

    if (!mSemi.ok)   return interaction.editReply(`⚠️ Półfinaliści: ${mSemi.err}`);
    if (!mFinal.ok)  return interaction.editReply(`⚠️ Finaliści: ${mFinal.err}`);
    if (!mWinner.ok) return interaction.editReply(`⚠️ Zwycięzca: ${mWinner.err}`);
    if (!mThird.ok)  return interaction.editReply(`⚠️ 3. miejsce: ${mThird.err}`);

    // relacje
    if (mFinal.merged.some(t => !mSemi.merged.includes(t)))
      return interaction.editReply('⚠️ Finaliści muszą być półfinalistami.');

    if (mWinner.merged[0] && !mFinal.merged.includes(mWinner.merged[0]))
      return interaction.editReply('⚠️ Zwycięzca musi być finalistą.');

    if (
      mThird.merged[0] &&
      (mThird.merged[0] === mWinner.merged[0] ||
       !mSemi.merged.includes(mThird.merged[0]))
    )
      return interaction.editReply('⚠️ Niepoprawne 3. miejsce.');

    // walidacja teams
    const teams = await loadTeamsFromDB(pool, guildId);
    const all = [...mSemi.merged, ...mFinal.merged, ...mWinner.merged, ...mThird.merged];
    const invalid = all.filter(t => !teams.includes(t));
    if (invalid.length)
      return interaction.editReply(`⚠️ Nieznane drużyny: ${invalid.join(', ')}`);

    // ===============================
    // DB SAVE
    // ===============================
    try {
      await pool.query(
        `UPDATE playoffs_results
         SET active = 0
         WHERE guild_id = ?`,
        [guildId]
      );

      await pool.query(
        `INSERT INTO playoffs_results
          (guild_id, correct_semifinalists, correct_finalists,
           correct_winner, correct_third_place_winner, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          guildId,
          mSemi.merged.join(', '),
          mFinal.merged.join(', '),
          mWinner.merged.join(', '),
          mThird.merged[0] || null
        ]
      );

      delete cache[guildId][adminId];
      if (!Object.keys(cache[guildId]).length) delete cache[guildId];

      return interaction.editReply(
        `✅ Zapisano wyniki Playoffs:\n` +
        `• SF: ${mSemi.merged.join(', ') || '—'}\n` +
        `• F: ${mFinal.merged.join(', ') || '—'}\n` +
        `• 🏆: ${mWinner.merged.join(', ') || '—'}\n` +
        `• 🥉: ${mThird.merged.join(', ') || '—'}`
      );
    } catch (err) {
      logger.error('[Playoffs Results] DB error', err);
      return interaction.editReply('❌ Błąd zapisu wyników.');
    }
  }
};
