// handlers/submitDoubleElimResultsDropdown.js
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const logger = require('../logger');

function loadTeams() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {
    logger.warn('[Double Elim Results] Nie udało się wczytać teams.json', e);
  }
  return [];
}

// cache per guild + admin
const adminCache = new Map(); // key: `${guildId}:${adminId}` -> { upper_final_a:[], lower_final_a:[], upper_final_b:[], lower_final_b:[] }

const ID_MAP = {
  official_doubleelim_upper_final_a: 'upper_final_a',
  official_doubleelim_lower_final_a: 'lower_final_a',
  official_doubleelim_upper_final_b: 'upper_final_b',
  official_doubleelim_lower_final_b: 'lower_final_b',
};

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const adminId = interaction.user.id;
    const username = interaction.user.username;
    const guildId = interaction.guildId || 'dm';
    const cacheKey = `${guildId}:${adminId}`;

    if (!adminCache.has(cacheKey)) {
      adminCache.set(cacheKey, {
        upper_final_a: [],
        lower_final_a: [],
        upper_final_b: [],
        lower_final_b: [],
      });
    }
    const selection = adminCache.get(cacheKey);

    // ======== OBSŁUGA DROPDOWNÓW ========
    if (interaction.isStringSelectMenu() && ID_MAP[interaction.customId]) {
      const key = ID_MAP[interaction.customId];
      await interaction.deferUpdate();

      const vals = Array.isArray(interaction.values) ? interaction.values : [];
      selection[key] = Array.from(new Set(vals)); // unikalne wartości

      adminCache.set(cacheKey, selection);
      logger.info(`[Double Elim Results] ${username} (${adminId}) [${guildId}] wybrał ${key}: ${selection[key].join(', ')}`);
      return;
    }

    // ======== ZATWIERDZENIE WYNIKÓW ========
    if (interaction.isButton() && interaction.customId === 'confirm_official_doubleelim') {
      await interaction.deferReply({ ephemeral: true });

      const teams = loadTeams();
      const isKnown = (t) => teams.includes(String(t));

      const upper_final_a = Array.isArray(selection.upper_final_a) ? selection.upper_final_a : [];
      const lower_final_a = Array.isArray(selection.lower_final_a) ? selection.lower_final_a : [];
      const upper_final_b = Array.isArray(selection.upper_final_b) ? selection.upper_final_b : [];
      const lower_final_b = Array.isArray(selection.lower_final_b) ? selection.lower_final_b : [];

      const all = [...upper_final_a, ...lower_final_a, ...upper_final_b, ...lower_final_b];

      if (!all.length) {
        await interaction.editReply('⚠️ Nic nie wybrano – dodaj chociaż jedną pozycję.');
        return;
      }

      if (new Set(all).size !== all.length) {
        await interaction.editReply('⚠️ Te same drużyny nie mogą być wybrane więcej niż raz.');
        return;
      }

      const bad = all.filter((t) => !isKnown(t));
      if (bad.length) {
        await interaction.editReply(`⚠️ Nieznane drużyny: ${bad.join(', ')}`);
        return;
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(`UPDATE doubleelim_results SET active = 0 WHERE active = 1`);

        // 🔹 Zapis jako STRING (np. "FaZe, G2"), nie JSON
        const params = [
          upper_final_a.length ? upper_final_a.join(', ') : null,
          lower_final_a.length ? lower_final_a.join(', ') : null,
          upper_final_b.length ? upper_final_b.join(', ') : null,
          lower_final_b.length ? lower_final_b.join(', ') : null,
        ];

        const [res] = await conn.query(
          `INSERT INTO doubleelim_results
            (upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
           VALUES (?, ?, ?, ?, 1, NOW())`,
          params
        );

        await conn.commit();
        logger.info('[Double Elim Results] ✔ Zapisano oficjalne wyniki', {
          guildId,
          adminId,
          insertId: res.insertId
        });

        adminCache.delete(cacheKey);

        const mk = (arr) => (arr && arr.length ? arr.join(', ') : '—');
        const full =
          upper_final_a.length === 2 &&
          lower_final_a.length === 2 &&
          upper_final_b.length === 2 &&
          lower_final_b.length === 2;

        await interaction.editReply(
          (full
            ? '✅ Zapisano **komplet** wyników Double Elimination.\n'
            : '💾 Zapisano **częściowe** wyniki Double Elimination.\n') +
            `UFA: ${mk(upper_final_a)} | LFA: ${mk(lower_final_a)} | ` +
            `UFB: ${mk(upper_final_b)} | LFB: ${mk(lower_final_b)}`
        );

        return;
      } catch (e) {
        await conn.rollback();
        logger.error('[Double Elim Results] ❌ DB error:', {
          guildId,
          adminId,
          message: e?.sqlMessage || e?.message,
          stack: e?.stack
        });
        await interaction.editReply(`❌ Błąd zapisu wyników: ${e.sqlMessage || e.message}`);
        return;
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    logger.error('[Double Elim Results] top-level error:', err);
    try {
      if (interaction.isRepliable()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({ content: '❌ Wystąpił błąd podczas wprowadzania wyników Double Elim.', ephemeral: true });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: '❌ Wystąpił błąd podczas wprowadzania wyników Double Elim.' });
        }
      }
    } catch (_) {}
  }
};
