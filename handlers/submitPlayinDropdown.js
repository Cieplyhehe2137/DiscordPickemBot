// handlers/submitPlayinDropdown.js

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache: `${guildId}:${userId}` -> { teams: [], ts }
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.teams;
}

function setCache(key, teams) {
  cache.set(key, { teams, ts: Date.now() });
}

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
      await interaction.deferUpdate().catch(() => {});
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
    const [rows] = await pool.query(
      `
      SELECT name
      FROM teams
      WHERE guild_id = ?
        AND active = 1
      `,
      [guildId]
    );

    const allowed = new Set(rows.map(r => String(r.name)));
    const invalid = picked.filter(t => !allowed.has(t));

    if (invalid.length) {
      return interaction.editReply(
        `❌ Nieznane lub nieaktywne drużyny: **${invalid.join(', ')}**`
      );
    }

    /* ===============================
       ZAPIS DO DB
       =============================== */
    const teamsString = picked.join(', ');

    await pool.query(
      `
      INSERT INTO playin_predictions
        (guild_id, user_id, username, displayname, teams, active, submitted_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        teams         = VALUES(teams),
        displayname   = VALUES(displayname),
        active        = 1,
        submitted_at  = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        teamsString
      ]
    );

    cache.delete(cacheKey);

    logger.info('submit', 'Play-In predictions saved', {
      guildId,
      userId,
      teams: teamsString
    });

    return interaction.editReply(
      '✅ Twoje typy Play-In zostały zapisane!'
    );
  });
};
