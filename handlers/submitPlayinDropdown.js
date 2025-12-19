const pool = require('../db');
const logger = require('../logger');
const teams = require('../teams.json');
const cache = new Map();

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  if (interaction.isStringSelectMenu()) {
    cache.set(userId, values);
    
    // Logowanie wyborów użytkownika
    logger.info(`[Play-in] ${username} (${userId}) wybrał ${values.length} drużyn: ${values.join(', ')}`);
    
    await interaction.deferUpdate();
    return;
  }

  if (interaction.isButton() && customId === 'confirm_playin') {
    const teams = cache.get(userId);
    if (!teams || teams.length === 0) {
      return interaction.reply({
        content: '❌ Wybierz drużyny przed zatwierdzeniem.',
        ephemeral: true,
      });
    }
    
    // Sprawdzenie czy wszystkie wybrane drużyny są w teams.json
    const invalidTeams = teams.filter(team => !teams.includes(team));
    if (invalidTeams.length > 0) {
      return interaction.reply({
        content: `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}. Sprawdź poprawność nazw.`,
        ephemeral: true
      });
    }
    
    // Sprawdzenie czy liczba drużyn jest poprawna (8 drużyn awansuje z Play-in)
    if (teams.length !== 8) {
      return interaction.reply({
        content: `⚠️ Nieprawidłowa liczba drużyn: wybrałeś ${teams.length}/8 drużyn.`,
        ephemeral: true
      });
    }

    try {
      const [result] = await pool.query(`
        INSERT INTO playin_predictions (user_id, username, displayname, teams)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          teams = VALUES(teams),
          displayname = VALUES(displayname)
      `, [userId, username, displayName, teams.join(', ')]);
      
      // Czyszczenie cache po zapisie
      cache.delete(userId);
      
      // Szczegółowe logowanie zapisanych typów
      logger.info(`[Play-in] ${username} (${userId}) zapisał typy:`);
      logger.info(`- Wybrane drużyny: ${teams.join(', ')}`);
      logger.info(`- Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);

      await interaction.reply({ content: '✅ Twoje typy zostały zapisane!', ephemeral: true });
    } catch (error) {
      logger.error(`[Play-in] Błąd przy zapisie typów dla ${username} (${userId}):`, error);
      await interaction.reply({ content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.', ephemeral: true });
    }
  }
};
