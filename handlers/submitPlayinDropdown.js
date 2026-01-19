// handlers/submitPlayinDropdown.js
const db = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// cache na wybory użytkowników (ephemeral)
const cache = new Map(); // key: `${guildId}:${userId}` → array of team names

module.exports = async (interaction) => {
  const { user, customId, values } = interaction;

  const userId = user.id;
  const username = user.username;
  const displayName = interaction.member?.displayName || username;
  const guildId = interaction.guildId;

  const key = `${guildId}:${userId}`;

  //
  // 1) OBSŁUGA DROPDOWNU (select menu)
  //
  if (interaction.isStringSelectMenu()) {
    // zapisujemy wybór użytkownika do cache (na czas sesji)
    cache.set(key, values);

    logger.info(
      `[Play-in] ${username} (${userId}) [${guildId}] wybrał ${values.length}: ${values.join(', ')}`
    );

    await interaction.deferUpdate();
    return;
  }

  //
  // 2) OBSŁUGA PRZYCISKU ZATWIERDZENIA
  //
  if (interaction.isButton() && customId.startsWith('confirm_playin')) {
    // walidacja czy typowanie jest otwarte
    const gate = await assertPredictionsAllowed({ guildId, kind: 'PLAYIN' });
    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
    }

    const pickedTeams = cache.get(key);

    if (!pickedTeams || pickedTeams.length === 0) {
      return interaction.reply({
        content: '❌ Wybierz drużyny przed zatwierdzeniem.',
        ephemeral: true
      });
    }

    // 8 drużyn awansuje
    if (pickedTeams.length !== 8) {
      return interaction.reply({
        content: `⚠️ Nieprawidłowa liczba drużyn: ${pickedTeams.length}/8.`,
        ephemeral: true
      });
    }

    // brak duplikatów
    if (new Set(pickedTeams).size !== pickedTeams.length) {
      return interaction.reply({
        content: '⚠️ Drużyny nie mogą się powtarzać.',
        ephemeral: true
      });
    }

    //
    // WALIDACJA DRUŻYN Z BAZY
    //
    const pool = db.getPoolForGuild(guildId);

    const [dbTeams] = await pool.query(
      `SELECT name FROM teams WHERE guild_id = ? AND active = 1`,
      [guildId]
    );

    const allowedTeams = dbTeams.map(t => t.name);
    const invalid = pickedTeams.filter(t => !allowedTeams.includes(t));

    if (invalid.length > 0) {
      return interaction.reply({
        content: `⚠️ Nieznane lub nieaktywne drużyny: ${invalid.join(', ')}`,
        ephemeral: true
      });
    }

    //
    // ZAPIS DO WŁAŚCIWEJ BAZY (PER GUILD!!!)
    //
    try {
      const [result] = await pool.query(
        `INSERT INTO playin_predictions (user_id, username, displayname, teams)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           teams = VALUES(teams),
           displayname = VALUES(displayname)`,
        [
          userId,
          username,
          displayName,
          pickedTeams.join(', ')
        ]
      );

      cache.delete(key);

      logger.info(
        `[Play-in] Zapisano ${username} (${userId}) [${guildId}], affectedRows=${result.affectedRows}`
      );

      return interaction.reply({
        content: '✅ Twoje typy zostały zapisane!',
        ephemeral: true
      });
    } catch (err) {
      logger.error(
        `[Play-in] DB error podczas zapisu ${username} (${userId}) [${guildId}]`,
        err
      );

      return interaction.reply({
        content: '❌ Błąd zapisu typów do bazy.',
        ephemeral: true
      });
    }
  }
};
