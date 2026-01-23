// handlers/submitPlayoffsDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const sendPredictionEmbed = require('../utils/sendPredictionEmbeds');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

const CACHE_TTL = 15 * 60 * 1000; // 15 min

function getCache(client, guildId, userId) {
  const g = client._playoffsCache?.[guildId]?.[userId];
  if (!g) return null;
  if (Date.now() - g.ts > CACHE_TTL) {
    delete client._playoffsCache[guildId][userId];
    return null;
  }
  return g.data;
}

function setCache(client, guildId, userId, data) {
  if (!client._playoffsCache) client._playoffsCache = {};
  if (!client._playoffsCache[guildId]) client._playoffsCache[guildId] = {};
  client._playoffsCache[guildId][userId] = {
    ts: Date.now(),
    data
  };
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { user, customId } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId;

  if (!guildId) return;

  let cache = getCache(interaction.client, guildId, userId) || {};

  /* ===============================
     SELECT MENUS
     =============================== */
  if (interaction.isStringSelectMenu()) {
    if (!customId.startsWith('playoffs_')) return;

    const values = Array.isArray(interaction.values)
      ? interaction.values.map(String)
      : [];

    let type = customId.slice('playoffs_'.length);
    if (type === 'third_place') type = 'third';

    cache[type] = values;

    setCache(interaction.client, guildId, userId, cache);

    logger.debug('submit', 'Playoffs dropdown updated', {
      guildId,
      userId,
      type,
      values
    });

    await interaction.deferUpdate().catch(() => {});
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || customId !== 'confirm_playoffs') return;

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db, guildId) => {
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYOFFS' });
    if (!gate.allowed) {
      return interaction.editReply(gate.message || '❌ Typowanie zamknięte.');
    }

    const picks = getCache(interaction.client, guildId, userId) || {};
    const thirdPick = picks.third || [];

    /* ===============================
       WALIDACJA KOMPLETNOŚCI
       =============================== */
    if (
      !Array.isArray(picks.semifinalists) ||
      !Array.isArray(picks.finalists) ||
      !Array.isArray(picks.winner)
    ) {
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
        '⚠️ Nieprawidłowa liczba drużyn w jednym z etapów.'
      );
    }

    /* ===============================
       WALIDACJA LOGIKI DRABINKI
       =============================== */
    const winner = picks.winner[0];

    if (!picks.finalists.includes(winner)) {
      return interaction.editReply(
        '⚠️ Zwycięzca musi być jednym z finalistów.'
      );
    }

    for (const f of picks.finalists) {
      if (!picks.semifinalists.includes(f)) {
        return interaction.editReply(
          '⚠️ Finaliści muszą pochodzić z półfinalistów.'
        );
      }
    }

    if (thirdPick[0] && [winner, ...picks.finalists].includes(thirdPick[0])) {
      return interaction.editReply(
        '⚠️ 3. miejsce nie może być finalistą ani zwycięzcą.'
      );
    }

    /* ===============================
       WALIDACJA DRUŻYN Z DB
       =============================== */
    const [rows] = await safeQuery(
      db,
      `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
      [guildId],
      { guildId, scope: 'submitPlayoffs', label: 'load teams' }
    );

    const allowed = new Set(rows.map(r => r.name));
    const all = [
      ...picks.semifinalists,
      ...picks.finalists,
      winner,
      ...(thirdPick[0] ? [thirdPick[0]] : [])
    ];

    const invalid = all.filter(t => !allowed.has(t));
    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
      );
    }

    /* ===============================
       ZAPIS DO DB
       =============================== */
    await safeQuery(
      db,
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
        active = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        picks.semifinalists.join(', '),
        picks.finalists.join(', '),
        winner,
        thirdPick[0] || null
      ],
      { guildId, scope: 'submitPlayoffs', label: 'upsert playoffs_predictions' }
    );

    delete interaction.client._playoffsCache[guildId][userId];

    logger.info('submit', 'Playoffs predictions saved', { guildId, userId });

    await sendPredictionEmbed(interaction.client, guildId, 'playoffs', userId, {
      semifinalists: picks.semifinalists,
      finalists: picks.finalists,
      winner,
      third_place_winner: thirdPick[0] || null
    });

    return interaction.editReply(
      '✅ Twoje typy Playoffs zostały zapisane!'
    );
  });
};
