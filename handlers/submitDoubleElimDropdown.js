// handlers/submitDoubleElimDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// utils
const uniq = (arr) => Array.from(new Set(arr));

// cache: `${guildId}:${userId}`
// {
//   upper_final_a: [],
//   lower_final_a: [],
//   upper_final_b: [],
//   lower_final_b: []
// }
const cache = new Map();

/* ===============================
   HANDLER
   =============================== */
module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { user, customId } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId;

  const cacheKey = `${guildId}:${userId}`;

  // mapowanie selectów -> klucze cache
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
      await interaction.deferUpdate();
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

    if (!cache.has(cacheKey)) cache.set(cacheKey, {});
    const data = cache.get(cacheKey);

    data[key] = values.slice(0, 2);
    cache.set(cacheKey, data);

    logger.debug('submit', 'Double Elim dropdown updated', {
      guildId,
      userId,
      key,
      values: data[key]
    });

    await interaction.deferUpdate();
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || customId !== 'confirm_doubleelim') return;

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db, guildId) => {
    /* ===============================
       GATE
       =============================== */
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'DOUBLE_ELIM'
    });

    if (!gate.allowed) {
      return interaction.editReply(
        gate.message || '❌ Typowanie jest aktualnie zamknięte.'
      );
    }

    const picks = cache.get(cacheKey) || {};
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
        `❌ Brakuje pełnych wyborów (po 2 drużyny) w: ${missing.join(', ')}.`
      );
    }

    /* ===============================
       WALIDACJA UNIKALNOŚCI
       =============================== */
    const all = [
      ...picks.upper_final_a,
      ...picks.lower_final_a,
      ...picks.upper_final_b,
      ...picks.lower_final_b
    ];

    if (new Set(all).size !== all.length) {
      return interaction.editReply(
        '⚠️ Te same drużyny nie mogą się powtarzać między slotami.'
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
      { guildId, scope: 'submitDoubleElim', label: 'load teams' }
    );

    const allowed = rows.map(r => r.name);
    const invalid = all.filter(t => !allowed.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}.`
      );
    }

    /* ===============================
       ZAPIS DO DB (STRINGI)
       =============================== */
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
