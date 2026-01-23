// handlers/submitPlayoffsDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const sendPredictionEmbed = require('../utils/sendPredictionEmbeds');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { user, customId, values } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId;

  /* ===============================
     CACHE (per guild + user)
     =============================== */
  if (!interaction.client._playoffsCache) interaction.client._playoffsCache = {};
  if (!interaction.client._playoffsCache[guildId]) interaction.client._playoffsCache[guildId] = {};
  if (!interaction.client._playoffsCache[guildId][userId]) {
    interaction.client._playoffsCache[guildId][userId] = {};
  }

  const cache = interaction.client._playoffsCache[guildId][userId];

  /* ===============================
     SELECT MENUS
     =============================== */
  if (interaction.isStringSelectMenu()) {
    if (!customId.startsWith('playoffs_')) return;

    let type = customId.slice('playoffs_'.length);
    if (type === 'third_place_winner') type = 'third';

    cache[type] = values;

    logger.debug('submit', 'Playoffs dropdown updated', {
      guildId,
      userId,
      type,
      values
    });

    await interaction.deferUpdate();
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || customId !== 'confirm_playoffs') return;

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db, guildId) => {
    /* ===============================
       GATE
       =============================== */
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYOFFS' });
    if (!gate.allowed) {
      return interaction.editReply(
        gate.message || '❌ Typowanie jest aktualnie zamknięte.'
      );
    }

    const picks = cache || {};
    const thirdPick = picks.third || [];

    /* ===============================
       WALIDACJA KOMPLETNOŚCI
       =============================== */
    if (!picks.semifinalists || !picks.finalists || !picks.winner) {
      return interaction.editReply(
        '❌ Wybierz półfinalistów, finalistów oraz zwycięzcę.'
      );
    }

    if (
      picks.semifinalists.length !== 4 ||
      picks.finalists.length !== 2 ||
      picks.winner.length !== 1 ||
      thirdPick.length > 1
    ) {
      return interaction.editReply(
        `⚠️ Nieprawidłowa liczba drużyn:\n` +
        `• półfinaliści (${picks.semifinalists.length}/4)\n` +
        `• finaliści (${picks.finalists.length}/2)\n` +
        `• zwycięzca (${picks.winner.length}/1)`
      );
    }

    /* ===============================
       WALIDACJA UNIKALNOŚCI
       =============================== */
    const allSelected = [
      ...picks.semifinalists,
      ...picks.finalists,
      picks.winner[0],
      ...(thirdPick[0] ? [thirdPick[0]] : [])
    ];

    if (new Set(allSelected).size !== allSelected.length) {
      return interaction.editReply(
        '⚠️ Ta sama drużyna nie może wystąpić więcej niż raz.'
      );
    }

    /* ===============================
       WALIDACJA DRUŻYN Z DB
       =============================== */
    const [rows] = await safeQuery(
      db,
      `
      SELECT name
      FROM teams
      WHERE guild_id = ?
        AND active = 1
      `,
      [guildId],
      { guildId, scope: 'submitPlayoffs', label: 'load teams' }
    );

    const allowedTeams = rows.map(r => r.name);
    const invalid = allSelected.filter(t => !allowedTeams.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
      );
    }

    /* ===============================
       ZAPIS DO DB (STRINGI)
       =============================== */
    const semifinalistsStr = picks.semifinalists.join(', ');
    const finalistsStr = picks.finalists.join(', ');
    const winnerStr = picks.winner[0];
    const thirdStr = thirdPick[0] || null;

    await safeQuery(
      db,
      `
      INSERT INTO playoffs_predictions
        (guild_id, user_id, username, displayname,
         semifinalists, finalists, winner, third_place_winner, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        semifinalists      = VALUES(semifinalists),
        finalists          = VALUES(finalists),
        winner             = VALUES(winner),
        third_place_winner = VALUES(third_place_winner),
        displayname        = VALUES(displayname),
        active             = 1,
        submitted_at       = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        semifinalistsStr,
        finalistsStr,
        winnerStr,
        thirdStr
      ],
      { guildId, scope: 'submitPlayoffs', label: 'upsert playoffs_predictions' }
    );

    /* ===============================
       CLEANUP CACHE
       =============================== */
    delete interaction.client._playoffsCache[guildId][userId];
    if (!Object.keys(interaction.client._playoffsCache[guildId]).length) {
      delete interaction.client._playoffsCache[guildId];
    }

    logger.info('submit', 'Playoffs predictions saved', {
      guildId,
      userId
    });

    /* ===============================
       PODSUMOWANIE (EMBED)
       =============================== */
    await sendPredictionEmbed(interaction.client, guildId, 'playoffs', userId, {
      semifinalists: picks.semifinalists,
      finalists: picks.finalists,
      winner: winnerStr,
      third_place_winner: thirdStr
    });

    return interaction.editReply(
      '✅ Twoje typy Playoffs zostały zapisane!'
    );
  });
};
