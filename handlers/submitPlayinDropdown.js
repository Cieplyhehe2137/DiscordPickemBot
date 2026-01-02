// handlers/submitPlayinDropdown.js
const pool = require('../db');
const logger = require('../logger');
const teamsList = require('../teams.json');

const cache = new Map(); // key: `${guildId}:${userId}` -> values[]

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId || 'noguild';
  const key = `${guildId}:${userId}`;

  if (interaction.isStringSelectMenu()) {
    cache.set(key, values);

    logger.info(`[Play-in] ${username} (${userId}) [${guildId}] wybrał ${values.length}: ${values.join(', ')}`);

    await interaction.deferUpdate();
    return;
  }

  if (interaction.isButton() && customId === 'confirm_playin') {
    const pickedTeams = cache.get(key);

    if (!pickedTeams || pickedTeams.length === 0) {
      return interaction.reply({ content: '❌ Wybierz drużyny przed zatwierdzeniem.', ephemeral: true });
    }

    // 8 drużyn awansuje
    if (pickedTeams.length !== 8) {
      return interaction.reply({
        content: `⚠️ Nieprawidłowa liczba drużyn: ${pickedTeams.length}/8.`,
        ephemeral: true
      });
    }

    // unikalność
    if (new Set(pickedTeams).size !== pickedTeams.length) {
      return interaction.reply({ content: '⚠️ Drużyny nie mogą się powtarzać.', ephemeral: true });
    }

    // walidacja z teams.json
    const invalid = pickedTeams.filter(t => !teamsList.includes(t));
    if (invalid.length) {
      return interaction.reply({
        content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}`,
        ephemeral: true
      });
    }

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

      logger.info(`[Play-in] saved ${username} (${userId}) [${guildId}] rows=${result.affectedRows}`);

      return interaction.reply({ content: '✅ Twoje typy zostały zapisane!', ephemeral: true });
    } catch (error) {
      logger.error(`[Play-in] DB error ${username} (${userId}) [${guildId}]`, error);
      return interaction.reply({ content: '❌ Błąd zapisu typów.', ephemeral: true });
    }
  }
};
