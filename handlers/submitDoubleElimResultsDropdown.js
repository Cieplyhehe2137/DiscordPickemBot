// handlers/submitDoubleElimResultsDropdown.js

const logger = require('../utils/logger');
const { PermissionFlagsBits } = require('discord.js');
const { withGuild } = require('../utils/guildContext');

// cache per guild + admin
// key: `${guildId}:${adminId}` -> { data, ts }
const CACHE_TTL_MS = 15 * 60 * 1000;
const adminCache = new Map();

const ID_MAP = {
  official_doubleelim_upper_final_a: 'upper_final_a',
  official_doubleelim_lower_final_a: 'lower_final_a',
  official_doubleelim_upper_final_b: 'upper_final_b',
  official_doubleelim_lower_final_b: 'lower_final_b',
};

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function getCache(key) {
  const entry = adminCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    adminCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  adminCache.set(key, { data, ts: Date.now() });
}

async function loadTeams(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
    [guildId]
  );
  return rows.map(r => String(r.name));
}

module.exports = async (interaction) => {
  try {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

    // ===== guards =====
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    if (!isAdmin(interaction)) {
      return interaction.reply({
        content: '⛔ Tylko administracja może ustawiać oficjalne wyniki.',
        ephemeral: true
      });
    }

    const adminId = interaction.user.id;
    const cacheKey = `${interaction.guildId}:${adminId}`;

    let selection = getCache(cacheKey);
    if (!selection) {
      selection = {
        upper_final_a: [],
        lower_final_a: [],
        upper_final_b: [],
        lower_final_b: [],
      };
      setCache(cacheKey, selection);
    }

    // ===============================
    // SELECT – wybór drużyn
    // ===============================
    if (interaction.isStringSelectMenu() && ID_MAP[interaction.customId]) {
      const key = ID_MAP[interaction.customId];
      const values = Array.from(new Set((interaction.values || []).map(String)));

      if (values.length > 2) {
        return interaction.reply({
          content: '⚠️ Możesz wybrać maksymalnie **2** drużyny.',
          ephemeral: true
        });
      }

      selection[key] = values;
      setCache(cacheKey, selection);

      logger.debug('doubleelim_results', 'slot updated', {
        guildId: interaction.guildId,
        adminId,
        key,
        values
      });

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      return;
    }

    // ===============================
    // BUTTON – zatwierdzenie wyników
    // ===============================
    if (!interaction.isButton() || interaction.customId !== 'confirm_official_doubleelim') return;

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const teams = await loadTeams(pool, guildId);
      const isKnown = (t) => teams.includes(t);

      const {
        upper_final_a = [],
        lower_final_a = [],
        upper_final_b = [],
        lower_final_b = []
      } = selection;

      const all = [
        ...upper_final_a,
        ...lower_final_a,
        ...upper_final_b,
        ...lower_final_b
      ];

      if (!all.length) {
        return interaction.editReply('⚠️ Nie wybrano żadnych drużyn.');
      }

      if (new Set(all).size !== all.length) {
        return interaction.editReply(
          '⚠️ Te same drużyny nie mogą wystąpić w więcej niż jednym slocie.'
        );
      }

      const invalid = all.filter(t => !isKnown(t));
      if (invalid.length) {
        return interaction.editReply(
          `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
        );
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `UPDATE doubleelim_results
           SET active = 0
           WHERE guild_id = ? AND active = 1`,
          [guildId]
        );

        await conn.query(
          `INSERT INTO doubleelim_results
           (guild_id, upper_final_a, lower_final_a, upper_final_b, lower_final_b, active, created_at)
           VALUES (?, ?, ?, ?, ?, 1, NOW())`,
          [
            guildId,
            upper_final_a.join(', ') || null,
            lower_final_a.join(', ') || null,
            upper_final_b.join(', ') || null,
            lower_final_b.join(', ') || null,
          ]
        );

        await conn.commit();
        adminCache.delete(cacheKey);

        logger.info('doubleelim_results', 'official results saved', {
          guildId,
          adminId
        });

        const mk = (arr) => arr.length ? arr.join(', ') : '—';

        return interaction.editReply(
          `✅ Zapisano oficjalne wyniki Double Elimination:\n` +
          `UFA: ${mk(upper_final_a)} | LFA: ${mk(lower_final_a)}\n` +
          `UFB: ${mk(upper_final_b)} | LFB: ${mk(lower_final_b)}`
        );
      } catch (e) {
        await conn.rollback();
        logger.error('doubleelim_results', 'DB error', {
          guildId,
          adminId,
          message: e.message,
          stack: e.stack
        });
        return interaction.editReply(`❌ Błąd zapisu wyników.`);
      } finally {
        conn.release();
      }
    });

  } catch (err) {
    logger.error('doubleelim_results', 'top-level error', {
      message: err.message,
      stack: err.stack
    });
  }
};
