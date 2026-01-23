// handlers/submitSwissDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

/* ===============================
   CACHE (TTL)
   key = `${guildId}:${userId}:${stage}`
=============================== */
const CACHE_TTL = 15 * 60 * 1000; // 15 min
const cache = new Map();

function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;

  if (Date.now() - e.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

function setCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

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
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  /* ===============================
     STAGE
     =============================== */
  const m = customId.match(/stage([123])/);
  const stage = m ? `stage${m[1]}` : null;

  if (!stage) {
    return interaction.reply({
      content: '❌ Nie udało się rozpoznać etapu Swiss.',
      ephemeral: true
    });
  }

  const cacheKey = `${guildId}:${userId}:${stage}`;
  const local = getCache(cacheKey) || {};

  /* ===============================
     DROPDOWNS
     =============================== */
  if (interaction.isStringSelectMenu()) {
    // customId: swiss_3_0_stage1 | swiss_0_3_stage1 | swiss_advancing_stage1
    const parts = customId.split('_');

    let type;
    if (parts[1] === '3') type = '3';
    else if (parts[1] === '0') type = '0';
    else if (parts[1] === 'advancing') type = 'advancing';
    else return interaction.deferUpdate();

    local[type] = interaction.values.map(String);
    setCache(cacheKey, local);

    logger.debug('submit', 'Swiss dropdown updated', {
      guildId,
      userId,
      stage,
      type,
      values: local[type]
    });

    await interaction.deferUpdate();
    return;
  }

  /* ===============================
     CONFIRM BUTTON
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

    const data = getCache(cacheKey) || {};

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
        `• awans: ${data['advancing'].length}/6`
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
       DB SAVE
       =============================== */
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
        data['3'].join(', '),
        data['0'].join(', '),
        data['advancing'].join(', ')
      ],
      { guildId, scope: 'submitSwiss', label: 'upsert swiss_predictions' }
    );

    cache.delete(cacheKey);

    logger.info('submit', 'Swiss predictions saved', {
      guildId,
      userId,
      stage
    });

    return interaction.editReply(
      '✅ Twoje typy dla tej fazy Swiss zostały zapisane!'
    );
  });
};
