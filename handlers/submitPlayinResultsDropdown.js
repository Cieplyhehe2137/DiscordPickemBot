// handlers/submitPlayinResultsDropdown.js

const db = require('../db');
const logger = require('../utils/logger');

// cache: `${guildId}:${adminId}` -> { teams: [], ts }
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

const uniq = (arr) => Array.from(new Set(arr));
const toString = (arr) => (arr && arr.length ? arr.join(', ') : '');

function getCache(key) {
  const c = cache.get(key);
  if (!c) return null;
  if (Date.now() - c.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return c;
}

function setCache(key, data) {
  cache.set(key, { ...data, ts: Date.now() });
}

async function loadActiveTeams(pool, guildId) {
  const [rows] = await pool.query(
    `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
    [guildId]
  );
  return new Set(rows.map(r => String(r.name)));
}

module.exports = async (interaction) => {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    const adminId = interaction.user.id;
    const username = interaction.user.username;
    const cacheKey = `${guildId}:${adminId}`;
    const pool = db.getPoolForGuild(guildId);

    if (!getCache(cacheKey)) {
      setCache(cacheKey, { teams: [] });
    }

    const data = getCache(cacheKey);

    /* ===============================
       SELECT – wybór drużyn
       =============================== */
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'official_playin_teams'
    ) {
      const incoming = interaction.values.map(String);
      const merged = uniq([...data.teams, ...incoming]);

      if (merged.length > 8) {
        return interaction.reply({
          content: '❌ Play-In może mieć **maksymalnie 8 drużyn**.',
          ephemeral: true
        });
      }

      setCache(cacheKey, { teams: merged });

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      return;
    }

    /* ===============================
       BUTTON – zatwierdzenie
       =============================== */
    if (
      interaction.isButton() &&
      interaction.customId === 'confirm_playin_results'
    ) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      if (!data.teams || data.teams.length !== 8) {
        return interaction.editReply(
          '❌ Musisz wybrać **dokładnie 8 drużyn**.'
        );
      }

      const allowed = await loadActiveTeams(pool, guildId);
      const invalid = data.teams.filter(t => !allowed.has(t));

      if (invalid.length) {
        return interaction.editReply(
          `❌ Nieznane lub nieaktywne drużyny: **${invalid.join(', ')}**`
        );
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(
          `UPDATE playin_results SET active = 0 WHERE guild_id = ?`,
          [guildId]
        );

        await conn.query(
          `
          INSERT INTO playin_results
            (guild_id, correct_teams, active, created_at)
          VALUES (?, ?, 1, NOW())
          `,
          [guildId, toString(data.teams)]
        );

        await conn.commit();
        cache.delete(cacheKey);

        logger.info('playin', 'Play-In results saved', {
          guildId,
          adminId,
          teams: data.teams
        });

        return interaction.editReply(
          '✅ Oficjalne wyniki Play-In zostały zapisane.'
        );
      } catch (err) {
        await conn.rollback();
        logger.error('playin', 'Error saving Play-In results', {
          guildId,
          adminId,
          message: err.message
        });
        return interaction.editReply(
          '❌ Błąd zapisu wyników Play-In.'
        );
      } finally {
        conn.release();
      }
    }
  } catch (err) {
    logger.error('playin', 'submitPlayinResultsDropdown crash', {
      message: err.message,
      stack: err.stack
    });

    if (interaction.isRepliable()) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Wystąpił błąd przy zapisie wyników Play-In.',
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
};
