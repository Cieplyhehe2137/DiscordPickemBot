const db = require('../db');
const logger = require('../utils/logger');

const cache = new Map();
const mergeUnique = (a = [], b = []) => Array.from(new Set([...a, ...b]));
const toString = (arr) => arr?.length ? arr.join(', ') : '';

module.exports = async (interaction) => {
  const userId = interaction.user.id;
  const pool = db;

  if (!cache.has(userId)) cache.set(userId, {});
  const data = cache.get(userId);

  if (interaction.isStringSelectMenu()) {
    data.teams = mergeUnique(data.teams, interaction.values);
    return interaction.reply({
      content: `➕ Dodano: ${interaction.values.join(', ')}`,
      ephemeral: true
    });
  }

  if (interaction.isButton() && interaction.customId === 'confirm_playin_results') {
    await pool.query(
      `
      INSERT INTO playin_results (correct_teams, active)
      VALUES (?, 1)
      ON DUPLICATE KEY UPDATE
        correct_teams = VALUES(correct_teams),
        active = 1
      `,
      [toString(data.teams)]
    );

    cache.delete(userId);
    logger.info('playin', 'Play-In results saved');

    return interaction.reply({ content: '✅ Wyniki Play-In zapisane.', ephemeral: true });
  }
};
