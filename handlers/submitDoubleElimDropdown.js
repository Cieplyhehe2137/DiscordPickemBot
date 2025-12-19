const path = require('path');
const fs = require('fs');
const pool = require('../db');
const logger = require('../logger');

function loadTeams() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e) {
    logger.warn('[Double Elim] Nie udało się wczytać teams.json', e);
    return [];
  }
}

function uniq(arr) { return Array.from(new Set(arr)); }

const cache = new Map(); // userId -> { upper_final_a:[], lower_final_a:[], upper_final_b:[], lower_final_b:[] }

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { user, customId } = interaction;
  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;

  const map = {
    doubleelim_upper_final_a: 'upper_final_a',
    doubleelim_lower_final_a: 'lower_final_a',
    doubleelim_upper_final_b: 'upper_final_b',
    doubleelim_lower_final_b: 'lower_final_b',
  };

  // Zbieranie wyborów (2 wartości)
  if (interaction.isStringSelectMenu() && map[customId]) {
    const key = map[customId];
    const values = (interaction.values || []).map(String);

    if (values.length !== 2) {
      await interaction.reply({ content: '⚠️ Wybierz dokładnie **2** drużyny.', ephemeral: true });
      return;
    }

    if (!cache.has(userId)) cache.set(userId, {});
    const data = cache.get(userId);
    data[key] = uniq(values).slice(0, 2);
    cache.set(userId, data);

    logger.info(`[Double Elim] ${username} (${userId}) wybrał ${key}: ${data[key].join(', ')}`);
    await interaction.deferUpdate();
    return;
  }

  // Zatwierdzenie zapisuje JSON-em
  if (interaction.isButton() && customId === 'confirm_doubleelim') {
    const teams = loadTeams();
    const picks = cache.get(userId) || {};

    const required = ['upper_final_a', 'lower_final_a', 'upper_final_b', 'lower_final_b'];
    const missing = required.filter(k => !Array.isArray(picks[k]) || picks[k].length !== 2);
    if (missing.length) {
      return interaction.reply({
        content: `❌ Brakuje pełnych wyborów (po 2 drużyny) w: ${missing.join(', ')}.`,
        ephemeral: true
      });
    }

    // Globalna unikalność
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

    // Walidacja zgodności z teams.json
    const invalid = all.filter(t => !teams.includes(t));
    if (invalid.length) {
      return interaction.reply({
        content: `⚠️ Nieznane drużyny: ${invalid.join(', ')}.`,
        ephemeral: true
      });
    }

    try {
      // zapis JSON (kolumny typu TEXT)
      await pool.query(
        `INSERT INTO doubleelim_predictions
          (user_id, username, displayname, upper_final_a, lower_final_a, upper_final_b, lower_final_b)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           upper_final_a = VALUES(upper_final_a),
           lower_final_a = VALUES(lower_final_a),
           upper_final_b = VALUES(upper_final_b),
           lower_final_b = VALUES(lower_final_b),
           displayname   = VALUES(displayname)`,
        [
          userId,
          username,
          displayName,
          JSON.stringify(picks.upper_final_a),
          JSON.stringify(picks.lower_final_a),
          JSON.stringify(picks.upper_final_b),
          JSON.stringify(picks.lower_final_b)
        ]
      );

      cache.delete(userId);
      logger.info(`[Double Elim] Zapisano typy (2/slot) ${username} (${userId}).`);
      return interaction.reply({ content: '✅ Twoje typy zostały zapisane!', ephemeral: true });
    } catch (err) {
      logger.error(`[Double Elim] Błąd zapisu typów dla ${username} (${userId}):`, err);
      return interaction.reply({ content: '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie.', ephemeral: true });
    }
  }
};
