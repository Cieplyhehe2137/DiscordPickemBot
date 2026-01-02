const pool = require('../db');
const logger = require('../logger');
const teamsList = require('../teams.json');

const cache = new Map();

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const guildId = interaction.guildId || 'dm';
  const key = `${guildId}:${userId}`;

  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  // === SELECT MENU: zapisz wybór w RAM ===
  if (interaction.isStringSelectMenu()) {
    cache.set(key, values);

    logger.info(
      `[Play-in] ${username} (${userId}) [${guildId}] wybrał ${values.length} drużyn: ${values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // === BUTTON: zatwierdzenie i zapis do DB ===
  if (interaction.isButton() && customId === 'confirm_playin') {
    const pickedTeams = cache.get(key);

    if (!pickedTeams || pickedTeams.length === 0) {
      return interaction.reply({
        content: '❌ Wybierz drużyny przed zatwierdzeniem.',
        ephemeral: true,
      });
    }

    // ✅ walidacja względem teams.json
    const invalidTeams = pickedTeams.filter((t) => !teamsList.includes(t));
    if (invalidTeams.length > 0) {
      return interaction.reply({
        content: `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}. Sprawdź poprawność nazw.`,
        ephemeral: true,
      });
    }

    // 8 drużyn awansuje z Play-in
    if (pickedTeams.length !== 8) {
      return interaction.reply({
        content: `⚠️ Nieprawidłowa liczba drużyn: wybrałeś ${pickedTeams.length}/8 drużyn.`,
        ephemeral: true,
      });
    }

    try {
      const [result] = await pool.query(
        `
          INSERT INTO playin_predictions (user_id, username, displayname, teams)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            teams = VALUES(teams),
            displayname = VALUES(displayname)
        `,
        [userId, username, displayName, pickedTeams.join(', ')]
      );

      // wyczyść cache po zapisie
      cache.delete(key);

      logger.info(`[Play-in] ${username} (${userId}) [${guildId}] zapisał typy: ${pickedTeams.join(', ')}`);
      logger.info(`[Play-in] Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);

      return interaction.reply({
        content: '✅ Twoje typy zostały zapisane!',
        ephemeral: true,
      });
    } catch (error) {
      logger.error(`[Play-in] Błąd przy zapisie typów dla ${username} (${userId}) [${guildId}]:`, error);
      return interaction.reply({
        content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.',
        ephemeral: true,
      });
    }
  }
};
