// handlers/submitPlayoffsResultsDropdown.js
const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');
const logger = require('../utils/logger');

// jeśli masz opener helpers, podepnij; jeśli nie – usuń te 2 linie i odświeżanie embedów
const { buildPlayoffsComponents, getCurrentPlayoffs } = require('./openPlayoffsResultsDropdown');

// local cache wyborów (z dropdownów) per guild + user
// key: `${guildId}:${userId}` -> { semifinalists:[], finalists:[], winner:[], third_place_winner:[] }
const userSelections = new Map();

async function loadTeams() {
  const filePath = path.join(__dirname, '..', 'teams.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

// zapis jako STRINGI (comma-separated)
function serializeList(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .join(', ');
}

function serializeOne(arrOrStr) {
  if (Array.isArray(arrOrStr)) return String(arrOrStr[0] || '').trim();
  return String(arrOrStr || '').trim();
}

// merge z cap, ale dla cap==1 robimy REPLACE (żeby nie robiło się "2" jak w Twoim błędzie)
function mergeWithCapOrReplace(baseArr, addArr, cap) {
  const base = Array.isArray(baseArr) ? baseArr : [];
  const add = Array.isArray(addArr) ? addArr : [];

  // ✅ najważniejsze: pola 1-sztukowe zawsze zastępujemy
  if (cap === 1) {
    const picked = (add[0] ? [String(add[0]).trim()] : base.slice(0, 1));
    return { ok: true, merged: picked.filter(Boolean) };
  }

  const seen = new Set();
  const out = [];

  for (const v of [...base, ...add]) {
    const s = String(v || '').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length > cap) {
      return { ok: false, merged: out, err: `Przekroczono limit ${cap} (jest ${out.length})` };
    }
  }
  return { ok: true, merged: out };
}

module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guildId || 'dm';
  const key = `${guildId}:${userId}`; // ✅ KLUCZ PER GUILD

  // ===== SELECTS: zapis do cache (lokalnie) =====
  if (interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();

    const cid = interaction.customId;

    const cur = userSelections.get(key) || {
      semifinalists: [],
      finalists: [],
      winner: [],
      third_place_winner: [],
    };

    // Dopasuj do Twoich customId. Założenia:
    // official_playoffs_semifinalists_p0
    // official_playoffs_finalists_p0
    // official_playoffs_winner_p0
    // official_playoffs_third_place_winner_p0
    if (cid.startsWith('official_playoffs_semifinalists')) cur.semifinalists = interaction.values;
    else if (cid.startsWith('official_playoffs_finalists')) cur.finalists = interaction.values;
    else if (cid.startsWith('official_playoffs_winner')) cur.winner = interaction.values;
    else if (cid.startsWith('official_playoffs_third_place_winner')) cur.third_place_winner = interaction.values;
    else {
      logger.warn('playoffs_results', 'Unhandled playoffs select', { cid, guildId, userId });
      return;
    }

    userSelections.set(key, cur);

    const label =
      cid.includes('semifinalists') ? 'semifinalists' :
      cid.includes('finalists') ? 'finalists' :
      cid.includes('third_place_winner') ? 'third_place_winner' :
      cid.includes('winner') ? 'winner' :
      'pick';

    return interaction.followUp({
      ephemeral: true,
      content: `📝 Zapisano wybór dla **${label}** (lokalnie). Kliknij **Zatwierdź**, aby zapisać w bazie.`
    });
  }

  // ===== BUTTON: zapis do DB =====
  if (interaction.isButton() && interaction.customId === 'confirm_playoffs_results') {
    const sel = userSelections.get(key) || {
      semifinalists: [],
      finalists: [],
      winner: [],
      third_place_winner: [],
    };

    const any =
      (sel.semifinalists?.length || 0) +
      (sel.finalists?.length || 0) +
      (sel.winner?.length || 0) +
      (sel.third_place_winner?.length || 0);

    if (!any) {
      return interaction.reply({
        ephemeral: true,
        content: '⚠️ Nic nie wybrano w dropdownach. Najpierw wybierz wyniki, potem kliknij **Zatwierdź**.'
      });
    }

    const teams = await loadTeams();
    const current = await getCurrentPlayoffs();

    const mSemi = mergeWithCapOrReplace(current.semifinalists, sel.semifinalists, 4);
    if (!mSemi.ok) return interaction.reply({ ephemeral: true, content: `⚠️ Półfinaliści: ${mSemi.err}` });

    const mFin = mergeWithCapOrReplace(current.finalists, sel.finalists, 2);
    if (!mFin.ok) return interaction.reply({ ephemeral: true, content: `⚠️ Finaliści: ${mFin.err}` });

    const mWin = mergeWithCapOrReplace(current.winner, sel.winner, 1);
    if (!mWin.ok) return interaction.reply({ ephemeral: true, content: `⚠️ Zwycięzca: ${mWin.err}` });

    const mThird = mergeWithCapOrReplace(current.third_place_winner, sel.third_place_winner, 1);
    if (!mThird.ok) return interaction.reply({ ephemeral: true, content: `⚠️ 3. miejsce: ${mThird.err}` });

    const all = [...mSemi.merged, ...mFin.merged, ...mWin.merged, ...mThird.merged].filter(Boolean);
    const invalid = all.filter(t => !teams.includes(t));
    if (invalid.length) {
      return interaction.reply({
        ephemeral: true,
        content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}`
      });
    }

    const winnerTeam = mWin.merged[0];
    if (winnerTeam && mFin.merged.length > 0 && !mFin.merged.map(x => x.toLowerCase()).includes(winnerTeam.toLowerCase())) {
      return interaction.reply({
        ephemeral: true,
        content: '⚠️ Zwycięzca musi być jednym z finalistów.'
      });
    }

    try {
      await pool.query(`UPDATE playoffs_results SET active=0 WHERE active=1`);

      await pool.query(
        `INSERT INTO playoffs_results (correct_semifinalists, correct_finalists, correct_winner, correct_third_place_winner, active)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           correct_semifinalists=VALUES(correct_semifinalists),
           correct_finalists=VALUES(correct_finalists),
           correct_winner=VALUES(correct_winner),
           correct_third_place_winner=VALUES(correct_third_place_winner),
           active=1`,
        [
          serializeList(mSemi.merged),
          serializeList(mFin.merged),
          serializeOne(mWin.merged),
          serializeOne(mThird.merged),
        ]
      );

      userSelections.delete(key); // ✅ ZMIANA (BYŁO delete(userId))

      // odśwież panel (jeśli masz opener builder)
      try {
        const fresh = {
          semifinalists: mSemi.merged,
          finalists: mFin.merged,
          winner: mWin.merged,
          third_place_winner: mThird.merged,
        };
        const { embed, components } = buildPlayoffsComponents(teams, fresh);
        await interaction.update({ embeds: [embed], components });
      } catch (e) {
        await interaction.reply({ ephemeral: true, content: '✅ Zapisano wyniki w bazie.' });
        return;
      }

      return interaction.followUp({ ephemeral: true, content: '✅ Zapisano wyniki w bazie.' });
    } catch (err) {
      logger.error('playoffs_results', 'DB save failed', {
        guildId,
        userId,
        message: err?.message,
        stack: err?.stack
      });
      return interaction.reply({ ephemeral: true, content: '❌ Błąd podczas zapisu wyników.' });
    }
  }
};
