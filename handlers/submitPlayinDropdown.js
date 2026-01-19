// handlers/submitPlayinDropdown.js

const db = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// Pamięć lokalna na wybory użytkownika
const cache = new Map(); // key = `${guildId}:${userId}`

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const key = `${guildId}:${userId}`;

  //
  // SELECT MENU
  //
  if (interaction.isStringSelectMenu()) {
    cache.set(key, interaction.values);

    logger.info(`[Play-in] ${username} (${userId}) [${guildId}] wybrał: ${interaction.values.join(', ')}`);

    await interaction.deferUpdate();
    return;
  }

  //
  // PRZYCISK: confirm_playin
  //
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {

    // Walidacja fazy turnieju
    const gate = await assertPredictionsAllowed({ guildId, kind: "PLAYIN" });

    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
    }

    const picked = cache.get(key);

    if (!picked || picked.length !== 8) {
      return interaction.reply({
        content: '⚠️ Musisz wybrać dokładnie 8 drużyn.',
        ephemeral: true
      });
    }

    // Pobieramy poprawną bazę (per serwer)
    const pool = db.getPoolForGuild(guildId);

    // Pobieramy listę aktywnych drużyn z DB
    const [rows] = await pool.query(
      "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
      [guildId]
    );

    const allowedTeams = rows.map(r => r.name);

    // Walidujemy, czy user nie podał drużyn spoza bazy
    const invalid = picked.filter(t => !allowedTeams.includes(t));

    if (invalid.length > 0) {
      return interaction.reply({
        content: `❌ Niepoprawne drużyny: ${invalid.join(', ')}`,
        ephemeral: true
      });
    }

    try {
      await pool.query(
        `INSERT INTO playin_predictions (guild_id, user_id, username, displayname, teams)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           teams = VALUES(teams),
           displayname = VALUES(displayname)`,
        [guildId, userId, username, displayName, picked.join(', ')]
      );

      cache.delete(key);

      return interaction.reply({
        content: "✅ Twoje typy zostały zapisane!",
        ephemeral: true
      });

    } catch (err) {
      logger.error("[Play-in] DB error:", err);
      return interaction.reply({
        content: "❌ Błąd zapisu typów do bazy danych.",
        ephemeral: true
      });
    }
  }
};
