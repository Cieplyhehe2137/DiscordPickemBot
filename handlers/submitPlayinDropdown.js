const db = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// Pamięć EPHEMERAL per użytkownik i serwer
const cache = new Map();  

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const key = `${guildId}:${userId}`;

  // ========== SELECT MENU ==========
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {

    cache.set(key, interaction.values);

    logger.info(`[Play-In] ${username} (${userId}) [${guildId}] wybrał: ${interaction.values.join(', ')}`);

    await interaction.deferUpdate();
    return;
  }

  // ========== PRZYCISK ZATWIERDZANIA ==========
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {

    // 1️⃣ WALIDACJA FAZY
    const gate = await assertPredictionsAllowed({ guildId, kind: "PLAYIN" });
    if (!gate.allowed) {
      return interaction.reply({ content: gate.message, ephemeral: true });
    }

    // 2️⃣ SPRAWDZENIE, CZY COŚ WYBRANO
    const picked = cache.get(key);
    if (!picked || picked.length !== 8) {
      return interaction.reply({
        content: "❌ Musisz wybrać **dokładnie 8 drużyn**.",
        ephemeral: true
      });
    }

    const pool = db.getPoolForGuild(guildId);

    // 3️⃣ WALIDACJA Z DB
    const [rows] = await pool.query(
      "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
      [guildId]
    );
    const allowedTeams = rows.map(t => t.name);

    const invalid = picked.filter(t => !allowedTeams.includes(t));
    if (invalid.length) {
      return interaction.reply({
        content: `❌ Nieznane drużyny: **${invalid.join(', ')}**`,
        ephemeral: true
      });
    }

    // 4️⃣ ZAPIS DO WŁAŚCIWEJ BAZY
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

      logger.info(`[Play-In] Saved picks for ${username} (${userId}) [${guildId}]`);

      return interaction.reply({
        content: "✅ Twoje typy zostały zapisane!",
        ephemeral: true
      });
    } catch (err) {
      logger.error("[Play-In] DB error:", err);
      return interaction.reply({
        content: "❌ Błąd zapisu typów do bazy.",
        ephemeral: true
      });
    }
  }
};
