// handlers/submitPlayinResultsDropdown.js
const db = require('../db');
const logger = require('../utils/logger');

// cache: `${guildId}:${adminId}` -> { teams: [] }
const cache = new Map();

const mergeUnique = (a = [], b = []) => Array.from(new Set([...a, ...b]));
const toString = (arr) => (arr && arr.length ? arr.join(', ') : '');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const guildId = interaction.guildId;
  const adminId = interaction.user.id;
  const username = interaction.user.username;

  const cacheKey = `${guildId}:${adminId}`;
  const pool = db.getPoolForGuild(guildId);

  if (!cache.has(cacheKey)) {
    cache.set(cacheKey, { teams: [] });
  }

  const data = cache.get(cacheKey);

  // ===============================
  // SELECT – wybór drużyn
  // ===============================
  if (interaction.isStringSelectMenu()) {
    data.teams = mergeUnique(data.teams, interaction.values.map(String));
    cache.set(cacheKey, data);

    return interaction.reply({
      content: `➕ Dodano: ${interaction.values.join(', ')}`,
      ephemeral: true,
    });
  }

  // ===============================
  // BUTTON – zatwierdzenie wyników
  // ===============================
  if (interaction.isButton() && interaction.customId === 'confirm_playin_results') {
    if (!data.teams.length) {
      return interaction.reply({
        content: '❌ Nie wybrano żadnych drużyn.',
        ephemeral: true,
      });
    }

    try {
      await pool.query(`UPDATE playin_results SET active = 0 WHERE guild_id = ?`, [guildId]);

      await pool.query(
        `
        INSERT INTO playin_results
          (guild_id, correct_teams, active, created_at)
        VALUES (?, ?, 1, NOW())
        `,
        [guildId, toString(data.teams)]
      );

      cache.delete(cacheKey);

      logger.info('playin', 'Play-In results saved', {
        guildId,
        adminId,
        teams: data.teams,
      });

      return interaction.reply({
        content: '✅ Wyniki Play-In zapisane.',
        ephemeral: true,
      });
    } catch (err) {
      logger.error('playin', 'Error saving Play-In results', {
        guildId,
        adminId,
        message: err.message,
        sql: err.sql,
      });

      return interaction.reply({
        content: '❌ Błąd zapisu wyników Play-In.',
        ephemeral: true,
      });
    }
  }
};
