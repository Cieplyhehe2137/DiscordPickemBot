const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('miejsce')
    .setDescription('Sprawdź miejsce i punkty danego użytkownika w rankingu Pick\'Em')
    .addUserOption(option =>
      option
        .setName('użytkownik')
        .setDescription('Wybierz użytkownika Discord, którego miejsce chcesz sprawdzić')
        .setRequired(true)
    ),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    return withGuild(guildId, async () => {
      try {
        const user = interaction.options.getUser('użytkownik');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const displayName = member?.displayName || user.username;
        const uid = user.id;

        // JEDNO ZAPYTANIE SQL — POBIERA WSZYSTKO
        const [rows] = await pool.query(`
        SELECT 
          u.user_id,
          u.displayname,

          COALESCE(s1.points, 0) AS swiss1,
          COALESCE(s2.points, 0) AS swiss2,
          COALESCE(s3.points, 0) AS swiss3,
          COALESCE(p.points, 0) AS playoffs,
          COALESCE(d.points, 0) AS doubleelim,
          COALESCE(pl.points, 0) AS playin,

          (
            COALESCE(s1.points, 0) +
            COALESCE(s2.points, 0) +
            COALESCE(s3.points, 0) +
            COALESCE(p.points, 0) +
            COALESCE(d.points, 0) +
            COALESCE(pl.points, 0)
          ) AS total

        FROM (
          SELECT user_id, displayname FROM swiss_scores
          UNION ALL SELECT user_id, displayname FROM playoffs_scores
          UNION ALL SELECT user_id, displayname FROM doubleelim_scores
          UNION ALL SELECT user_id, displayname FROM playin_scores
        ) u

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM swiss_scores WHERE stage='stage1' GROUP BY user_id
        ) s1 ON s1.user_id = u.user_id

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM swiss_scores WHERE stage='stage2' GROUP BY user_id
        ) s2 ON s2.user_id = u.user_id

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM swiss_scores WHERE stage='stage3' GROUP BY user_id
        ) s3 ON s3.user_id = u.user_id

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM playoffs_scores GROUP BY user_id
        ) p ON p.user_id = u.user_id

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM doubleelim_scores GROUP BY user_id
        ) d ON d.user_id = u.user_id

        LEFT JOIN (
          SELECT user_id, SUM(points) AS points
          FROM playin_scores GROUP BY user_id
        ) pl ON pl.user_id = u.user_id
      `);

      // Zamiana stringów na liczby (awaryjnie)
      const sanitized = rows.map(r => ({
        ...r,
        swiss1: parseInt(String(r.swiss1).replace(/[^0-9]/g, ''), 10) || 0,
        swiss2: parseInt(String(r.swiss2).replace(/[^0-9]/g, ''), 10) || 0,
        swiss3: parseInt(String(r.swiss3).replace(/[^0-9]/g, ''), 10) || 0,
        playoffs: parseInt(String(r.playoffs).replace(/[^0-9]/g, ''), 10) || 0,
        doubleelim: parseInt(String(r.doubleelim).replace(/[^0-9]/g, ''), 10) || 0,
        playin: parseInt(String(r.playin).replace(/[^0-9]/g, ''), 10) || 0,
        total: parseInt(String(r.total).replace(/[^0-9]/g, ''), 10) || 0,
      }));

      // SORTOWANIE
      const ranking = sanitized
        .filter(u => u.total > 0)
        .sort((a, b) => b.total - a.total);

      // Szukanie miejsca gracza
      const place = ranking.findIndex(r => r.user_id === uid) + 1;

      // Dane tego użytkownika
      const userData = sanitized.find(r => r.user_id === uid);

      const embed = new EmbedBuilder()
        .setColor('Blue')
        .setTitle(`📊 Miejsce gracza: ${displayName}`);

      if (!userData || userData.total === 0) {
        embed.setDescription(`Gracz **${displayName}** nie zdobył jeszcze żadnych punktów.`);
      } else {
        embed.setDescription(
          `Gracz **${displayName}** zajmuje **${place}. miejsce** z łącznym wynikiem **${userData.total} punktów**.\n\n` +
          `📦 Szczegóły punktacji:\n` +
          `• 🧊 Swiss Stage 1: **${userData.swiss1} pkt**\n` +
          `• 🧊 Swiss Stage 2: **${userData.swiss2} pkt**\n` +
          `• 🧊 Swiss Stage 3: **${userData.swiss3} pkt**\n` +
          `• 🔥 Playoffs: **${userData.playoffs} pkt**\n` +
          `• 🔁 Double Elim: **${userData.doubleelim} pkt**\n` +
          `• 🛫 Play-In: **${userData.playin} pkt**`
        );
      }

        await interaction.reply({ embeds: [embed], ephemeral: false });

      } catch (err) {
        console.error('❌ Błąd w /miejsce:', err);
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: '❌ Wystąpił błąd.', ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ Wystąpił błąd.', ephemeral: true });
        }
      }
    });
  }
};
