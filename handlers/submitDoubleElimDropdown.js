// handlers/submitDoubleElimDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

const uniq = (arr) => Array.from(new Set(arr));

// cache: `${guildId}:${userId}` -> { data, ts }
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

function slotLabel(k) {
  return {
    upper_final_a: 'Upper Final A',
    lower_final_a: 'Lower Final A',
    upper_final_b: 'Upper Final B',
    lower_final_b: 'Lower Final B',
  }[k] || k;
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  const { user, customId } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  const cacheKey = `${guildId}:${userId}`;

  const selectMap = {
    doubleelim_upper_final_a: 'upper_final_a',
    doubleelim_lower_final_a: 'lower_final_a',
    doubleelim_upper_final_b: 'upper_final_b',
    doubleelim_lower_final_b: 'lower_final_b',
  };

  /* ===============================
     SELECT MENUS
     =============================== */
  if (interaction.isStringSelectMenu()) {
    if (!selectMap[customId]) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }
      return;
    }

    const key = selectMap[customId];
    const values = uniq((interaction.values || []).map(String));

    if (values.length !== 2) {
      return interaction.reply({
        content: '⚠️ Wybierz dokładnie **2** drużyny.',
        ephemeral: true
      });
    }

    const data = getCache(cacheKey) || {};
    data[key] = values.slice(0, 2);
    setCache(cacheKey, data);

    logger.debug('submit', 'Double Elim dropdown updated', {
      guildId,
      userId,
      key,
      values: data[key]
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || customId !== 'confirm_doubleelim') return;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  await withGuild(interaction, async (db) => {
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'DOUBLE_ELIM'
    });

    if (!gate.allowed) {
      return interaction.editReply(
        gate.message || '❌ Typowanie jest aktualnie zamknięte.'
      );
    }

    const picks = getCache(cacheKey) || {};
    const required = [
      'upper_final_a',
      'lower_final_a',
      'upper_final_b',
      'lower_final_b'
    ];

    const missing = required.filter(
      k => !Array.isArray(picks[k]) || picks[k].length !== 2
    );

    if (missing.length) {
      return interaction.editReply(
        `❌ Brakuje wyborów w: **${missing.map(slotLabel).join(', ')}**.`
      );
    }

    const all = required.flatMap(k => picks[k]);

    if (new Set(all).size !== all.length) {
      return interaction.editReply(
        '⚠️ Te same drużyny nie mogą się powtarzać między slotami.'
      );
    }

    const [rows] = await safeQuery(
      db,
      `
      SELECT name
      FROM teams
      WHERE guild_id = ?
        AND active = 1
      `,
      [guildId],
      { guildId, scope: 'submitDoubleElim', label: 'load teams' }
    );

    const allowed = rows.map(r => r.name);
    const invalid = all.filter(t => !allowed.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieaktywne lub nieznane drużyny: ${invalid.join(', ')}.`
      );
    }

    await safeQuery(
      db,
      `
      INSERT INTO doubleelim_predictions
        (guild_id, user_id, username, displayname,
         upper_final_a, lower_final_a, upper_final_b, lower_final_b)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        upper_final_a = VALUES(upper_final_a),
        lower_final_a = VALUES(lower_final_a),
        upper_final_b = VALUES(upper_final_b),
        lower_final_b = VALUES(lower_final_b),
        displayname   = VALUES(displayname),
        submitted_at  = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        picks.upper_final_a.join(', '),
        picks.lower_final_a.join(', '),
        picks.upper_final_b.join(', '),
        picks.lower_final_b.join(', ')
      ],
      { guildId, scope: 'submitDoubleElim', label: 'upsert doubleelim_predictions' }
    );

    cache.delete(cacheKey);

    logger.info('submit', 'Double Elim predictions saved', {
      guildId,
      userId
    });

    return interaction.editReply(
      '✅ Twoje typy Double Elimination zostały zapisane!'
    );
  });
};
