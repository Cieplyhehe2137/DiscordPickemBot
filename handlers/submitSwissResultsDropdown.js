// handlers/submitSwissResultsDropdown.js

const db = require('../db');
const logger = require('../utils/logger');

// re-używamy helperów z openera
const { buildSwissComponents, getCurrentSwiss } = require('./openSwissResultsDropdown');

// cache wyborów admina (tymczasowe)
const userSelections = new Map(); 
// key: `${guildId}:${userId}:${stage}` -> { add3:[], add0:[], addA:[] }

// ===============================
// HELPERS
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

function serializeList(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .join(', ');
}

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
  const m = String(customId).match(/(?:^|_)stage([123])(?:_|$)/i);
  return m ? `stage${m[1]}` : null;
}

// ===============================
// HANDLER
// ===============================
module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const guildId = interaction.guildId;

  const pool = db.getPoolForGuild(guildId);

  // ===============================
  // SELECT MENUS – cache only
  // ===============================
  if (interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();

    const stage = stageFromCustomId(interaction.customId);
    if (!stage) {
      return interaction.followUp({
        ephemeral: true,
        content: '❌ Nie rozpoznano etapu Swiss.'
      });
    }

    const key = `${guildId}:${userId}:${stage}`;
    const tmp = userSelections.get(key) || { add3: [], add0: [], addA: [] };

    if (interaction.customId.startsWith('official_swiss_3_0_')) {
      tmp.add3 = interaction.values;
    } else if (interaction.customId.startsWith('official_swiss_0_3_')) {
      tmp.add0 = interaction.values;
    } else if (interaction.customId.startsWith('official_swiss_advancing_')) {
      tmp.addA = interaction.values;
    }

    userSelections.set(key, tmp);

    logger.info('[Swiss Results]', {
      guildId,
      userId,
      stage,
      picks: tmp
    });

    return interaction.followUp({
      ephemeral: true,
      content: '📝 Zapisano wybór lokalnie. Kliknij **Zatwierdź**, aby zapisać w bazie.'
    });
  }

  // ===============================
  // CONFIRM BUTTON – DB SAVE
  // ===============================
  if (interaction.isButton() && interaction.customId.startsWith('confirm_swiss_results_')) {
    const stage = interaction.customId.replace('confirm_swiss_results_', '');
    const key = `${guildId}:${userId}:${stage}`;
    const sel = userSelections.get(key) || { add3: [], add0: [], addA: [] };

    if (
      (!sel.add3 || sel.add3.length === 0) &&
      (!sel.add0 || sel.add0.length === 0) &&
      (!sel.addA || sel.addA.length === 0)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: '⚠️ Nic nie wybrano w dropdownach.'
      });
    }

    const teams = await loadTeamsFromDB(pool, guildId);
    const cur = await getCurrentSwiss(pool, guildId, stage);

    const m3 = appendWithCap(cur.x3_0, sel.add3, 2);
    if (!m3.ok) return interaction.reply({ ephemeral: true, content: `⚠️ 3-0: ${m3.err}` });

    const m0 = appendWithCap(cur.x0_3, sel.add0, 2);
    if (!m0.ok) return interaction.reply({ ephemeral: true, content: `⚠️ 0-3: ${m0.err}` });

    const mA = appendWithCap(cur.adv, sel.addA, 6);
    if (!mA.ok) return interaction.reply({ ephemeral: true, content: `⚠️ Awansujące: ${mA.err}` });

    // unikalność globalna
    const all = [...m3.merged, ...m0.merged, ...mA.merged];
    if (new Set(all.map(x => x.toLowerCase())).size !== all.length) {
      return interaction.reply({
        ephemeral: true,
        content: '⚠️ Drużyna nie może być w więcej niż jednej kategorii.'
      });
    }

    // walidacja teamów
    const invalid = all.filter(t => !teams.includes(t));
    if (invalid.length) {
      return interaction.reply({
        ephemeral: true,
        content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}`
      });
    }

    try {
      await pool.query(
        `UPDATE swiss_results
         SET active = 0
         WHERE guild_id = ? AND stage = ?`,
        [guildId, stage]
      );

      await pool.query(
        `INSERT INTO swiss_results
          (guild_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [
          guildId,
          stage,
          serializeList(m3.merged),
          serializeList(m0.merged),
          serializeList(mA.merged)
        ]
      );

      userSelections.delete(key);

      const fresh = { x3_0: m3.merged, x0_3: m0.merged, adv: mA.merged };
      const { embed, components } = buildSwissComponents(stage, teams, fresh);

      await interaction.update({ embeds: [embed], components });

      return interaction.followUp({
        ephemeral: true,
        content: '✅ Zapisano wyniki Swiss w bazie.'
      });

    } catch (err) {
      logger.error('[Swiss Results] DB error', {
        guildId,
        stage,
        message: err.message
      });

      return interaction.reply({
        ephemeral: true,
        content: '❌ Błąd podczas zapisu wyników.'
      });
    }
  }
};
