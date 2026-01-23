// handlers/submitDoubleElimResultsDropdown.js
const db = require('../db');
const logger = require('../logger');

// cache per guild + admin
// key: `${guildId}:${adminId}`
const adminCache = new Map();

const ID_MAP = {
  official_doubleelim_upper_final_a: 'upper_final_a',
  official_doubleelim_lower_final_a: 'lower_final_a',
  official_doubleelim_upper_final_b: 'upper_final_b',
  official_doubleelim_lower_final_b: 'lower_final_b',
};

async function loadTeams(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1`,
    [guildId]
  );
  return rows.map(r => String(r.name));
}

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const guildId = interaction.guildId;
    const adminId = interaction.user.id;
    const username = interaction.user.username;
    const cacheKey = `${guildId}:${adminId}`;

    const pool = db.getPoolForGuild(guildId);

    if (!adminCache.has(cacheKey)) {
      adminCache.set(cacheKey, {
        upper_final_a: [],
        lower_final_a: [],
        upper_final_b: [],
        lower_final_b: [],
      });
    }

    const selection = adminCache.get(cacheKey);

    // ===============================
    // SELECT – wybór drużyn
    // ===============================
    if (interaction.isStringSelectMenu() && ID_MAP[interaction.customId]) {
      const key = ID_MAP[interaction.customId];
      const values = Array.isArray(interaction.values) ? interaction.values.map(String) : [];

      selection[key] = Array.from(new Set(values));
      adminCache.set(cacheKey, selection);

      logger.info(
        `[Double Elim Results] ${username} (${adminId}) [${guildId}] wybrał ${key}: ${selection[key].join(', ')}`
      );

      await interaction.deferUpdate();
      return;
    }

    // ===============================
    // BUTTON – zatwierdzenie wyników
    // ===============================
    if (interaction.isButton() && interaction.customId === 'confirm_official_doubleelim') {
      await interaction.deferReply({ ephemeral: true });

      const teams = await loadTeams(pool, guildId);
      const isKnown = (t) => teams.includes(String(t));

      const upper_final_a = selection.upper_final_a || [];
      const lower_final_a = selection.lower_final_a || [];
      const upper_final_b = selection.upper_final_b || [];
      const lower_final_b = selection.lower_final_b || [];

      const all = [
        ...upper_final_a,
        ...lower_final_a,
        ...upper_final_b,
        ...lower_final_b
      ];

      if (!all.length) {
        return interaction.editReply('⚠️ Nic nie wybrano – dodaj przynajmniej jedną drużynę.');
      }

      if (new Set(all).size !== all.length) {
        return interaction.editReply('⚠️ Te same drużyny nie mogą wystąpić w więcej niż jednym slocie.');
      }

      const invalid = all.filter(t => !isKnown(t));
      if (invalid.length) {
        return interaction.editReply(`⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`);
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // ❗ dezaktywujemy TYLKO dla tego guilda
        await conn.query(
          `UPDATE doubleelim_results
           SET active = 0
           WHERE guild_id = ? AND active = 1`,
          [guildId]
        );

        const [res] = await conn.query(
          `INSERT INTO doubleelim_results
           (guild_id, upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
           VALUES (?, ?, ?, ?, ?, 1, NOW())`,
          [
            guildId,
            upper_final_a.length ? upper_final_a.join(', ') : null,
            lower_final_a.length ? lower_final_a.join(', ') : null,
            upper_final_b.length ? upper_final_b.join(', ') : null,
            lower_final_b.length ? lower_final_b.join(', ') : null,
          ]
        );

        await conn.commit();
        adminCache.delete(cacheKey);

        logger.info('[Double Elim Results] ✔ Zapisano oficjalne wyniki', {
          guildId,
          adminId,
          insertId: res.insertId
        });

        const mk = (arr) => (arr && arr.length ? arr.join(', ') : '—');
        const full =
          upper_final_a.length === 2 &&
          lower_final_a.length === 2 &&
          upper_final_b.length === 2 &&
          lower_final_b.length === 2;

        return interaction.editReply(
          (full
            ? '✅ Zapisano **komplet** oficjalnych wyników Double Elimination.\n'
            : '💾 Zapisano **częściowe** oficjalne wyniki Double Elimination.\n') +
          `UFA: ${mk(upper_final_a)} | LFA: ${mk(lower_final_a)} | ` +
          `UFB: ${mk(upper_final_b)} | LFB: ${mk(lower_final_b)}`
        );
      } catch (e) {
        await conn.rollback();
        logger.error('[Double Elim Results] ❌ DB error', {
          guildId,
          adminId,
          message: e?.sqlMessage || e?.message,
          stack: e?.stack
        });
        return interaction.editReply(`❌ Błąd zapisu wyników: ${e.sqlMessage || e.message}`);
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    logger.error('[Double Elim Results] top-level error', err);
    try {
      if (interaction.isRepliable()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: '❌ Wystąpił błąd podczas zapisu wyników Double Elimination.',
            ephemeral: true
          });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            content: '❌ Wystąpił błąd podczas zapisu wyników Double Elimination.'
          });
        }
      }
    } catch (_) {}
  }
};
