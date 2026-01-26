const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { withGuild } = require('../utils/guildContext');
const { PHASE_CHOICES, humanPhase, getSwissStageAliases } = require('../utils/phase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moje_miejsce')
    .setDescription('Pokaż Twoją pozycję w rankingu (łącznie lub dla wybranej fazy).')
    .addStringOption(opt =>
      opt.setName('faza')
        .setDescription('Wybierz etap/fazę turnieju')
        .addChoices(...PHASE_CHOICES)
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze.',
        ephemeral: true,
      });
    }

    const userId = interaction.user.id;
    const phase = interaction.options.getString('faza') || 'total';

    await interaction.deferReply({ ephemeral: true });

    return withGuild(guildId, async ({ pool }) => {
      try {
        const member = interaction.member;
        const displayName = member?.displayName || interaction.user.username;

        /* =======================
           TOTAL
        ======================= */
        if (phase === 'total') {
          const [rows] = await pool.query(
            `
            SELECT user_id, SUM(points) AS total_points
            FROM (
              SELECT user_id, points FROM swiss_scores WHERE guild_id = ?
              UNION
              SELECT user_id, points FROM playoffs_scores WHERE guild_id = ?
              UNION
              SELECT user_id, points FROM doubleelim_scores WHERE guild_id = ?
              UNION
              SELECT user_id, points FROM playin_scores WHERE guild_id = ?
            ) t
            GROUP BY user_id
            HAVING SUM(points) > 0
            ORDER BY total_points DESC, user_id ASC
            `,
            [guildId, guildId, guildId, guildId]
          );

          const idx = rows.findIndex(r => String(r.user_id) === userId);
          const rank = idx >= 0 ? idx + 1 : null;
          const me = rows[idx];

          const embed = new EmbedBuilder()
            .setTitle('Twoje miejsce — łącznie')
            .setColor(0x00AE86);

          if (!me) {
            embed.setDescription('Nie masz jeszcze żadnych punktów.');
          } else {
            embed
              .setDescription(`**#${rank}** miejsce`)
              .addFields(
                { name: 'Nick', value: displayName, inline: true },
                { name: 'Punkty (łącznie)', value: String(me.total_points), inline: true }
              );
          }

          return interaction.editReply({ embeds: [embed] });
        }

        /* =======================
           FAZY
        ======================= */
        let rows = [];
        const title = `Twoje miejsce — ${humanPhase(phase)}`;

        if (phase.startsWith('swiss_')) {
          const aliases = getSwissStageAliases(phase);

          if (aliases.length) {
            const placeholders = aliases.map(() => '?').join(', ');
            const [r] = await pool.query(
              `
              SELECT user_id, SUM(points) AS points
              FROM swiss_scores
              WHERE guild_id = ?
                AND stage IN (${placeholders})
              GROUP BY user_id
              HAVING SUM(points) > 0
              ORDER BY points DESC, user_id ASC
              `,
              [guildId, ...aliases]
            );
            rows = r;
          } else {
            const [r] = await pool.query(
              `
              SELECT user_id, SUM(points) AS points
              FROM swiss_scores
              WHERE guild_id = ?
              GROUP BY user_id
              HAVING SUM(points) > 0
              ORDER BY points DESC, user_id ASC
              `,
              [guildId]
            );
            rows = r;
          }

        } else if (phase === 'playoffs') {
          const [r] = await pool.query(
            `
            SELECT user_id, SUM(points) AS points
            FROM playoffs_scores
            WHERE guild_id = ?
            GROUP BY user_id
            HAVING SUM(points) > 0
            ORDER BY points DESC, user_id ASC
            `,
            [guildId]
          );
          rows = r;

        } else if (phase === 'double_elim') {
          const [r] = await pool.query(
            `
            SELECT user_id, SUM(points) AS points
            FROM doubleelim_scores
            WHERE guild_id = ?
            GROUP BY user_id
            HAVING SUM(points) > 0
            ORDER BY points DESC, user_id ASC
            `,
            [guildId]
          );
          rows = r;

        } else if (phase === 'playin') {
          const [r] = await pool.query(
            `
            SELECT user_id, SUM(points) AS points
            FROM playin_scores
            WHERE guild_id = ?
            GROUP BY user_id
            HAVING SUM(points) > 0
            ORDER BY points DESC, user_id ASC
            `,
            [guildId]
          );
          rows = r;

        } else {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(title)
                .setDescription('Nieobsługiwana faza.')
                .setColor(0x00AE86)
            ]
          });
        }

        const idx = rows.findIndex(r => String(r.user_id) === userId);
        const rank = idx >= 0 ? idx + 1 : null;
        const me = rows[idx];

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setColor(0x00AE86);

        if (!me) {
          embed.setDescription('Nie masz punktów w tej fazie.');
        } else {
          embed
            .setDescription(`**#${rank}** miejsce`)
            .addFields(
              { name: 'Nick', value: displayName, inline: true },
              { name: 'Punkty', value: String(me.points), inline: true }
            );
        }

        return interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error('[moje_miejsce] error', err);
        return interaction.editReply({
          content: '⚠️ Wystąpił błąd podczas pobierania rankingu.',
        });
      }
    });
  },
};
