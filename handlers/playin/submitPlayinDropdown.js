// handlers/submitPlayinDropdown.js

const { withGuild } = require('../../utils/guildContext');
const { logInfo, logWarn, logError, logger } = require('../../utils/logger');
const { assertPredictionsAllowed } = require('../../utils/protectionsGuards');
const { getDraft, setDraft, clearDraft } = require('../../utils/predictionDraftCache');
const { loadActiveTeams } = require('../../utils/loadActiveTeams');
const { getOpenEventId } = require('../../utils/getOpenEventId');

const NAMESPACE = 'playin';
const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, teams) => setDraft(NAMESPACE, key, teams);

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user?.id;

  // ===== guards =====
  if (!guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    });
  }

  if (!userId) return;

  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;
  const cacheKey = `${guildId}:${userId}`;

  /* ===============================
     SELECT MENU – wybór drużyn
     =============================== */
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {
    const values = (interaction.values || []).map(String);

    if (values.length !== 8) {
      return interaction.reply({
        content: '❌ Musisz wybrać **dokładnie 8 drużyn**.',
        ephemeral: true
      });
    }

    if (new Set(values).size !== 8) {
      return interaction.reply({
        content: '❌ Drużyny nie mogą się powtarzać.',
        ephemeral: true
      });
    }

    setCache(cacheKey, values);

    logger.debug('submit', 'Play-In dropdown updated', {
      guildId,
      userId,
      count: values.length,
      teams: values
    });

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => { });
    }
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || interaction.customId !== 'confirm_playin') return;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  await withGuild(interaction, async ({ pool, guildId }) => {
    /* ===============================
       GATE
       =============================== */
    const gate = await assertPredictionsAllowed({
      guildId,
      kind: 'PLAYIN'
    });

    if (!gate.allowed) {
      return interaction.editReply(
        gate.message || '❌ Typowanie jest aktualnie zamknięte.'
      );
    }

    const picked = getCache(cacheKey);

    if (!Array.isArray(picked) || picked.length !== 8) {
      return interaction.editReply(
        '❌ Musisz wybrać **dokładnie 8 drużyn**.'
      );
    }

    /* ===============================
       WALIDACJA DRUŻYN Z DB
       =============================== */
    const teamNames = await loadActiveTeams(pool, guildId);
    const allowed = new Set(teamNames);
    const invalid = picked.filter(t => !allowed.has(t));

    if (invalid.length) {
      return interaction.editReply(
        `❌ Nieznane lub nieaktywne drużyny: **${invalid.join(', ')}**`
      );
    }

    /* ===============================
       ZAPIS DO DB
       =============================== */

    const eventId = await getOpenEventId(pool, guildId);

    if (!eventId) {
      return interaction.editReply(
        '❌ Nie znaleziono aktywnego eventu.'
      );
    }

    const teamsString = picked.join(', ');

    await pool.query(
      `
  INSERT INTO playin_predictions
    (guild_id, event_id, user_id, username, displayname, teams, active, submitted_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  ON DUPLICATE KEY UPDATE
    event_id      = VALUES(event_id),
    teams         = VALUES(teams),
    displayname   = VALUES(displayname),
    active        = 1,
    submitted_at  = CURRENT_TIMESTAMP
  `,
      [
        guildId,
        eventId,
        userId,
        username,
        displayName,
        teamsString
      ]
    );

    clearDraft(NAMESPACE, cacheKey);

    logInfo('submit', 'Play-In predictions saved', {
      guildId,
      userId,
      teams: teamsString
    });

    return interaction.editReply(
      '✅ Twoje typy Play-In zostały zapisane!'
    );
  });
};
