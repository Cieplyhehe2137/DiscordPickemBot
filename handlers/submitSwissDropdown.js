// handlers/submitSwissDropdown.js

const pool = require('../db.js');
const logger = require('../utils/logger.js');
const fs = require('fs');
const path = require('path');

// cache: klucz = `${userId}:${stage}`, wartość = { '3': [...], '0': [...], 'advancing': [...] }
const cache = new Map();

function loadTeams() {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'teams.json'),
      'utf8'
    );
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (typeof parsed[0] === 'string') return parsed;
      if (typeof parsed[0] === 'object') {
        return parsed
          .map(t => t.name || t.label || t.value)
          .filter(Boolean);
      }
    }
    return [];
  } catch (err) {
    logger.error("submit", "Failed to load teams.json", {
      message: err.message,
      stack: err.stack
    });
    return [];
  }
}

module.exports = async (interaction) => {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  logger.debug("submit", "Interaction received", {
    userId,
    username,
    customId
  });

  // Rozpoznanie etapu: stage1 / stage2 / stage3
  const stageMatch = customId.match(/stage([123])/);
  const stage = stageMatch ? `stage${stageMatch[1]}` : null;

  if (!stage) {
    logger.warn("submit", "Stage not recognized", {
      userId,
      customId
    });

    return interaction.reply({
      content: '❌ Nie udało się rozpoznać etapu Swiss.',
      ephemeral: true
    });
  }

  const cacheKey = `${userId}:${stage}`;

  // ==================================================
  // 1) DROPDOWN — zapamiętywanie wyborów
  // ==================================================
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
      logger.warn("submit", "Unknown dropdown type", {
        userId,
        stage,
        customId
      });

      return interaction.followUp({
        content: '❌ Nie udało się rozpoznać typu wyboru.',
        ephemeral: true
      });
    }

    if (!cache.has(cacheKey)) cache.set(cacheKey, {});
    const data = cache.get(cacheKey);

    data[type] = interaction.values;

    logger.debug("submit", "Dropdown updated", {
      userId,
      stage,
      type,
      count: interaction.values.length
    });

    return interaction.followUp({
      content: '📝 Zapisano wybór (jeszcze nie zatwierdzono).',
      ephemeral: true
    });
  }

  // ==================================================
  // 2) PRZYCISK „ZATWIERDŹ”
  // ==================================================
  const isConfirmButton =
    interaction.isButton() &&
    (customId === `confirm_${stage}` || customId === `confirm_swiss_${stage}`);

  if (!isConfirmButton) return;

  await interaction.deferReply({ ephemeral: true });

  logger.info("submit", "Submit started", {
    userId,
    username,
    stage
  });

  const data = cache.get(cacheKey) || {};

  if (!data['3'] || !data['0'] || !data['advancing']) {
    logger.warn("submit", "Submit blocked – incomplete selections", {
      userId,
      stage
    });

    return interaction.editReply(
      '❌ Najpierw wybierz wszystkie drużyny (3-0, 0-3 i awansujące).'
    );
  }

  const len3 = data['3'].length;
  const len0 = data['0'].length;
  const lenAdv = data['advancing'].length;

  if (len3 !== 2 || len0 !== 2 || lenAdv !== 6) {
    logger.warn("submit", "Invalid picks count", {
      userId,
      stage,
      "3-0": len3,
      "0-3": len0,
      advancing: lenAdv
    });

    return interaction.editReply(
      `⚠️ Nieprawidłowa liczba drużyn:\n` +
      `• 3-0: ${len3}/2\n` +
      `• 0-3: ${len0}/2\n` +
      `• awansujące: ${lenAdv}/6`
    );
  }

  const allTeams = [...data['3'], ...data['0'], ...data['advancing']];
  const uniqueTeams = new Set(allTeams);

  if (allTeams.length !== uniqueTeams.size) {
    logger.warn("submit", "Duplicate teams detected", {
      userId,
      stage
    });

    return interaction.editReply(
      '⚠️ Ta sama drużyna nie może być wybrana w więcej niż jednej kategorii.'
    );
  }

  const validTeams = loadTeams();
  const invalidTeams = allTeams.filter(t => !validTeams.includes(t));

  if (invalidTeams.length > 0) {
    logger.warn("submit", "Invalid team names detected", {
      userId,
      stage,
      invalidTeams
    });

    return interaction.editReply(
      `⚠️ Wykryto nieznane drużyny: ${invalidTeams.join(', ')}`
    );
  }

  // ==================================================
  // 3) ZAPIS DO BAZY
  // ==================================================
  try {
    logger.info("submit", "Saving picks to database", {
      userId,
      stage
    });

    const pick3 = data['3'].join(', ');
    const pick0 = data['0'].join(', ');
    const adv = data['advancing'].join(', ');

    const [result] = await pool.query(
      `
        INSERT INTO swiss_predictions 
          (user_id, username, displayname, stage, pick_3_0, pick_0_3, advancing, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          pick_3_0   = VALUES(pick_3_0),
          pick_0_3   = VALUES(pick_0_3),
          advancing  = VALUES(advancing),
          displayname = VALUES(displayname),
          active     = 1
      `,
      [userId, username, displayName, stage, pick3, pick0, adv]
    );

    cache.delete(cacheKey);

    logger.info("submit", "Submit successful", {
      userId,
      username,
      stage,
      picks: {
        "3-0": data['3'],
        "0-3": data['0'],
        advancing: data['advancing']
      },
      affectedRows: result.affectedRows
    });

    return interaction.editReply(
      '✅ Twoje typy dla tej fazy Swiss zostały zapisane!'
    );
  } catch (err) {
    logger.error("submit", "Submit failed", {
      userId,
      username,
      stage,
      message: err.message,
      stack: err.stack
    });

    return interaction.editReply(
      '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie później.'
    );
  }
};
