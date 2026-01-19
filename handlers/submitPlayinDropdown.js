// handlers/submitPlayinDropdown.js
const db = require('../db');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// Pamięć wyboru per (guild + user)
const cache = new Map(); // key: `${guildId}:${userId}` -> [teams]

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const key = `${guildId}:${userId}`;

  // ===== SELECT MENU =====
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {
    cache.set(key, interaction.values);

    logger.info('playin', 'User selected teams', {
      guildId,
      userId,
      count: interaction.values.length,
      teams: interaction.values,
    });

    // ACK bez spamu w czacie
    try { await interaction.deferUpdate(); } catch (_) {}
    return;
  }

  // ===== CONFIRM BUTTON =====
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYIN' });
    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true,
      });
    }

    const picked = cache.get(key);

    if (!picked || picked.length !== 8) {
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
      // Walidacja: czy user nie wybrał czegoś spoza aktywnych teamów w DB
      const [rows] = await pool.query(
        `SELECT name
         FROM teams
         WHERE guild_id = ?
           AND active = 1`,
        [guildId]
      );

      const allowed = new Set(rows.map(r => r.name));
      const invalid = picked.filter(t => !allowed.has(t));

      if (invalid.length) {
        return interaction.reply({
          content: `❌ Nieznane drużyny: **${invalid.join(', ')}**`,
          ephemeral: true,
        });
      }

      // Zapis (bez guild_id — bo masz osobną bazę per guild)
      await pool.query(
        `INSERT INTO playin_predictions (user_id, username, displayname, teams, active, submitted_at)
         VALUES (?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE
           teams = VALUES(teams),
           displayname = VALUES(displayname),
           active = 1,
           submitted_at = NOW()`,
        [userId, username, displayName, picked.join(', ')]
      );

      cache.delete(key);

      logger.info('playin', 'Saved play-in picks', { guildId, userId });

      return interaction.reply({
        content: '✅ Twoje typy zostały zapisane!',
        ephemeral: true,
      });
    } catch (err) {
      logger.error('playin', 'DB error while saving picks', {
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
