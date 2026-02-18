// handlers/submitSwissResultsDropdown.js

const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const { buildSwissComponents, getCurrentSwiss } = require('./openSwissResultsDropdown');

/* ===============================
   CACHE (TTL)
=============================== */
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

/* ===============================
   HELPERS
=============================== */

function extractStage(customId) {
  const parts = String(customId).split(':');
  return parts[1] || null; // zawsze druga część
}

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

function normalize(arr = []) {
  return Array.from(
    new Set(arr.map(v => String(v || '').trim()).filter(Boolean))
  );
}

function mergeWithCap(base = [], add = [], cap) {
  const merged = normalize([...base, ...add]);
  if (merged.length > cap) {
    return { ok: false, err: `Limit ${cap} (jest ${merged.length})` };
  }
  return { ok: true, merged };
}

/* ===============================
   HANDLER
=============================== */

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
  if (!interaction.guildId) return;

  const guildId = interaction.guildId;
  const adminId = interaction.user.id;

  /* ===============================
     SELECT → zapis do cache
  =============================== */
  if (interaction.isStringSelectMenu()) {

    const stage = extractStage(interaction.customId);
    if (!stage) {
      await interaction.deferUpdate().catch(() => {});
      return;
    }

    const key = `${guildId}:${adminId}:${stage}`;
    const local = getCache(key) || { add3: [], add0: [], addA: [] };

    if (interaction.customId.startsWith('official_admin_swiss_3_0')) {
      local.add3 = interaction.values;
    } else if (interaction.customId.startsWith('official_admin_swiss_0_3')) {
      local.add0 = interaction.values;
    } else if (interaction.customId.startsWith('official_admin_swiss_advancing')) {
      local.addA = interaction.values;
    }

    setCache(key, local);

    console.log("CACHE SET:", key, local);

    await interaction.deferUpdate().catch(() => {});
    return;
  }

  /* ===============================
     CONFIRM BUTTON
  =============================== */
  if (
    interaction.isButton() &&
    interaction.customId.startsWith('confirm_swiss_results:')
  ) {
    await interaction.deferUpdate();

    const stage = extractStage(interaction.customId);
    const key = `${guildId}:${adminId}:${stage}`;
    const sel = getCache(key);

    console.log("CONFIRM STAGE:", stage);
    console.log("CONFIRM CACHE KEY:", key);
    console.log("CACHE HIT:", sel);

    if (!sel) {
      return interaction.followUp({
        ephemeral: true,
        content: '⚠️ Brak zapisanych wyborów (cache wygasł).'
      });
    }

    if (!sel.add3.length && !sel.add0.length && !sel.addA.length) {
      return interaction.followUp({
        ephemeral: true,
        content: '⚠️ Nic nie wybrano w dropdownach.'
      });
    }

    await withGuild(interaction, async ({ pool }) => {

      const teams = await loadTeamsFromDB(pool, guildId);
      const current = await getCurrentSwiss(pool, guildId, stage);

      const m3 = mergeWithCap(current.x3_0, sel.add3, 2);
      if (!m3.ok)
        return interaction.followUp({ ephemeral: true, content: `⚠️ 3-0: ${m3.err}` });

      const m0 = mergeWithCap(current.x0_3, sel.add0, 2);
      if (!m0.ok)
        return interaction.followUp({ ephemeral: true, content: `⚠️ 0-3: ${m0.err}` });

      const mA = mergeWithCap(current.adv, sel.addA, 6);
      if (!mA.ok)
        return interaction.followUp({ ephemeral: true, content: `⚠️ Awans: ${mA.err}` });

      const all = [...m3.merged, ...m0.merged, ...mA.merged];
      if (new Set(all.map(v => v.toLowerCase())).size !== all.length) {
        return interaction.followUp({
          ephemeral: true,
          content: '⚠️ Drużyna nie może być w więcej niż jednej kategorii.'
        });
      }

      const invalid = all.filter(t => !teams.includes(t));
      if (invalid.length) {
        return interaction.followUp({
          ephemeral: true,
          content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}`
        });
      }

      console.log("SAVING SWISS:", {
        guildId,
        stage,
        m3: m3.merged,
        m0: m0.merged,
        mA: mA.merged
      });

      try {
        await pool.query(
          `INSERT INTO swiss_results
           (guild_id, stage, correct_3_0, correct_0_3, correct_advancing, active)
           VALUES (?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
             correct_3_0 = VALUES(correct_3_0),
             correct_0_3 = VALUES(correct_0_3),
             correct_advancing = VALUES(correct_advancing),
             active = 1`,
          [
            guildId,
            stage,
            m3.merged.join(', '),
            m0.merged.join(', '),
            mA.merged.join(', ')
          ]
        );

        cache.delete(key);

        const fresh = {
          x3_0: m3.merged,
          x0_3: m0.merged,
          adv: mA.merged
        };

        const { embed, components } =
          buildSwissComponents(stage, stage, teams, fresh);

        await interaction.editReply({
          embeds: [embed],
          components,
          content: null
        });

      } catch (err) {
        logger.error('swiss_results', 'DB error', {
          guildId,
          stage,
          message: err.message,
          stack: err.stack
        });

        return interaction.followUp({
          ephemeral: true,
          content: '❌ Błąd zapisu wyników Swiss.'
        });
      }
    });
  }
};