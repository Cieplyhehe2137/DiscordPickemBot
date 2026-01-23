// handlers/submitSwissDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache: `${guildId}:${userId}:${stage}` -> { '3':[], '0':[], 'advancing':[] }
const cache = new Map();

/* ===============================
   DB HELPERS
   =============================== */
async function loadTeamsFromDB(db, guildId) {
  const [rows] = await safeQuery(
    db,
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY name ASC
    `,
    [guildId],
    { guildId, scope: 'submitSwiss', label: 'load teams' }
  );
  return rows.map(r => r.name);
}

/* ===============================
   HANDLER
   =============================== */
module.exports = async (interaction) => {
  const { customId } = interaction;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  logger.debug('submit', 'Interaction received', {
    guildId: interaction.guildId,
    userId,
    customId
  });

  /* ===============================
     STAGE (stage1 / stage2 / stage3)
     =============================== */
  const stageMatch = customId.match(/stage([123])/);
  const stage = stageMatch ? `stage${stageMatch[1]}` : null;

  if (!stage) {
    logger.warn('submit', 'Stage not recognized', {
      guildId: interaction.guildId,
      userId,
      customId
    });
    return interaction.reply({
      content: '❌ Nie udało się rozpoznać etapu Swiss.',
      ephemeral: true
    });
  }

  const cacheKey = `${interaction.guildId}:${userId}:${stage}`;

  /* ===============================
     1) DROPDOWNS
     =============================== */
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
      logger.warn('submit', 'Unknown dropdown type', {
        guildId: interaction.guildId,
        userId,
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

    logger.debug('submit', 'Dropdown updated', {
      guildId: interaction.guildId,
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

  /* ===============================
     2) CONFIRM BUTTON
     =============================== */
  const isConfirm =
    interaction.isButton() &&
    (customId === `confirm_${stage}` || customId === `confirm_swiss_${stage}`);

  if (!isConfirm) return;

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db, guildId) => {
    /* ===============================
       GATE
       =============================== */
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'SWISS',
      stage
    });

    if (!gate.allowed) {
      return interaction.editReply(
        gate.message || '❌ Typowanie jest zamknięte.'
      );
    }

    const data = cache.get(cacheKey) || {};

    if (!data['3'] || !data['0'] || !data['advancing']) {
      return interaction.editReply(
        '❌ Najpierw wybierz drużyny dla **3-0**, **0-3** i **awansujących**.'
      );
    }

    /* ===============================
       WALIDACJA ILOŚCI
       =============================== */
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

    /* ===============================
       WALIDACJA DRUŻYN
       =============================== */
    const validTeams = await loadTeamsFromDB(db, guildId);
    const invalid = all.filter(t => !validTeams.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`
      );
    }

    /* ===============================
       ZAPIS DO DB (STRINGI)
       =============================== */
    const pick3 = data['3'].join(', ');
    const pick0 = data['0'].join(', ');
    const advancing = data['advancing'].join(', ');

    await safeQuery(
      db,
      `
      INSERT INTO swiss_predictions
        (guild_id, user_id, username, displayname, stage,
         pick_3_0, pick_0_3, advancing, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        pick_3_0     = VALUES(pick_3_0),
        pick_0_3     = VALUES(pick_0_3),
        advancing    = VALUES(advancing),
        displayname  = VALUES(displayname),
        active       = 1,
        submitted_at = CURRENT_TIMESTAMP
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
      ],
      { guildId, scope: 'submitSwiss', label: 'upsert swiss_predictions' }
    );

    cache.delete(cacheKey);

    logger.info('submit', 'Swiss submit saved', {
      guildId,
      userId,
      stage
    });

    return interaction.editReply(
      '✅ Twoje typy dla tej fazy Swiss zostały zapisane!'
    );
  });
};
