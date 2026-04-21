const { withGuild } = require('../utils/guildContext');
const openAdminMvpResult = require('./openAdminMvpResult');

module.exports = async function openAdminMvpResultEntry(interaction) {
  try {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Brak guildId.',
        ephemeral: true
      });
    }

    const eventId = await withGuild({ guildId }, async ({ pool, guildId }) => {
      try {
        const [rows] = await pool.query(
          `
            SELECT id
            FROM events
            WHERE guild_id = ?
              AND (archived = 0 OR archived IS NULL)
            ORDER BY id DESC
            LIMIT 1
          `,
          [guildId]
        );

        if (rows.length) return rows[0].id;
      } catch (_) {}

      try {
        const [rows2] = await pool.query(
          `
            SELECT id
            FROM events
            WHERE guild_id = ?
            ORDER BY id DESC
            LIMIT 1
          `,
          [guildId]
        );

        if (rows2.length) return rows2[0].id;
      } catch (_) {}

      const [rows3] = await pool.query(
        `
          SELECT id
          FROM events
          ORDER BY id DESC
          LIMIT 1
        `
      );

      return rows3[0]?.id ?? null;
    });

    if (!eventId) {
      return interaction.reply({
        content: '❌ Nie udało się ustalić aktywnego eventu dla MVP.',
        ephemeral: true
      });
    }

    return openAdminMvpResult(interaction, eventId);
  } catch (err) {
    console.error('openAdminMvpResultEntry failed:', err);

    return interaction.reply({
      content: '❌ Nie udało się otworzyć ustawiania oficjalnego MVP.',
      ephemeral: true
    }).catch(() => {});
  }
};