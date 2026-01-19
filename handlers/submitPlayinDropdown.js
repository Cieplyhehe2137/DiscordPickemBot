const { getPoolForGuild } = require('../db');
const logger = require('../logger');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

// Pamięć ephemeral
const cache = new Map();

module.exports = async (interaction) => {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const displayName = interaction.member?.displayName || username;

  const key = `${guildId}:${userId}`;

  // SELECT
  if (interaction.isStringSelectMenu() && interaction.customId === 'playin_select') {
    cache.set(key, interaction.values);
    await interaction.deferUpdate();
    return;
  }

  // CONFIRM
  if (interaction.isButton() && interaction.customId === 'confirm_playin') {

    const gate = await assertPredictionsAllowed({ guildId, kind: "PLAYIN" });
    if (!gate.allowed) {
      return interaction.reply({ content: gate.message, ephemeral: true });
    }

    const picked = cache.get(key);
    if (!picked || picked.length !== 8) {
      return interaction.reply({ content: "❌ Wybierz dokładnie 8 drużyn.", ephemeral: true });
    }

    const pool = getPoolForGuild(guildId);

    const [rows] = await pool.query(
      "SELECT name FROM teams WHERE guild_id = ? AND active = 1",
      [guildId]
    );

    const allowed = rows.map(t => t.name);
    const invalid = picked.filter(t => !allowed.includes(t));

    if (invalid.length) {
      return interaction.reply({ content: `Nieznane drużyny: ${invalid.join(', ')}`, ephemeral: true });
    }

    await pool.query(
      `INSERT INTO playin_predictions (guild_id, user_id, username, displayname, teams)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE teams=VALUES(teams), displayname=VALUES(displayname)`,
      [guildId, userId, username, displayName, picked.join(', ')]
    );

    cache.delete(key);

    return interaction.reply({ content: "✅ Zapisano!", ephemeral: true });
  }
};
