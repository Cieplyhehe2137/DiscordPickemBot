// handlers/submitPlayinDropdown.js
const db = require('../db');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache: `${guildId}:${userId}` -> [teams]
const cache = new Map();

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const cacheKey = `${guildId}:${userId}`;

  // ===============================
  // SELECT MENU – wybór drużyn
  // ===============================
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {
    cache.set(cacheKey, interaction.values.map(String));

    logger.info('playin', 'User selected play-in teams', {
      guildId,
      userId,
      count: interaction.values.length,
      teams: interaction.values,
    });

    try { await interaction.deferUpdate(); } catch (_) {}
    return;
  }

  // ===============================
  // BUTTON – zatwierdzenie
  // ===============================
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'PLAYIN',
    });

    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true,
      });
    }

    const picked = cache.get(cacheKey);

    if (!Array.isArray(picked) || picked.length !== 8) {
      return interaction.reply({
        content: '❌ Musisz wybrać **dokładnie 8 drużyn**.',
        ephemeral: true,
      });
    }

    if (new Set(picked).size !== 8) {
      return interaction.reply({
        content: '❌ Drużyny nie mogą się powtarzać.',
        ephemeral: true,
      });
    }

    const pool = db.getPoolForGuild(guildId);

    try {
      // 🔎 Walidacja względem aktywnych drużyn w DB
      const [rows] = await pool.query(
        `SELECT name
         FROM teams
         WHERE guild_id = ?
           AND active = 1`,
        [guildId]
      );

      const allowed = new Set(rows.map(r => String(r.name)));
      const invalid = picked.filter(t => !allowed.has(t));

      if (invalid.length) {
        return interaction.reply({
          content: `❌ Nieznane lub nieaktywne drużyny: **${invalid.join(', ')}**`,
          ephemeral: true,
        });
      }

      // ✅ ZAPIS DO DB (JEDNA BAZA → guild_id OBOWIĄZKOWE)
      await pool.query(
        `INSERT INTO playin_predictions
         (guild_id, user_id, username, displayname, teams, active, submitted_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           teams = VALUES(teams),
           displayname = VALUES(displayname),
           active = 1,
           submitted_at = NOW()`,
        [
          guildId,
          userId,
          username,
          displayName,
          picked.join(', ')
        ]
      );

      cache.delete(cacheKey);

      logger.info('playin', 'Saved play-in picks', {
        guildId,
        userId,
        teams: picked,
      });

      return interaction.reply({
        content: '✅ Twoje typy Play-In zostały zapisane!',
        ephemeral: true,
      });
    } catch (err) {
      logger.error('playin', 'DB error while saving play-in picks', {
        guildId,
        userId,
        code: err.code,
        message: err.message,
        sql: err.sql,
      });

      return interaction.reply({
        content: '❌ Błąd zapisu typów do bazy.',
        ephemeral: true,
      });
    }
  }
};
