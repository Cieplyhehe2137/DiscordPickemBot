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

  // 🔽 Obsługa dropdownów
  if (interaction.isStringSelectMenu()) {
    const [phase, type] = customId.split('_'); // np. "playoffs_semifinalists"
    if (phase !== 'playoffs') return;

    logger.info(
      `[Playoffs] ${username} (${userId}) wybrał ${values.length} drużyn dla ${type}: ${values.join(', ')}`
    );

    interaction.client._playoffsCache[userId][type] = values;

    await interaction.deferUpdate();
    return;
  }

  // ✅ Obsługa przycisku "Zatwierdź"
  if (interaction.isButton() && customId === 'confirm_playoffs') {
    await interaction.deferUpdate();

    const picks = interaction.client._playoffsCache[userId] || {};

    logger.info(`[Playoffs] ${username} (${userId}) zatwierdza typy`);
    logger.info(`- Półfinaliści: ${picks.semifinalists?.join(', ') || 'brak'}`);
    logger.info(`- Finaliści: ${picks.finalists?.join(', ') || 'brak'}`);
    logger.info(`- Zwycięzca: ${picks.winner?.[0] || 'brak'}`);
    logger.info(`- 3. miejsce: ${picks.third?.[0] || 'brak'}`);

    if (!picks.semifinalists || !picks.finalists || !picks.winner) {
      return await interaction.followUp({
        content: '❌ Wybierz wszystkie pozycje przed zatwierdzeniem (półfinaliści, finaliści, zwycięzca).',
        ephemeral: true
      });
    }

    // Walidacja liczby drużyn
    if (
      picks.semifinalists.length !== 4 ||
      picks.finalists.length !== 2 ||
      picks.winner.length !== 1 ||
      (picks.third && picks.third.length > 1)
    ) {
      return await interaction.followUp({
        content:
          `⚠️ Nieprawidłowa liczba drużyn:\n` +
          `• półfinaliści: ${picks.semifinalists.length}/4\n` +
          `• finaliści: ${picks.finalists.length}/2\n` +
          `• zwycięzca: ${picks.winner.length}/1` +
          (picks.third ? `\n• 3. miejsce: ${picks.third.length}/max 1` : ''),
        ephemeral: true
      });
    }

    // Półfinaliści muszą być unikalni
    const semifinalistsSet = new Set(picks.semifinalists);
    if (semifinalistsSet.size !== picks.semifinalists.length) {
      return await interaction.followUp({
        content: '⚠️ Te same drużyny nie mogą pojawiać się więcej niż raz w liście półfinalistów.',
        ephemeral: true
      });
    }

    // Finaliści muszą być unikalni
    if (new Set(picks.finalists).size !== picks.finalists.length) {
      return await interaction.followUp({
        content: '⚠️ Finaliści muszą być dwoma różnymi drużynami.',
        ephemeral: true
      });
    }

    const winner = picks.winner[0];
    const third = picks.third?.[0] || null;

    // Finaliści muszą być wśród półfinalistów
    const missingFromSemis = picks.finalists.filter(f => !semifinalistsSet.has(f));
    if (missingFromSemis.length > 0) {
      return await interaction.followUp({
        content: `⚠️ Wszyscy finaliści muszą być wśród półfinalistów. Poza półfinałami: ${missingFromSemis.join(', ')}`,
        ephemeral: true
      });
    }

    // Zwycięzca musi być jednym z finalistów
    if (!picks.finalists.includes(winner)) {
      return await interaction.followUp({
        content: `⚠️ Zwycięzca (${winner}) musi być jedną z drużyn finału.`,
        ephemeral: true
      });
    }

    // 3. miejsce (jeśli wybrane) musi być półfinalistą i inną drużyną niż zwycięzca
    if (third) {
      if (!semifinalistsSet.has(third)) {
        return await interaction.followUp({
          content: `⚠️ Drużyna z 3. miejsca (${third}) musi być wśród półfinalistów.`,
          ephemeral: true
        });
      }
      if (third === winner) {
        return await interaction.followUp({
          content: '⚠️ Drużyna z 3. miejsca nie może być jednocześnie zwycięzcą turnieju.',
          ephemeral: true
        });
      }
    }

    // Sprawdzenie czy wszystkie wybrane drużyny istnieją w teams.json
    const allSelectedTeams = [
      ...picks.semifinalists,
      ...picks.finalists,
      winner,
      ...(third ? [third] : [])
    ];

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

      // Zapisz nowe typy
      const [result] = await pool.query(
        `INSERT INTO playoffs_predictions
           (user_id, username, displayname, semifinalists, finalists, winner, third_place_winner, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           semifinalists       = VALUES(semifinalists),
           finalists           = VALUES(finalists),
           winner              = VALUES(winner),
           third_place_winner  = VALUES(third_place_winner),
           displayname         = VALUES(displayname),
           active              = VALUES(active)`,
        [
          userId,
          username,
          displayName,
          picks.semifinalists.join(', '),
          picks.finalists.join(', '),
          winner,
          third
        ]
      );

      delete interaction.client._playoffsCache[userId];

      logger.info(`[Playoffs] ${username} (${userId}) zapisał typy:`);
      logger.info(`- Półfinaliści: ${picks.semifinalists.join(', ')}`);
      logger.info(`- Finaliści: ${picks.finalists.join(', ')}`);
      logger.info(`- Zwycięzca: ${winner}`);
      if (third) logger.info(`- 3. miejsce: ${third}`);
      logger.info(`- Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);

      await sendPredictionEmbed(interaction.client, 'playoffs', userId, {
        semifinalists: picks.semifinalists,
        finalists: picks.finalists,
        winner,
        third_place_winner: third
      });

      await interaction.followUp({
        content: '✅ Twoje typy zostały zapisane!',
        ephemeral: true
      });
    } catch (error) {
      logger.error(
        `[Playoffs] Błąd przy zapisie typów dla ${username} (${userId}):`,
        error
      );
      await interaction.followUp({
        content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.',
        ephemeral: true
      });
    }
  }
};
