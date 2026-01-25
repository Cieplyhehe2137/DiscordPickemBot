const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pickem_participants')
    .setDescription('📊 Pokazuje liczbę uczestników Pick’Em (wybrana faza)')
    .addStringOption(opt =>
      opt
        .setName('phase')
        .setDescription('Wybierz fazę Pick’Em')
        .setRequired(true)
        .addChoices(
          { name: 'Wszystkie fazy', value: 'all' },
          { name: 'Swiss', value: 'swiss' },
          { name: 'Play-In', value: 'playin' },
          { name: 'Playoffs', value: 'playoffs' },
          { name: 'Double Elimination', value: 'doubleelim' }
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    const phase = interaction.options.getString('phase');

    await interaction.deferReply({ ephemeral: true });

    await withGuild(interaction, async ({ pool, guildId }) => {
      let sql = '';
      let params = [];

      switch (phase) {
        case 'swiss':
          sql = `
            SELECT COUNT(DISTINCT user_id) AS participants
            FROM swiss_predictions
            WHERE guild_id = ?
          `;
          params = [guildId];
          break;

        case 'playin':
          sql = `
            SELECT COUNT(DISTINCT user_id) AS participants
            FROM playin_predictions
            WHERE guild_id = ?
          `;
          params = [guildId];
          break;

        case 'playoffs':
          sql = `
            SELECT COUNT(DISTINCT user_id) AS participants
            FROM playoffs_predictions
            WHERE guild_id = ?
          `;
          params = [guildId];
          break;

        case 'doubleelim':
          sql = `
            SELECT COUNT(DISTINCT user_id) AS participants
            FROM doubleelim_predictions
            WHERE guild_id = ?
          `;
          params = [guildId];
          break;

        case 'all':
        default:
          sql = `
            SELECT COUNT(DISTINCT user_id) AS participants
            FROM (
              SELECT user_id FROM swiss_predictions      WHERE guild_id = ?
              UNION
              SELECT user_id FROM playin_predictions     WHERE guild_id = ?
              UNION
              SELECT user_id FROM playoffs_predictions   WHERE guild_id = ?
              UNION
              SELECT user_id FROM doubleelim_predictions WHERE guild_id = ?
            ) t
          `;
          params = [guildId, guildId, guildId, guildId];
          break;
      }

      const [[row]] = await pool.query(sql, params);

      const PHASE_LABELS = {
        all: 'Wszystkie fazy',
        swiss: 'Swiss',
        playin: 'Play-In',
        playoffs: 'Playoffs',
        doubleelim: 'Double Elimination'
      };

      const embed = new EmbedBuilder()
        .setTitle('📊 Pick’Em – liczba uczestników')
        .setColor('#4caf50')
        .addFields(
          {
            name: '👥 Uczestnicy',
            value: `**${row?.participants || 0}**`,
            inline: true
          },
          {
            name: '📍 Faza',
            value: PHASE_LABELS[phase],
            inline: true
          }
        )
        .setFooter({
          text: 'Liczeni są użytkownicy, którzy oddali co najmniej jeden typ w wybranej fazie'
        });

      await interaction.editReply({ embeds: [embed] });
    });
  }
};
