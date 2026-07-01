const { withGuild } = require('../../utils/guildContext');
const { assertPredictionsAllowed } = require('../../utils/protectionsGuards');
const { getDraft, setDraft, clearDraft } = require('../../utils/predictionDraftCache');
const { loadActiveTeams } = require('../../utils/loadActiveTeams');
const { getOpenEventId } = require('../../utils/getOpenEventId');

const NAMESPACE = 'swiss';
const getCache = (key) => getDraft(NAMESPACE, key);
const setCache = (key, data) => setDraft(NAMESPACE, key, data);

module.exports = async (interaction) => {
  if (!interaction.guildId) return;

  const { customId } = interaction;
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  /* ===============================
     DROPDOWN
  =============================== */

  const dropdownMatch = customId.match(
    /^swiss_(3_0|0_3|advancing):(stage[123])$/
  );

  if (dropdownMatch) {
    const typeRaw = dropdownMatch[1];
    const stage = dropdownMatch[2];

    const type =
      typeRaw === '3_0'
        ? '3'
        : typeRaw === '0_3'
          ? '0'
          : 'advancing';

    const cacheKey = `${guildId}:${userId}:${stage}`;
    const local = getCache(cacheKey) || {};

    if (!interaction.values.length) {
      local[type] = [];
      setCache(cacheKey, local);
      await interaction.deferUpdate();
      return;
    }

    const incoming = interaction.values.map(String);

    local[type] = incoming;

    setCache(cacheKey, local);

    await interaction.deferUpdate();
    return;
  }

  /* ===============================
     CONFIRM
  =============================== */

  const confirmMatch = customId.match(
    /^confirm_swiss:(stage[123])$/
  );

  if (!interaction.isButton() || !confirmMatch) return;

  const stage = confirmMatch[1];
  const cacheKey = `${guildId}:${userId}:${stage}`;

  // Bezpieczny ACK
  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async ({ pool }) => {

    // GATE
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

    // Sprawdzenie czy wszystko wybrane
    if (!data['3'] || !data['0'] || !data['advancing']) {
      return interaction.editReply(
        '❌ Najpierw wybierz drużyny dla **3-0**, **0-3** i **awansujących**.'
      );
    }

    // Walidacja ilości
    if (
      data['3'].length !== 2 ||
      data['0'].length !== 2 ||
      data['advancing'].length !== 6
    ) {
      return interaction.editReply(
        '⚠️ Nieprawidłowa liczba drużyn.'
      );
    }

    // Unikalność globalna
    const all = [...data['3'], ...data['0'], ...data['advancing']];
    if (new Set(all).size !== all.length) {
      return interaction.editReply(
        '⚠️ Ta sama drużyna nie może wystąpić w więcej niż jednej kategorii.'
      );
    }

    // Walidacja z DB
    const validTeams = await loadActiveTeams(pool, guildId);
    const invalid = all.filter(t => !validTeams.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane drużyny: ${invalid.join(', ')}`
      );
    }

    // SAVE
    const eventId = await getOpenEventId(pool, guildId);

    if (!eventId) {
      return interaction.editReply(
        '❌ Nie znaleziono aktywnego turnieju dla tego serwera.'
      );
    }

    // SAVE
    await pool.query(
      `
  INSERT INTO swiss_predictions
    (guild_id, event_id, user_id, username, displayname, stage,
     pick_3_0, pick_0_3, advancing, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  ON DUPLICATE KEY UPDATE
    event_id = VALUES(event_id),
    pick_3_0 = VALUES(pick_3_0),
    pick_0_3 = VALUES(pick_0_3),
    advancing = VALUES(advancing),
    displayname = VALUES(displayname),
    active = 1,
    submitted_at = CURRENT_TIMESTAMP
  `,
      [
        guildId,
        eventId,
        userId,
        username,
        displayName,
        stage,
        data['3'].join(', '),
        data['0'].join(', '),
        data['advancing'].join(', ')
      ]
    );

    clearDraft(NAMESPACE, cacheKey);

    return interaction.editReply(
      '✅ Twoje typy zostały zapisane!'
    );
  });
};