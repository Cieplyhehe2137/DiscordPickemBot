const pool = require('../db');
const logger = require('../logger');
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

async function loadTeamsFromDB(guildId) {
  const [rows] = await pool.query(
    `SELECT name
     FROM teams
     WHERE guild_id = ?
       AND active = 1
     ORDER BY name ASC`,
    [guildId]
  );
  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { user, customId } = interaction;
  const userId = user.id;
  const guildId = interaction.guildId;
  const cacheKey = `${guildId}:${userId}`;

  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  // mapowanie selectów -> klucze cache
  const selectMap = {
    doubleelim_upper_final_a: 'upper_final_a',
    doubleelim_lower_final_a: 'lower_final_a',
    doubleelim_upper_final_b: 'upper_final_b',
    doubleelim_lower_final_b: 'lower_final_b',
  };

  // ===============================
  // SELECT – zbieranie wyborów
  // ===============================
  if (interaction.isStringSelectMenu()) {
    // ⬅️ JEŚLI TO NIE JEST NASZ SELECT – MUSIMY GO ZAMKNĄĆ
    if (!selectMap[customId]) {
      await interaction.deferUpdate();
      return;
    }

    const key = selectMap[customId];
    const values = (interaction.values || []).map(String);

    if (values.length !== 2) {
      await interaction.reply({
        content: '⚠️ Wybierz dokładnie **2** drużyny.',
        ephemeral: true
      });
      return;
    }

    if (!cache.has(cacheKey)) cache.set(cacheKey, {});
    const data = cache.get(cacheKey);

    data[key] = uniq(values).slice(0, 2);
    cache.set(cacheKey, data);

    logger.info(
      `[Double Elim] ${username} (${userId}) [${guildId}] wybrał ${key}: ${data[key].join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // ===============================
  // BUTTON – zatwierdzenie
  // ===============================
  if (interaction.isButton() && customId === 'confirm_doubleelim') {
    // gate (deadline / faza)
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'DOUBLE_ELIM'
    });

    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
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
      return interaction.reply({
        content: `❌ Brakuje pełnych wyborów (po 2 drużyny) w: ${missing.join(', ')}.`,
        ephemeral: true
      });
    }

    // globalna unikalność
    const all = [
      ...picks.upper_final_a,
      ...picks.lower_final_a,
      ...picks.upper_final_b,
      ...picks.lower_final_b
    ];

    if (new Set(all).size !== all.length) {
      return interaction.reply({
        content: '⚠️ Te same drużyny nie mogą się powtarzać między slotami.',
        ephemeral: true
      });
    }

    // walidacja względem DB
    const teams = await loadTeamsFromDB(guildId);
    const invalid = all.filter(t => !teams.includes(t));

    if (invalid.length) {
      return interaction.reply({
        content: `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}.`,
        ephemeral: true
      });
    }

    try {
      await pool.query(
        `INSERT INTO doubleelim_predictions
         (guild_id, user_id, username, displayname,
          upper_final_a, lower_final_a, upper_final_b, lower_final_b)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           upper_final_a = VALUES(upper_final_a),
           lower_final_a = VALUES(lower_final_a),
           upper_final_b = VALUES(upper_final_b),
           lower_final_b = VALUES(lower_final_b),
           displayname   = VALUES(displayname)`,
        [
          guildId,
          userId,
          username,
          displayName,
          picks.upper_final_a.join(', '),
          picks.lower_final_a.join(', '),
          picks.upper_final_b.join(', '),
          picks.lower_final_b.join(', ')
        ]
      );

      cache.delete(cacheKey);

      logger.info(
        `[Double Elim] Zapisano typy ${username} (${userId}) [${guildId}]`
      );

      return interaction.reply({
        content: '✅ Twoje typy Double Elimination zostały zapisane!',
        ephemeral: true
      });
    } catch (err) {
      logger.error(
        `[Double Elim] Błąd zapisu ${username} (${userId}) [${guildId}]`,
        err
      );
      return interaction.reply({
        content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.',
        ephemeral: true
      });
    }
  }
};
