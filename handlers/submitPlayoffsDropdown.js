const pool = require('../db');
const sendPredictionEmbed = require('../utils/sendPredictionEmbeds');
const logger = require('../logger');
const teams = require('../teams.json');

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  if (!interaction.client._playoffsCache) interaction.client._playoffsCache = {};
  if (!interaction.client._playoffsCache[userId]) interaction.client._playoffsCache[userId] = {};

  // Obsługa dropdownów
  if (interaction.isStringSelectMenu()) {
    const [phase, type] = customId.split('_');
    if (phase !== 'playoffs') return;

    logger.info(`[Playoffs] ${username} (${userId}) wybrał ${values.length} drużyn dla ${type}: ${values.join(', ')}`);
    interaction.client._playoffsCache[userId][type] = values;

    await interaction.deferUpdate();
    return;
  }

  // Obsługa przycisku zatwierdzenia
  if (interaction.isButton() && customId === 'confirm_playoffs') {
    await interaction.deferUpdate();

    const picks = interaction.client._playoffsCache[userId];

    logger.info(`[Playoffs] ${username} (${userId}) zatwierdza typy`);
    logger.info(`- Półfinaliści: ${picks.semifinalists?.join(', ') || 'brak'}`);
    logger.info(`- Finaliści: ${picks.finalists?.join(', ') || 'brak'}`);
    logger.info(`- Zwycięzca: ${picks.winner?.[0] || 'brak'}`);
    logger.info(`- 3. miejsce: ${picks.third?.[0] || 'brak'}`);

    if (!picks?.semifinalists || !picks?.finalists || !picks?.winner) {
      return await interaction.followUp({
        content: '❌ Wybierz wszystkie pozycje przed zatwierdzeniem (półfinaliści, finaliści, zwycięzca).',
        ephemeral: true,
      });
    }
    
    // Walidacja liczby drużyn
    if (picks.semifinalists.length !== 4 || picks.finalists.length !== 2 || picks.winner.length !== 1 || 
        (picks.third && picks.third.length > 1)) {
      return await interaction.followUp({
        content: `⚠️ Nieprawidłowa liczba drużyn: półfinaliści (${picks.semifinalists.length}/4), finaliści (${picks.finalists.length}/2), zwycięzca (${picks.winner.length}/1)`,
        ephemeral: true
      });
    }
    
    // Walidacja unikalności drużyn w półfinalistach
    const semifinalistsSet = new Set(picks.semifinalists);
    if (semifinalistsSet.size !== picks.semifinalists.length) {
      return await interaction.followUp({
        content: '⚠️ Te same drużyny nie mogą być wybrane więcej niż raz w półfinalistach.',
        ephemeral: true
      });
    }
    
    // Sprawdzenie czy wszystkie wybrane drużyny są w teams.json
    const allSelectedTeams = [...picks.semifinalists, ...picks.finalists, picks.winner[0]];
    if (picks.third?.[0]) allSelectedTeams.push(picks.third[0]);
    
    const invalidTeams = allSelectedTeams.filter(team => !teams.includes(team));
    if (invalidTeams.length > 0) {
      return await interaction.followUp({
        content: `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}. Sprawdź poprawność nazw.`,
        ephemeral: true
      });
    }

    try {
      // Dezaktywuj stare typy
      await pool.query(`UPDATE playoffs_predictions SET active = 0 WHERE user_id = ?`, [userId]);

      // Zapisz nowe typy z active = 1
      const [result] = await pool.query(`
        INSERT INTO playoffs_predictions (user_id, username, displayname, semifinalists, finalists, winner, third_place_winner, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          semifinalists = VALUES(semifinalists),
          finalists = VALUES(finalists),
          winner = VALUES(winner),
          third_place_winner = VALUES(third_place_winner),
          displayname = VALUES(displayname),
          active = VALUES(active)
      `, [
        userId,
        username,
        displayName,
        picks.semifinalists.join(', '),
        picks.finalists.join(', '),
        picks.winner[0],
        picks.third?.[0] || null
      ]);
      
      // Czyszczenie cache po zapisie
      delete interaction.client._playoffsCache[userId];
      
      // Szczegółowe logowanie zapisanych typów
      logger.info(`[Playoffs] ${username} (${userId}) zapisał typy:`);
      logger.info(`- Półfinaliści: ${picks.semifinalists.join(', ')}`);
      logger.info(`- Finaliści: ${picks.finalists.join(', ')}`);
      logger.info(`- Zwycięzca: ${picks.winner[0]}`);
      if (picks.third?.[0]) {
        logger.info(`- 3. miejsce: ${picks.third[0]}`);
      }
      logger.info(`- Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);

    // Wyślij embed z typami na kanał
   await sendPredictionEmbed(interaction.client, 'playoffs', userId, {
  semifinalists: picks.semifinalists,
  finalists: picks.finalists,
  winner: picks.winner[0],
  third_place_winner: picks.third?.[0] || null
});

    await interaction.followUp({ content: '✅ Twoje typy zostały zapisane!', ephemeral: true });
    } catch (error) {
      logger.error(`[Playoffs] Błąd przy zapisie typów dla ${username} (${userId}):`, error);
      await interaction.followUp({ content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.', ephemeral: true });
    }
  }
};
