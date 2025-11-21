// handlers/setPlayoffsResultsDropdown.js
const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');
const logger = require('../logger');

// Cache wyborów adminów
if (!global._resultsPlayoffsCache) {
  global._resultsPlayoffsCache = {};
}
const cache = global._resultsPlayoffsCache;

async function loadTeams() {
  const filePath = path.join(process.cwd(), 'data', 'teams.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function cleanList(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr || []) {
    const s = String(v).trim();
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out;
}

async function getCurrentPlayoffs() {
  const [rows] = await pool.query(
    `SELECT correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner
     FROM playoffs_results WHERE active=1 ORDER BY id DESC LIMIT 1`
  );
  if (!rows.length) {
    return { semifinalists: [], finalists: [], winner: [], third: [] };
  }
  const row = rows[0];
  const toArr = (s) => !s ? [] : String(s).split(',').map(x => x.trim()).filter(Boolean);
  return {
    semifinalists: toArr(row.correct_semifinalists),
    finalists:     toArr(row.correct_finalists),
    winner:        toArr(row.correct_winner),
    third:         toArr(row.correct_third_place_winner),
  };
}

function cappedMerge(baseArr, addArr, cap) {
  const merged = cleanList([...(baseArr || []), ...(addArr || [])]);
  if (merged.length > cap) {
    return { ok:false, merged, err:`Przekroczono limit ${cap} (jest ${merged.length})` };
  }
  return { ok:true, merged };
}
function pickOrKeep(baseArr, addArr, cap) {
  const src = (addArr && addArr.length) ? addArr : (baseArr || []);
  return cappedMerge([], src, cap);
}

module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Dropdowny
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('results_playoffs_')) {
    const type = interaction.customId.replace('results_playoffs_', ''); // semifinalists, finalists, winner, third_place_winner
    if (!cache[userId]) cache[userId] = {};
    cache[userId][type] = interaction.values;

    logger.info(`[Playoffs Results] ${username} (${userId}) wybrał ${interaction.values.length} dla ${type}: ${interaction.values.join(', ')}`);

    await interaction.deferUpdate();
    await interaction.followUp({ content: `✅ Zapisano wybór dla **${type}**: ${interaction.values.join(', ')}`, ephemeral: true });
    return;
  }

  // Zatwierdzanie (partiami + zastępuj)
  if (interaction.isButton() && interaction.customId === 'confirm_playoffs_results') {
    await interaction.deferReply({ ephemeral: true });
    const picks = cache[userId] || {};

    // Aktywne → pickOrKeep z bieżącymi
    const current = await getCurrentPlayoffs();
    const mSemi  = pickOrKeep(current.semifinalists, picks.semifinalists, 4);
    if (!mSemi.ok) return interaction.editReply(`⚠️ Półfinaliści: ${mSemi.err}`);

    const mFinal = pickOrKeep(current.finalists, picks.finalists, 2);
    if (!mFinal.ok) return interaction.editReply(`⚠️ Finaliści: ${mFinal.err}`);

    const mWinner = pickOrKeep(current.winner, picks.winner, 1);
    if (!mWinner.ok) return interaction.editReply(`⚠️ Zwycięzca: ${mWinner.err}`);

    const mThird  = pickOrKeep(current.third, picks.third_place_winner, 1);
    if (!mThird.ok) return interaction.editReply(`⚠️ 3. miejsce: ${mThird.err}`);

    // Relacje po zmergowaniu/zastąpieniu
    if (mFinal.merged.length && !mFinal.merged.every(t => mSemi.merged.includes(t))) {
      return interaction.editReply('⚠️ Finaliści muszą być spośród półfinalistów (po zmergowaniu).');
    }
    if (mWinner.merged.length && !mFinal.merged.includes(mWinner.merged[0])) {
      return interaction.editReply('⚠️ Zwycięzca musi być jednym z finalistów (po zmergowaniu).');
    }
    if (mThird.merged.length) {
      if (!mSemi.merged.includes(mThird.merged[0])) {
        return interaction.editReply('⚠️ Drużyna na 3. miejscu musi być wśród półfinalistów (po zmergowaniu).');
      }
      if (mWinner.merged[0] && mThird.merged[0] === mWinner.merged[0]) {
        return interaction.editReply('⚠️ Zwycięzca nie może być jednocześnie na 3. miejscu.');
      }
    }

    // Walidacja z teams.json
    const teams = await loadTeams();
    const allSelected = [...mSemi.merged, ...mFinal.merged, ...mWinner.merged, ...mThird.merged];
    const invalid = allSelected.filter(t => !teams.includes(t));
    if (invalid.length) return interaction.editReply(`⚠️ Nieznane drużyny: ${invalid.join(', ')}`);

    try {
      await pool.query(`UPDATE playoffs_results SET active = 0`);
      await pool.query(
        `INSERT INTO playoffs_results (
          correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active
        ) VALUES (?, ?, ?, ?, 1)`,
        [
          mSemi.merged.join(', '),
          mFinal.merged.join(', '),
          mWinner.merged.join(', '),
          mThird.merged.length ? mThird.merged.join(', ') : null,
        ]
      );

      delete cache[userId];

      try {
        const calculateScores = require('./calculateScores');
        await calculateScores();
        logger.info('[Playoffs Results] Punkty przeliczone po aktualizacji.');
      } catch (e) {
        logger.error('[Playoffs Results] Błąd przy calculateScores:', e);
      }

      const info =
        `Półfinaliści: **${mSemi.merged.join(', ') || '—'}**\n` +
        `Finaliści: **${mFinal.merged.join(', ') || '—'}**\n` +
        `Zwycięzca: **${mWinner.merged.join(', ') || '—'}**\n` +
        `3. miejsce: **${mThird.merged.join(', ') || '—'}**`;

      return interaction.editReply(
        (mSemi.merged.length === 4 && mFinal.merged.length === 2 && mWinner.merged.length === 1)
          ? `✅ Zapisano **komplet** wyników Playoffs.\n${info}`
          : `💾 Zapisano **częściowe** wyniki Playoffs.\n${info}\n(Dodaj brakujące później.)`
      );
    } catch (error) {
      logger.error(`[Playoffs Results] Błąd podczas zapisu:`, error);
      return interaction.editReply('❌ Błąd podczas zapisu wyników.');
    }
  }
};
