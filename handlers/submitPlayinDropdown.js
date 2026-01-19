// handlers/submitPlayinDropdown.js
const pool = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

const cache = new Map(); // key: `${guildId}:${userId}` -> values[]

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId || 'noguild';
  const key = `${guildId}:${userId}`;

  // ================================
  // 1) SELECT MENU (wybór drużyn)
  // ================================
  if (interaction.isStringSelectMenu()) {
    cache.set(key, values);

    logger.info(
      `[Play-in] ${username} (${userId}) [${guildId}] wybrał ${values.length}: ${values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // ================================
  // 2) BUTTON: zatwierdzanie
  // ================================
  if (interaction.isButton() && customId.startsWith('confirm_playin')) {
    // P0 — czas typowania
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYIN' });
    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
    }

    const pickedTeams = cache.get(key);

    if (!pickedTeams || pickedTeams.length === 0) {
      return interaction.reply({
        content: '❌ Wybierz drużyny przed zatwierdzeniem.',
        ephemeral: true
      });
    }

    if (pickedTeams.length !== 8) {
      return interaction.reply({
        content: `⚠️ Nieprawidłowa liczba drużyn: ${pickedTeams.length}/8.`,
        ephemeral: true
      });
    }

    if (new Set(pickedTeams).size !== pickedTeams.length) {
      return interaction.reply({
        content: '⚠️ Drużyny nie mogą się powtarzać.',
        ephemeral: true
      });
    }

    // WALIDACJA DRUŻYN Z BAZY
    const [dbTeams] = await pool.query(
      `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
      [guildId]
    );

    const allowedTeams = dbTeams.map(t => t.name);
    const invalid = pickedTeams.filter(t => !allowedTeams.includes(t));

    if (invalid.length) {
      return interaction.reply({
        content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}`,
        ephemeral: true
      });
    }

    // ZAPIS DO BAZY
    try {
      const [result] = await pool.query(
        `INSERT INTO playin_predictions (user_id, username, displayname, teams)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           teams = VALUES(teams),
           displayname = VALUES(displayname)`,
        [userId, username, displayName, pickedTeams.join(', ')]
      );

      cache.delete(key);

      logger.info(
        `[Play-in] saved ${username} (${userId}) [${guildId}] rows=${result.affectedRows}`
      );

      return interaction.reply({
        content: '✅ Twoje typy zostały zapisane!',
        ephemeral: true
      });
    } catch (error) {
      logger.error(
        `[Play-in] DB error ${username} (${userId}) [${guildId}]`,
        error
      );

      return interaction.reply({
        content: '❌ Błąd zapisu typów.',
        ephemeral: true
      });
    }
  }
};
