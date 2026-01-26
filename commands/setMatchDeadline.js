const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { DateTime } = require('luxon');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set_match_deadline')
    .setDescription('Ustawia deadline zamknięcia typowania wyników meczów dla wybranej fazy')
    .addStringOption(o =>
      o.setName('phase')
        .setDescription('Faza turnieju')
        .setRequired(true)
        .addChoices(
          { name: 'Swiss', value: 'swiss' },
          { name: 'Playoffs', value: 'playoffs' },
          { name: 'Double Elimination', value: 'doubleelim' },
          { name: 'Play-In', value: 'playin' }
        )
    )
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
    const phase = interaction.options.getString('phase');
    const raw = interaction.options.getString('data');

    if (!guildId) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ Ta komenda działa tylko na serwerze.'
      });
    }

    // 🕒 parsowanie daty
    const dt = DateTime.fromFormat(
      raw,
      'yyyy-MM-dd HH:mm',
      { zone: 'Europe/Warsaw' }
    );

    if (!dt.isValid || dt <= DateTime.now()) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ Zły format daty lub data w przeszłości.'
      });
    }

    const utc = dt.toUTC().toJSDate();

    return withGuild(guildId, async ({ pool }) => {

      // 🎯 SZUKAMY PANELU KONKRETNEJ FAZY
      const [rows] = await pool.query(
        `
        SELECT id
        FROM active_panels
        WHERE guild_id = ?
          AND phase = ?
          AND active = 0
        ORDER BY id DESC
        LIMIT 1
        `,
        [guildId, phase]
      );

      if (!rows.length) {
        return interaction.reply({
          ephemeral: true,
          content: `❌ Nie znaleziono zamkniętego panelu Pick’Em dla fazy **${phase}**.`
        });
      }

      const panelId = rows[0].id;

      // ⏱️ ustawiamy deadline dla wyników
      await pool.query(
        `
        UPDATE active_panels
        SET match_deadline = ?
        WHERE id = ?
        `,
        [utc, panelId]
      );

      await interaction.reply({
        ephemeral: true,
        content: `✅ Deadline typowania wyników meczów ustawiony dla fazy **${phase}**.`
      });
    });
  }
};
