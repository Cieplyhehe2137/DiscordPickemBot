// handlers/submitSwissDropdown.js

const pool = require('../db.js');
const logger = require('../utils/logger.js');
const fs = require('fs');
const path = require('path');

// cache: klucz = `${userId}:${stage}`, wartość = { '3': [...], '0': [...], 'advancing': [...] }
const cache = new Map();

function loadTeams() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf8');
    const parsed = JSON.parse(raw);

    // teams.json: ['FaZe', 'G2', ...] albo [{ name / label / value }]
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
    logger.error('[Swiss] Nie udało się wczytać teams.json:', err);
    return [];
  }
}

module.exports = async (interaction) => {
  const customId = interaction.customId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  // Rozpoznanie etapu: szukamy "stage1", "stage2", "stage3" w customId
  const stageMatch = customId.match(/stage([123])/);
  const stage = stageMatch ? `stage${stageMatch[1]}` : null;
  if (!stage) {
    return interaction.reply({
      content: '❌ Nie udało się rozpoznać etapu Swiss.',
      ephemeral: true,
    });
  }

  const cacheKey = `${userId}:${stage}`;

  // ========================
  // 1) OBSŁUGA DROPDOWNÓW
  // ========================
  if (interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();

    // customId: swiss_3_0_stage1 / swiss_0_3_stage1 / swiss_advancing_stage1
    const parts = customId.split('_'); // ['swiss','3','0','stage1'] lub ['swiss','advancing','stage1']
    const typeRaw = parts[1];          // '3' / '0' / 'advancing'
    let type;
    if (typeRaw === '3') type = '3';
    else if (typeRaw === '0') type = '0';
    else if (typeRaw === 'advancing') type = 'advancing';
    else {
      return interaction.followUp({
        content: '❌ Nie udało się rozpoznać typu wyboru.',
        ephemeral: true,
      });
    }

    if (!cache.has(cacheKey)) cache.set(cacheKey, {});
    const data = cache.get(cacheKey);

    data[type] = interaction.values;

    logger.info(
      `[Swiss] ${username} (${userId}) wybrał ${interaction.values.length} drużyn dla "${type}" w ${stage}: ${interaction.values.join(', ')}`
    );

    return interaction.followUp({
      content: '📝 Zapisano wybór (jeszcze nie zatwierdzono).',
      ephemeral: true,
    });
  }

  // ========================
  // 2) PRZYCISK "ZATWIERDŹ"
  // ========================
  const isConfirmButton =
    interaction.isButton() &&
    (customId === `confirm_${stage}` || customId === `confirm_swiss_${stage}`);

  if (isConfirmButton) {
    await interaction.deferReply({ ephemeral: true });

    const data = cache.get(cacheKey) || {};

    if (!data['3'] || !data['0'] || !data['advancing']) {
      return interaction.editReply(
        '❌ Najpierw wybierz wszystkie drużyny w dropdownach (3-0, 0-3 i awansujące).'
      );
    }

    // Walidacja liczby drużyn (2 / 2 / 6)
    const len3 = data['3'].length;
    const len0 = data['0'].length;
    const lenAdv = data['advancing'].length;

    if (len3 !== 2 || len0 !== 2 || lenAdv !== 6) {
      return interaction.editReply(
        `⚠️ Nieprawidłowa liczba drużyn:\n` +
        `• 3-0: ${len3}/2\n` +
        `• 0-3: ${len0}/2\n` +
        `• awansujące: ${lenAdv}/6`
      );
    }

    // Walidacja unikalności drużyn pomiędzy kategoriami
    const allTeams = [...data['3'], ...data['0'], ...data['advancing']];
    const uniqueTeams = new Set(allTeams);

    if (allTeams.length !== uniqueTeams.size) {
      return interaction.editReply(
        '⚠️ Te same drużyny nie mogą być wybrane w więcej niż jednej kategorii (3-0 / 0-3 / awans).'
      );
    }

    // Walidacja drużyn względem teams.json
    const validTeams = loadTeams();
    if (!validTeams || validTeams.length === 0) {
      logger.warn('[Swiss] Brak drużyn w teams.json przy walidacji.');
    }

    const invalidTeams = allTeams.filter(t => !validTeams.includes(t));
    if (invalidTeams.length > 0) {
      return interaction.editReply(
        `⚠️ Wykryto nieznane drużyny (nie ma ich w teams.json): ${invalidTeams.join(', ')}.\n` +
        'Sprawdź poprawność nazw lub konfigurację turnieju.'
      );
    }

    // ========================
    // 3) ZAPIS DO BAZY
    // ========================
    try {
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

      logger.info(`[Swiss] ${username} (${userId}) zapisał typy dla ${stage}:`);
      logger.info(`- 3-0: ${pick3}`);
      logger.info(`- 0-3: ${pick0}`);
      logger.info(`- Awansujące: ${adv}`);
      logger.info(`- Wynik INSERT/UPDATE: affectedRows = ${result.affectedRows}`);

      return interaction.editReply('✅ Twoje typy dla tej fazy Swiss zostały zapisane!');
    } catch (error) {
      logger.error(
        `[Swiss] Błąd przy zapisie typów dla ${username} (${userId}) w ${stage}:`,
        error
      );
      return interaction.editReply(
        '❌ Wystąpił błąd podczas zapisu typów. Spróbuj ponownie później lub zgłoś to administracji.'
      );
    }
  }

  // Inne przyciski / interakcje nas nie interesują
};
