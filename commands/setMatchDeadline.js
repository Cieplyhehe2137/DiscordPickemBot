const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { DateTime } = require('luxon');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_match_deadline')
    .setDescription('Ustawia deadline zamknięcia typowania wyników meczów')
    .addStringOption(o =>
      o.setName('data')
        .setDescription('YYYY-MM-DD HH:mm (czas PL)')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const raw = interaction.options.getString('data');

    const dt = DateTime.fromFormat(
      raw,
      'yyyy-MM-dd HH:mm',
      { zone: 'Europe/Warsaw' }
    );

    if (!dt.isValid || dt <= DateTime.now()) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ Zły format lub data w przeszłości.'
      });
    }

    const utc = dt.toUTC().toJSDate();

    return withGuild(guildId, async ({ pool }) => {

      const [rows] = await pool.query(
        `
        SELECT id
        FROM active_panels
        WHERE guild_id = ?
          AND active = 0
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId]
      );

      if (!rows.length) {
        return interaction.reply({
          ephemeral: true,
          content: '❌ Brak panelu Pick’Em.'
        });
      }

      await pool.query(
        `UPDATE active_panels SET match_deadline = ? WHERE id = ?`,
        [utc, rows[0].id]
      );

      await interaction.reply({
        ephemeral: true,
        content: '✅ Deadline wyników meczów ustawiony.'
      });
    });
  }
};
