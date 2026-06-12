const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('miejsce')
    .setDescription('Sprawdź miejsce i punkty danego użytkownika w rankingu Pick\'Em')
    .addUserOption(option =>
      option
        .setName('użytkownik')
        .setDescription('Wybierz użytkownika Discord')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze.',
        ephemeral: true,
      });
    }

    return withGuild(guildId, async ({ pool }) => {
      try {
        const user = interaction.options.getUser('użytkownik');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const displayName = member?.displayName || user.username;
        const userId = user.id;

        const [[activeEvent]] = await pool.query(
          `
          SELECT id
          FROM events
          WHERE guild_id = ?
            AND status = 'OPEN'
          ORDER BY id DESC
          LIMIT 1
          `,
          [guildId]
        );

        const eventId = activeEvent?.id;

        if (!eventId) {
          return interaction.reply({
            content: '❌ Nie znaleziono otwartego eventu.',
            ephemeral: true,
          });
        }

        const [rows] = await pool.query(
          `
          SELECT
            u.user_id,

            COALESCE(s1.points, 0) AS swiss1,
            COALESCE(s2.points, 0) AS swiss2,
            COALESCE(s3.points, 0) AS swiss3,
            COALESCE(p.points, 0) AS playoffs,
            COALESCE(d.points, 0) AS doubleelim,
            COALESCE(pl.points, 0) AS playin,
            COALESCE(mp.points, 0) AS matches,
            COALESCE(maps.points, 0) AS maps,

            (
              COALESCE(s1.points, 0) +
              COALESCE(s2.points, 0) +
              COALESCE(s3.points, 0) +
              COALESCE(p.points, 0) +
              COALESCE(d.points, 0) +
              COALESCE(pl.points, 0) +
              COALESCE(mp.points, 0) +
              COALESCE(maps.points, 0)
            ) AS total

          FROM (
            SELECT user_id FROM swiss_scores WHERE guild_id = ? AND event_id = ?
            UNION
            SELECT user_id FROM playoffs_scores WHERE guild_id = ? AND event_id = ?
            UNION
            SELECT user_id FROM doubleelim_scores WHERE guild_id = ? AND event_id = ?
            UNION
            SELECT user_id FROM playin_scores WHERE guild_id = ? AND event_id = ?
            UNION
            SELECT user_id FROM match_points WHERE guild_id = ? AND event_id = ?
            UNION
            SELECT user_id FROM match_map_predictions WHERE guild_id = ? AND event_id = ?
          ) u

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ?
              AND event_id = ?
              AND stage = 'stage1'
            GROUP BY user_id
          ) s1 ON s1.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ?
              AND event_id = ?
              AND stage = 'stage2'
            GROUP BY user_id
          ) s2 ON s2.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ?
              AND event_id = ?
              AND stage = 'stage3'
            GROUP BY user_id
          ) s3 ON s3.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM playoffs_scores
            WHERE guild_id = ?
              AND event_id = ?
            GROUP BY user_id
          ) p ON p.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM doubleelim_scores
            WHERE guild_id = ?
              AND event_id = ?
            GROUP BY user_id
          ) d ON d.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM playin_scores
            WHERE guild_id = ?
              AND event_id = ?
            GROUP BY user_id
          ) pl ON pl.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM match_points
            WHERE guild_id = ?
              AND event_id = ?
              AND source = 'series'
            GROUP BY user_id
          ) mp ON mp.user_id = u.user_id

          LEFT JOIN (
            SELECT
              mmp.user_id,
              COUNT(*) * 3 AS points
            FROM match_map_predictions mmp
            INNER JOIN match_map_results mmr
              ON mmr.guild_id = mmp.guild_id
             AND mmr.event_id = mmp.event_id
             AND mmr.match_id = mmp.match_id
             AND mmr.map_no = mmp.map_no
            WHERE mmp.guild_id = ?
              AND mmp.event_id = ?
              AND mmp.pred_exact_a IS NOT NULL
              AND mmp.pred_exact_b IS NOT NULL
              AND mmr.res_a IS NOT NULL
              AND mmr.res_b IS NOT NULL
              AND mmp.pred_exact_a = mmr.res_a
              AND mmp.pred_exact_b = mmr.res_b
            GROUP BY mmp.user_id
          ) maps ON maps.user_id = u.user_id
          `,
          [
            guildId, eventId,
            guildId, eventId,
            guildId, eventId,
            guildId, eventId,
            guildId, eventId,
            guildId, eventId,

            guildId, eventId,
            guildId, eventId,
            guildId, eventId,

            guildId, eventId,
            guildId, eventId,
            guildId, eventId,

            guildId, eventId,
            guildId, eventId,
          ]
        );

        const ranking = rows
          .filter(r => Number(r.total) > 0)
          .sort((a, b) => Number(b.total) - Number(a.total));

        const place = ranking.findIndex(r => String(r.user_id) === String(userId)) + 1;
        const me = rows.find(r => String(r.user_id) === String(userId));

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`📊 Ranking Pick'Em — ${displayName}`);

        if (!me || Number(me.total) === 0) {
          embed.setDescription('Ten gracz nie zdobył jeszcze żadnych punktów.');
        } else {
          embed.setDescription(
            `🏅 **Miejsce:** **${place}**\n` +
            `⭐ **Suma punktów:** **${me.total}**\n\n` +
            `📦 **Rozbicie:**\n` +
            `• Swiss 1: **${me.swiss1}**\n` +
            `• Swiss 2: **${me.swiss2}**\n` +
            `• Swiss 3: **${me.swiss3}**\n` +
            `• Playoffs: **${me.playoffs}**\n` +
            `• Double Elim: **${me.doubleelim}**\n` +
            `• Play-In: **${me.playin}**\n` +
            `• Mecze: **${me.matches}**\n` +
            `• Mapy: **${me.maps}**`
          );
        }

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('[miejsce] error', err);

        const payload = {
          content: '❌ Wystąpił błąd przy obliczaniu miejsca.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => null);
        } else {
          await interaction.reply(payload).catch(() => null);
        }
      }
    });
  },
};