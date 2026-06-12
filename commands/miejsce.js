const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { withGuild } = require('../utils/guildContext');
const calculateScores = require('./calculateScores');

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

    await interaction.deferReply();

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
          return interaction.editReply({
            content: '❌ Nie znaleziono otwartego eventu.',
          });
        }

        await calculateScores(guildId, eventId);

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
          ) u

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ? AND event_id = ? AND stage = 'stage1'
            GROUP BY user_id
          ) s1 ON s1.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ? AND event_id = ? AND stage = 'stage2'
            GROUP BY user_id
          ) s2 ON s2.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM swiss_scores
            WHERE guild_id = ? AND event_id = ? AND stage = 'stage3'
            GROUP BY user_id
          ) s3 ON s3.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM playoffs_scores
            WHERE guild_id = ? AND event_id = ?
            GROUP BY user_id
          ) p ON p.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM doubleelim_scores
            WHERE guild_id = ? AND event_id = ?
            GROUP BY user_id
          ) d ON d.user_id = u.user_id

          LEFT JOIN (
            SELECT user_id, SUM(points) AS points
            FROM playin_scores
            WHERE guild_id = ? AND event_id = ?
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
            SELECT user_id, SUM(points) AS points
            FROM match_points
            WHERE guild_id = ?
              AND event_id = ?
              AND source = 'map'
            GROUP BY user_id
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

        if (!me || Number(me.total) === 0 || place <= 0) {
          embed.setDescription('Ten gracz nie zdobył jeszcze żadnych punktów.');
        } else {
          embed.setDescription(
            `🏅 **Miejsce:** **${place}**\n` +
            `⭐ **Suma punktów:** **${Number(me.total)}**\n\n` +
            `📦 **Rozbicie:**\n` +
            `• Swiss 1: **${Number(me.swiss1)}**\n` +
            `• Swiss 2: **${Number(me.swiss2)}**\n` +
            `• Swiss 3: **${Number(me.swiss3)}**\n` +
            `• Playoffs: **${Number(me.playoffs)}**\n` +
            `• Double Elim: **${Number(me.doubleelim)}**\n` +
            `• Play-In: **${Number(me.playin)}**\n` +
            `• Mecze: **${Number(me.matches)}**\n` +
            `• Mapy: **${Number(me.maps)}**`
          );
        }

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[miejsce] error', err);

        const payload = {
          content: '❌ Wystąpił błąd przy obliczaniu miejsca.',
        };

        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload).catch(() => null);
        }

        return interaction.reply({
          ...payload,
          ephemeral: true,
        }).catch(() => null);
      }
    });
  },
};