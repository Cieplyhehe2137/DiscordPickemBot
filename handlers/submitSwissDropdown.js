// handlers/submitSwissDropdown.js

const db = require('../db');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache: `${guildId}:${userId}:${stage}` -> { '3':[], '0':[], 'advancing':[] }
const cache = new Map();

// ===============================
// DB helpers
// ===============================
async function loadTeamsFromDB(pool, guildId) {
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

// ===============================
// HANDLER
// ===============================
module.exports = async (interaction) => {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const pool = db.getPoolForGuild(guildId);

  logger.debug('submit', 'Interaction received', {
    guildId,
    userId,
    customId
  });

  // ===============================
  // STAGE (stage1 / stage2 / stage3)
  // ===============================
  const stageMatch = customId.match(/stage([123])/);
  const stage = stageMatch ? `stage${stageMatch[1]}` : null;

  if (!stage) {
    logger.warn('submit', 'Stage not recognized', { guildId, userId, customId });
    return interaction.reply({
      content: '❌ Nie udało się rozpoznać etapu Swiss.',
      ephemeral: true
    });
  }

  const cacheKey = `${guildId}:${userId}:${stage}`;

  // ===============================
  // 1) DROPDOWNS
  // ===============================
  if (interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();

    // swiss_3_0_stage1 / swiss_0_3_stage1 / swiss_advancing_stage1
    const parts = customId.split('_');
    const typeRaw = parts[1];

    let type;
    if (typeRaw === '3') type = '3';
    else if (typeRaw === '0') type = '0';
    else if (typeRaw === 'advancing') type = 'advancing';
    else {
      logger.warn('submit', 'Unknown dropdown type', { guildId, userId, customId });
      return interaction.followUp({
        content: '❌ Nie udało się rozpoznać typu wyboru.',
        ephemeral: true
      });
    }

    if (!cache.has(cacheKey)) cache.set(cacheKey, {});
    const data = cache.get(cacheKey);

    data[type] = interaction.values;

    logger.debug('submit', 'Dropdown updated', {
      guildId,
      userId,
      stage,
      type,
      count: interaction.values.length
    });

    return interaction.followUp({
      content: '📝 Zapisano wybór (jeszcze niezatwierdzony).',
      ephemeral: true
    });
  }

  // ===============================
  // 2) CONFIRM BUTTON
  // ===============================
  const isConfirm =
    interaction.isButton() &&
    (customId === `confirm_${stage}` || customId === `confirm_swiss_${stage}`);

  if (!isConfirm) return;

  await interaction.deferReply({ ephemeral: true });

  // ✅ P0 gate
  const gate = await assertPredictionsAllowed({ guildId, kind: 'SWISS', stage });
  if (!gate.allowed) {
    return interaction.editReply(gate.message || '❌ Typowanie jest zamknięte.');
  }

  const data = cache.get(cacheKey) || {};

  if (!data['3'] || !data['0'] || !data['advancing']) {
    return interaction.editReply(
      '❌ Najpierw wybierz drużyny dla **3-0**, **0-3** i **awansujących**.'
    );
  }

  // ===============================
  // WALIDACJA ILOŚCI
  // ===============================
  if (
    data['3'].length !== 2 ||
    data['0'].length !== 2 ||
    data['advancing'].length !== 6
  ) {
    return interaction.editReply(
      `⚠️ Nieprawidłowa liczba drużyn:\n` +
      `• 3-0: ${data['3'].length}/2\n` +
      `• 0-3: ${data['0'].length}/2\n` +
      `• awansujące: ${data['advancing'].length}/6`
    );
  }

  const all = [...data['3'], ...data['0'], ...data['advancing']];
  if (new Set(all).size !== all.length) {
    return interaction.editReply(
      '⚠️ Ta sama drużyna nie może wystąpić w więcej niż jednej kategorii.'
    );
  }

  // ===============================
  // WALIDACJA TEAMÓW
  // ===============================
  const validTeams = await loadTeamsFromDB(pool, guildId);
  const invalid = all.filter(t => !validTeams.includes(t));

  if (invalid.length) {
    return interaction.editReply(
      `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
    );
  }

  // ===============================
  // 3) ZAPIS DO DB
  // ===============================
  try {
    const pick3 = data['3'].join(', ');
    const pick0 = data['0'].join(', ');
    const advancing = data['advancing'].join(', ');

    const [result] = await pool.query(
      `
      INSERT INTO swiss_predictions
        (guild_id, user_id, username, displayname, stage,
         pick_3_0, pick_0_3, advancing, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        pick_3_0    = VALUES(pick_3_0),
        pick_0_3    = VALUES(pick_0_3),
        advancing   = VALUES(advancing),
        displayname = VALUES(displayname),
        active      = 1
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        stage,
        pick3,
        pick0,
        advancing
      ]
    );

    cache.delete(cacheKey);

    logger.info('submit', 'Swiss submit saved', {
      guildId,
      userId,
      stage,
      affectedRows: result.affectedRows
    });

    return interaction.editReply(
      '✅ Twoje typy dla tej fazy Swiss zostały zapisane!'
    );
  } catch (err) {
    logger.error('submit', 'Swiss submit failed', {
      guildId,
      userId,
      stage,
      message: err.message
    });

    return interaction.editReply(
      '❌ Wystąpił błąd zapisu typów. Spróbuj ponownie później.'
    );
  }
};
