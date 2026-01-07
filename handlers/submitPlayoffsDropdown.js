const pool = require('../db');
const sendPredictionEmbed = require('../utils/sendPredictionEmbeds');
const logger = require('../logger');
const teams = require('../teams.json');

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  const userId = user.id;
  const guildId = interaction.guildId || 'dm';
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  // cache per guild + user (żeby nie mieszało na wielu serwerach)
  if (!interaction.client._playoffsCache) interaction.client._playoffsCache = {};
  if (!interaction.client._playoffsCache[guildId]) interaction.client._playoffsCache[guildId] = {};
  if (!interaction.client._playoffsCache[guildId][userId]) interaction.client._playoffsCache[guildId][userId] = {};

  // === Dropdowny ===
  if (interaction.isStringSelectMenu()) {
    if (!customId.startsWith('playoffs_')) return;

    // zamiast split('_') bierzemy całe "co po playoffs_"
    let type = customId.slice('playoffs_'.length); // np. semifinalists / finalists / winner / third / third_place_winner

    // alias: jeśli gdzieś masz w customId "third_place_winner", mapujemy na "third"
    if (type === 'third_place_winner') type = 'third';

    logger.info(
      `[Playoffs] ${username} (${userId}) [${guildId}] wybrał ${values.length} drużyn dla ${type}: ${values.join(', ')}`
    );

    interaction.client._playoffsCache[guildId][userId][type] = values;

    await interaction.deferUpdate();
    return;
  }

  // === Zatwierdzenie ===
  if (interaction.isButton() && customId === 'confirm_playoffs') {
    await interaction.deferUpdate();

    const picks = interaction.client._playoffsCache[guildId]?.[userId] || {};

    // spójne pole dla 3. miejsca (może być third albo third_place_winner)
    const thirdPick = picks.third || picks.third_place_winner || [];

    logger.info(`[Playoffs] ${username} (${userId}) [${guildId}] zatwierdza typy`);
    logger.info(`- Półfinaliści: ${picks.semifinalists?.join(', ') || 'brak'}`);
    logger.info(`- Finaliści: ${picks.finalists?.join(', ') || 'brak'}`);
    logger.info(`- Zwycięzca: ${picks.winner?.[0] || 'brak'}`);
    logger.info(`- 3. miejsce: ${thirdPick?.[0] || 'brak'}`);

    if (!picks?.semifinalists || !picks?.finalists || !picks?.winner) {
      return interaction.followUp({
        content: '❌ Wybierz wszystkie pozycje przed zatwierdzeniem (półfinaliści, finaliści, zwycięzca).',
        ephemeral: true,
      });
    }

    // Walidacja liczby drużyn
    if (
      picks.semifinalists.length !== 4 ||
      picks.finalists.length !== 2 ||
      picks.winner.length !== 1 ||
      (thirdPick && thirdPick.length > 1)
    ) {
      return interaction.followUp({
        content:
          `⚠️ Nieprawidłowa liczba drużyn:\n` +
          `• półfinaliści (${picks.semifinalists.length}/4)\n` +
          `• finaliści (${picks.finalists.length}/2)\n` +
          `• zwycięzca (${picks.winner.length}/1)`,
        ephemeral: true,
      });
    }

    // Unikalność w półfinalistach
    const semifinalistsSet = new Set(picks.semifinalists);
    if (semifinalistsSet.size !== picks.semifinalists.length) {
      return interaction.followUp({
        content: '⚠️ Te same drużyny nie mogą być wybrane więcej niż raz w półfinalistach.',
        ephemeral: true,
      });
    }

    // Walidacja względem teams.json
    const allSelectedTeams = [...picks.semifinalists, ...picks.finalists, picks.winner[0]];
    if (thirdPick?.[0]) allSelectedTeams.push(thirdPick[0]);

    const invalidTeams = allSelectedTeams.filter((t) => !teams.includes(t));
    if (invalidTeams.length > 0) {
      return interaction.followUp({
        content: `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}. Sprawdź poprawność nazw.`,
        ephemeral: true,
      });
    }

    try {
      // Dezaktywuj stare typy
      await pool.query(`UPDATE playoffs_predictions SET active = 0 WHERE user_id = ?`, [userId]);

      // Zapisz nowe typy z active = 1
      const [result] = await pool.query(
        `
          INSERT INTO playoffs_predictions (user_id, username, displayname, semifinalists, finalists, winner, third_place_winner, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE
            semifinalists = VALUES(semifinalists),
            finalists = VALUES(finalists),
            winner = VALUES(winner),
            third_place_winner = VALUES(third_place_winner),
            displayname = VALUES(displayname),
            active = VALUES(active)
        `,
        [
          userId,
          username,
          displayName,
          picks.semifinalists.join(', '),
          picks.finalists.join(', '),
          picks.winner[0],
          thirdPick?.[0] || null,
        ]
      );

      // Czyszczenie cache po zapisie (per guild + user)
      delete interaction.client._playoffsCache[guildId][userId];
      if (Object.keys(interaction.client._playoffsCache[guildId]).length === 0) {
        delete interaction.client._playoffsCache[guildId];
      }

      logger.info(`[Playoffs] ${username} (${userId}) [${guildId}] zapisał typy:`);
      logger.info(`- Półfinaliści: ${picks.semifinalists.join(', ')}`);
      logger.info(`- Finaliści: ${picks.finalists.join(', ')}`);
      logger.info(`- Zwycięzca: ${picks.winner[0]}`);
      if (thirdPick?.[0]) logger.info(`- 3. miejsce: ${thirdPick[0]}`);
      logger.info(`- Wynik zapytania: ${result.affectedRows} wierszy zmodyfikowano`);

      // Wyślij embed z typami na kanał
      await sendPredictionEmbed(interaction.client, guildId, 'playoffs', userId, {
        semifinalists: picks.semifinalists,
        finalists: picks.finalists,
        winner: picks.winner[0],
        third_place_winner: thirdPick?.[0] || null,
      });


      await interaction.followUp({ content: '✅ Twoje typy zostały zapisane!', ephemeral: true });
    } catch (error) {
      logger.error(`[Playoffs] Błąd przy zapisie typów dla ${username} (${userId}) [${guildId}]:`, error);
      await interaction.followUp({
        content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.',
        ephemeral: true,
      });
    }
  }
};
