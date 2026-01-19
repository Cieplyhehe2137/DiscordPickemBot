const db = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// Pamięć ephemeral dla wyborów usera
const cache = new Map(); // key = `${guildId}:${userId}`

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const key = `${guildId}:${userId}`;

  // ================================
  //  SELECT MENU
  // ================================
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {

    cache.set(key, interaction.values);

    logger.info(
      `[Play-In] ${username} (${userId}) [${guildId}] wybrał: ${interaction.values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  // ================================
  //  PRZYCISK "Zatwierdź typy"
  // ================================
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {

    // 1️⃣ Walidacja fazy turnieju
    const gate = await assertPredictionsAllowed({ guildId, kind: "PLAYIN" });
    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || "❌ Typowanie jest aktualnie zamknięte.",
        ephemeral: true
      });
    }

    // 2️⃣ Pobieramy wybór użytkownika
    const picked = cache.get(key);
    if (!picked || picked.length !== 8) {
      return interaction.reply({
        content: "❌ Musisz wybrać **dokładnie 8 drużyn**.",
        ephemeral: true
      });
    }

    // 3️⃣ Pobranie puli DB (per guild)
    const pool = db.getPoolForGuild(guildId);

    // DEBUG: jaka baza jest używana naprawdę?
    try {
      const connection = await pool.getConnection();
      console.log(">>> ACTIVE DB:", connection.config.database);
      connection.release();
    } catch (e) {
      console.log(">>> DB DEBUG ERROR:", e.message);
    }

    // 4️⃣ Pobierz listę aktywnych drużyn
    const [rows] = await pool.query(
      "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
      [guildId]
    );

    const allowedTeams = rows.map(t => t.name);

    // 5️⃣ Walidacja — czy user nie wpisał drużyn spoza listy
    const invalid = picked.filter(t => !allowedTeams.includes(t));
    if (invalid.length) {
      return interaction.reply({
        content: `❌ Nieznane drużyny: **${invalid.join(', ')}**`,
        ephemeral: true
      });
    }

    // 6️⃣ Zapis do właściwej bazy
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

      console.error("=== PLAY-IN DB ERROR ===");
      console.error("MESSAGE:", err.message);
      console.error("CODE:", err.code);
      console.error("SQL:", err.sql);
      console.error("STACK:", err.stack);
      console.error("========================");

      return interaction.reply({
        content: "❌ Błąd zapisu typów do bazy danych.",
        ephemeral: true
      });
    }
  }
};
