const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

const CACHE_TTL = 15 * 60 * 1000;
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

async function loadTeamsFromDB(db, guildId) {
  const [rows] = await db.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY name ASC
    `,
    [guildId]
  );

  return rows.map(r => r.name);
}

module.exports = async (interaction) => {
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

  if (interaction.isStringSelectMenu() && dropdownMatch) {
    const typeRaw = dropdownMatch[1];
    const stage = dropdownMatch[2];

    const type =
      typeRaw === '3_0' ? '3'
        : typeRaw === '0_3' ? '0'
          : 'advancing';

    const cacheKey = `${guildId}:${userId}:${stage}`;
    const local = getCache(cacheKey) || {};

    local[type] = interaction.values.map(String);
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

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db) => {

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

    if (
      data['3'].length !== 2 ||
      data['0'].length !== 2 ||
      data['advancing'].length !== 6
    ) {
      return interaction.editReply(
        '⚠️ Nieprawidłowa liczba drużyn.'
      );
    }

    const all = [...data['3'], ...data['0'], ...data['advancing']];
    if (new Set(all).size !== all.length) {
      return interaction.editReply(
        '⚠️ Ta sama drużyna nie może wystąpić w więcej niż jednej kategorii.'
      );
    }

    const validTeams = await loadTeamsFromDB(db, guildId);
    const invalid = all.filter(t => !validTeams.includes(t));

    if (invalid.length) {
      return interaction.editReply(
        `⚠️ Nieznane drużyny: ${invalid.join(', ')}`
      );
    }

    await db.query(
      `
      INSERT INTO swiss_predictions
        (guild_id, user_id, username, displayname, stage,
         pick_3_0, pick_0_3, advancing, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        pick_3_0 = VALUES(pick_3_0),
        pick_0_3 = VALUES(pick_0_3),
        advancing = VALUES(advancing),
        displayname = VALUES(displayname),
        active = 1,
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
      ]
    );

    cache.delete(cacheKey);

    return interaction.editReply(
      '✅ Twoje typy zostały zapisane!'
    );
  });
};