const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');
const logger = require('../logger');

// re-użyj helperów z opener'a, żeby mieć spójne UI
const { buildSwissComponents, getCurrentSwiss } = require('./openSwissResultsDropdown');

// lokalny cache wyborów „tymczasowych” (z dropdownów) per user/stage
const userSelections = new Map(); // key: `${userId}_${stage}` -> { add3:[], add0:[], addA:[] }

async function loadTeams() {
  const filePath = path.join(__dirname, '..', 'teams.json');
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

// bezpieczny merge „dopisz do istniejących” z limitem
function appendWithCap(baseArr, addArr, cap) {
  const base = Array.isArray(baseArr) ? baseArr : [];
  const add  = Array.isArray(addArr)  ? addArr  : [];
  const seen = new Set();
  const out  = [];

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

function stageFromCustomId(customId) {
  if (customId.endsWith('_stage1')) return 'stage1';
  if (customId.endsWith('_stage2')) return 'stage2';
  if (customId.endsWith('_stage3')) return 'stage3';
  return null;
}

module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // === SELECT MENUS: odkładamy wybory do cache (bez DB) ===
  if (interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();

    const stage = stageFromCustomId(interaction.customId);
    if (!stage) {
      return interaction.followUp({ content: '❌ Nie rozpoznano etapu Swiss.', ephemeral: true });
    }

    const key = `${userId}_${stage}`;
    const tmp = userSelections.get(key) || { add3: [], add0: [], addA: [] };

    if (interaction.customId.startsWith('official_swiss_3_0_')) {
      tmp.add3 = interaction.values; // 1..N w zależności od pozostałych slotów
    } else if (interaction.customId.startsWith('official_swiss_0_3_')) {
      tmp.add0 = interaction.values;
    } else if (interaction.customId.startsWith('official_swiss_advancing_')) {
      tmp.addA = interaction.values;
    }

    userSelections.set(key, tmp);
    logger.info(`[Swiss Results] ${username} (${userId}) wybrał w ${stage}: ${JSON.stringify(tmp)}`);

    // tylko tip, panel odświeży się po kliknięciu „Zatwierdź”
    return interaction.followUp({ content: '📝 Zapisano wybór (lokalnie). Kliknij **Zatwierdź (dopisz)**, aby dodać.', ephemeral: true });
  }

  // === BUTTON: zapis do DB + ODŚWIEŻ PANEL W MIEJSCU ===
  if (interaction.isButton() && interaction.customId.startsWith('confirm_swiss_results_')) {
    // nie tworzymy nowej odpowiedzi – aktualizujemy istniejącą wiadomość z panelem
    // (jeśli chcesz dodatkowy komunikat tekstowy – wyślemy osobnego followUp pod spodem)
    const stage = interaction.customId.replace('confirm_swiss_results_', '');
    const key = `${userId}_${stage}`;
    const sel = userSelections.get(key) || { add3: [], add0: [], addA: [] };

    const teams = await loadTeams();
    const cur = await getCurrentSwiss(stage);

    const m3  = appendWithCap(cur.x3_0, sel.add3, 2);
    if (!m3.ok)  return interaction.reply({ ephemeral: true, content: `⚠️ 3-0: ${m3.err}` });

    const m0  = appendWithCap(cur.x0_3, sel.add0, 2);
    if (!m0.ok)  return interaction.reply({ ephemeral: true, content: `⚠️ 0-3: ${m0.err}` });

    const mA  = appendWithCap(cur.adv,  sel.addA, 6);
    if (!mA.ok) return interaction.reply({ ephemeral: true, content: `⚠️ Awansujące: ${mA.err}` });

    // unikalność między kategoriami
    const all = [...m3.merged, ...m0.merged, ...mA.merged];
    const uniq = new Set(all.map(x => x.toLowerCase()));
    if (uniq.size !== all.length) {
      return interaction.reply({ ephemeral: true, content: '⚠️ Drużyna nie może być w więcej niż jednej kategorii (3-0 / 0-3 / Awans).' });
    }

    // walidacja nazw (na wypadek podmian)
    const invalid = all.filter(t => !teams.includes(t));
    if (invalid.length) {
      return interaction.reply({ ephemeral: true, content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}` });
    }

    try {
      // trzymamy jeden aktywny wpis / stage
      await pool.query(`UPDATE swiss_results SET active=0 WHERE stage=?`, [stage]);
      await pool.query(
        `INSERT INTO swiss_results (correct_3_0, correct_0_3, correct_advancing, stage, active)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           correct_3_0=VALUES(correct_3_0),
           correct_0_3=VALUES(correct_0_3),
           correct_advancing=VALUES(correct_advancing),
           active=1`,
        [
          JSON.stringify(m3.merged),
          JSON.stringify(m0.merged),
          JSON.stringify(mA.merged),
          stage
        ]
      );

      // czyść użyte tymczasowe wybory dla tego usera/stage
      userSelections.delete(key);

      // PRZELICZ PUNKTY (opcjonalnie: możesz dodać throttling, jeśli boisz się spam klików)
      try {
        const calculateScores = require('./calculateScores');
        await calculateScores();
        logger.info(`[Swiss Results] Punkty przeliczone dla ${stage}.`);
      } catch (e) {
        logger.error(`[Swiss Results] Błąd przy calculateScores:`, e);
      }

      // ODŚWIEŻ PANEL W MIEJSCU (edycja oryginalnej wiadomości z przyciskami)
      const fresh = { x3_0: m3.merged, x0_3: m0.merged, adv: mA.merged };
      const { embed, components } = buildSwissComponents(stage, teams, fresh);

      await interaction.update({
        embeds: [embed],
        components
      });

      // opcjonalny krótki feedback pod spodem
      const left30 = Math.max(0, 2 - m3.merged.length);
      const left03 = Math.max(0, 2 - m0.merged.length);
      const leftA  = Math.max(0, 6 - mA.merged.length);
      const complete = (left30 === 0 && left03 === 0 && leftA === 0);

      await interaction.followUp({
        ephemeral: true,
        content: complete
          ? '✅ Zapisano **komplet** wyników dla tej fazy.'
          : '💾 Zapisano **częściowe** wyniki. Panel został odświeżony — możesz dopisać kolejne.'
      });
    } catch (error) {
      logger.error(`[Swiss Results] Błąd zapisu (${stage}):`, error);
      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({ ephemeral: true, content: '❌ Błąd podczas zapisu wyników.' });
      }
      return interaction.followUp({ ephemeral: true, content: '❌ Błąd podczas zapisu wyników.' });
    }
  }
};
