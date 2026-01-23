// handlers/submitPlayoffsDropdown.js
const db = require('../db');
const logger = require('../logger');
const sendPredictionEmbed = require('../utils/sendPredictionEmbeds');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const userId = user.id;
  const guildId = interaction.guildId;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  // ===============================
  // CACHE per GUILD + USER
  // ===============================
  if (!interaction.client._playoffsCache) interaction.client._playoffsCache = {};
  if (!interaction.client._playoffsCache[guildId]) interaction.client._playoffsCache[guildId] = {};
  if (!interaction.client._playoffsCache[guildId][userId]) {
    interaction.client._playoffsCache[guildId][userId] = {};
  }

  const cache = interaction.client._playoffsCache[guildId][userId];

  // ===============================
  // SELECT MENUS
  // ===============================
  if (interaction.isStringSelectMenu()) {
    if (!customId.startsWith('playoffs_')) return;

    let type = customId.slice('playoffs_'.length);
    if (type === 'third_place_winner') type = 'third';

    cache[type] = values;

    logger.info(
      `[Playoffs] ${username} (${userId}) [${guildId}] selected ${type}: ${values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // ===============================
  // CONFIRM BUTTON
  // ===============================
  if (interaction.isButton() && customId === 'confirm_playoffs') {
    await interaction.deferUpdate();

    // 🔒 Gate
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYOFFS' });
    if (!gate.allowed) {
      return interaction.followUp({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
    }

    const picks = cache || {};
    const thirdPick = picks.third || [];

    // === Walidacja kompletności ===
    if (!picks.semifinalists || !picks.finalists || !picks.winner) {
      return interaction.followUp({
        content: '❌ Wybierz półfinalistów, finalistów oraz zwycięzcę.',
        ephemeral: true
      });
    }

    if (
      picks.semifinalists.length !== 4 ||
      picks.finalists.length !== 2 ||
      picks.winner.length !== 1 ||
      (thirdPick.length > 1)
    ) {
      return interaction.followUp({
        content:
          `⚠️ Nieprawidłowa liczba drużyn:\n` +
          `• półfinaliści (${picks.semifinalists.length}/4)\n` +
          `• finaliści (${picks.finalists.length}/2)\n` +
          `• zwycięzca (${picks.winner.length}/1)`,
        ephemeral: true
      });
    }

    // === Walidacja unikalności ===
    const allSelected = [
      ...picks.semifinalists,
      ...picks.finalists,
      picks.winner[0],
      ...(thirdPick[0] ? [thirdPick[0]] : [])
    ];

    if (new Set(allSelected).size !== allSelected.length) {
      return interaction.followUp({
        content: '⚠️ Ta sama drużyna nie może wystąpić więcej niż raz.',
        ephemeral: true
      });
    }

    // ===============================
    // DB
    // ===============================
    const pool = db.getPoolForGuild(guildId);

    // Walidacja drużyn z DB (PER GUILD)
    const [rows] = await pool.query(
      `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
      [guildId]
    );
    const allowedTeams = rows.map(r => r.name);

    const invalid = allSelected.filter(t => !allowedTeams.includes(t));
    if (invalid.length) {
      return interaction.followUp({
        content: `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`,
        ephemeral: true
      });
    }

    try {
      // Dezaktywuj stare typy TYLKO DLA TEGO GUILD
      await pool.query(
        `UPDATE playoffs_predictions
         SET active = 0
         WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
      );

      // Upsert
      await pool.query(
        `
        INSERT INTO playoffs_predictions
          (guild_id, user_id, username, displayname,
           semifinalists, finalists, winner, third_place_winner, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          semifinalists = VALUES(semifinalists),
          finalists = VALUES(finalists),
          winner = VALUES(winner),
          third_place_winner = VALUES(third_place_winner),
          displayname = VALUES(displayname),
          active = 1
        `,
        [
          guildId,
          userId,
          username,
          displayName,
          picks.semifinalists.join(', '),
          picks.finalists.join(', '),
          picks.winner[0],
          thirdPick[0] || null
        ]
      );

      // cleanup cache
      delete interaction.client._playoffsCache[guildId][userId];
      if (!Object.keys(interaction.client._playoffsCache[guildId]).length) {
        delete interaction.client._playoffsCache[guildId];
      }

      logger.info(
        `[Playoffs] ${username} (${userId}) [${guildId}] saved predictions`
      );

      // embed podsumowujący
      await sendPredictionEmbed(interaction.client, guildId, 'playoffs', userId, {
        semifinalists: picks.semifinalists,
        finalists: picks.finalists,
        winner: picks.winner[0],
        third_place_winner: thirdPick[0] || null
      });

      return interaction.followUp({
        content: '✅ Twoje typy Playoffs zostały zapisane!',
        ephemeral: true
      });
    } catch (err) {
      logger.error(
        `[Playoffs] DB error ${username} (${userId}) [${guildId}]`,
        err
      );
      return interaction.followUp({
        content: '❌ Wystąpił błąd podczas zapisu typów.',
        ephemeral: true
      });
    }
  }
};
