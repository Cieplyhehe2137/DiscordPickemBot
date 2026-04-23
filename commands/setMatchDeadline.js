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
    // console.log('[SET_MATCH_DEADLINE] start', { guildId });

    if (!guildId) {
      console.warn('[SET_MATCH_DEADLINE] no guildId');
      return interaction.reply({
        ephemeral: true,
        content: '❌ Ta komenda działa tylko na serwerze.'
      });
    }

    const phase = interaction.options.getString('phase');
    const raw = interaction.options.getString('data');

    // console.log('[SET_MATCH_DEADLINE] input', { phase, raw });

    const dt = DateTime.fromFormat(
      raw,
      'yyyy-MM-dd HH:mm',
      { zone: 'Europe/Warsaw' }
    );

    // console.log('[SET_MATCH_DEADLINE] parsed date', {
    //   isValid: dt.isValid,
    //   value: dt.toISO()
    // });

    if (!dt.isValid || dt <= DateTime.now()) {
      console.warn('[SET_MATCH_DEADLINE] invalid or past date');
      return interaction.reply({
        ephemeral: true,
        content: '❌ Zły format daty lub data w przeszłości.'
      });
    }

    const matchDeadlineUTC = dt.toUTC().toJSDate();
    // console.log('[SET_MATCH_DEADLINE] UTC deadline', matchDeadlineUTC);

    return withGuild(guildId, async ({ pool }) => {
      // console.log('[SET_MATCH_DEADLINE] DB context ready');

      const [rows] = await pool.query(
  `
  SELECT id, message_id, channel_id
  FROM active_panels
  WHERE guild_id = ?
    AND phase = ?
    AND active = 1
  ORDER BY id DESC
  LIMIT 1
  `,
  [guildId, phase]
);

      // console.log('[SET_MATCH_DEADLINE] panel rows', rows);

      if (!rows.length) {
        console.warn('[SET_MATCH_DEADLINE] no panel found for phase', phase);
        return interaction.reply({
          ephemeral: true,
          content: `❌ Nie znaleziono zamkniętego panelu Pick’Em dla fazy **${phase}**.`
        });
      }

      const panelId = rows[0].id;
      // console.log('[SET_MATCH_DEADLINE] updating panel', panelId);

      await pool.query(
        `
        UPDATE active_panels
        SET match_deadline = ?
        WHERE id = ?
        `,
        [matchDeadlineUTC, panelId]
      );

      // console.log('[SET_MATCH_DEADLINE] match_deadline updated OK');

      await interaction.reply({
        ephemeral: true,
        content:
          `✅ Deadline **wyników meczów** ustawiony.\n` +
          `📌 Faza: **${phase}**\n` +
          `⏱ ${dt.toFormat('yyyy-MM-dd HH:mm')} (PL)`
      });
    });
  }
};
