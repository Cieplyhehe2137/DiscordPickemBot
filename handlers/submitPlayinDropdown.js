// handlers/submitPlayinDropdown.js

const { withGuild } = require('../utils/guildContext');
const { safeQuery } = require('../utils/safeQuery');
const logger = require('../utils/logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache: `${guildId}:${userId}` -> [teams]
const cache = new Map();

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const cacheKey = `${guildId}:${userId}`;

  /* ===============================
     SELECT MENU – wybór drużyn
     =============================== */
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {
    cache.set(cacheKey, interaction.values.map(String));

    logger.debug('submit', 'Play-In dropdown updated', {
      guildId,
      userId,
      count: interaction.values.length,
      teams: interaction.values
    });

    try { await interaction.deferUpdate(); } catch (_) {}
    return;
  }

  /* ===============================
     CONFIRM BUTTON
     =============================== */
  if (!interaction.isButton() || interaction.customId !== 'confirm_playin') return;

  await interaction.deferReply({ ephemeral: true });

  await withGuild(interaction, async (db, guildId) => {
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

    const picked = cache.get(cacheKey);

    /* ===============================
       WALIDACJA
       =============================== */
    if (!Array.isArray(picked) || picked.length !== 8) {
      return interaction.editReply(
        '❌ Musisz wybrać **dokładnie 8 drużyn**.'
      );
    }

    if (new Set(picked).size !== 8) {
      return interaction.editReply(
        '❌ Drużyny nie mogą się powtarzać.'
      );
    }

    /* ===============================
       WALIDACJA DRUŻYN Z DB
       =============================== */
    const [rows] = await safeQuery(
      db,
      `
      SELECT name
      FROM teams
      WHERE guild_id = ?
        AND active = 1
      `,
      [guildId],
      { guildId, scope: 'submitPlayin', label: 'load teams' }
    );

    const allowed = new Set(rows.map(r => String(r.name)));
    const invalid = picked.filter(t => !allowed.has(t));

    if (invalid.length) {
      return interaction.editReply(
        `❌ Nieznane lub nieaktywne drużyny: **${invalid.join(', ')}**`
      );
    }

    /* ===============================
       ZAPIS DO DB (STRINGI)
       =============================== */
    const teamsString = picked.join(', ');

    await safeQuery(
      db,
      `
      INSERT INTO playin_predictions
        (guild_id, user_id, username, displayname, teams, active, submitted_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE
        teams         = VALUES(teams),
        displayname   = VALUES(displayname),
        active        = 1,
        submitted_at = CURRENT_TIMESTAMP
      `,
      [
        guildId,
        userId,
        username,
        displayName,
        teamsString
      ],
      { guildId, scope: 'submitPlayin', label: 'upsert playin_predictions' }
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
