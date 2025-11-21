// commands/moje_miejsce.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db.js');
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
    const userId = interaction.user.id;
    const phase = interaction.options.getString('faza') || 'total';

    await interaction.deferReply({ ephemeral: true });

    try {
      // ---------- ŁĄCZNIE ----------
      if (phase === 'total') {
        console.log('[moje_miejsce][total] using MAX(displayname)+SUM(points) in every UNION leg');
        const [res] = await pool.query(`
          SELECT
            u.user_id,
            MAX(u.displayname) AS displayname,
            COALESCE(SUM(u.points), 0) AS total_points
          FROM (
            -- Swiss: suma punktów po wszystkich etapach
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM swiss_scores
            GROUP BY user_id

            UNION ALL
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM playoffs_scores
            GROUP BY user_id

            UNION ALL
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM doubleelim_scores
            GROUP BY user_id

            UNION ALL
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM playin_scores
            GROUP BY user_id
          ) u
          GROUP BY u.user_id
          ORDER BY total_points DESC, u.user_id ASC
        `);

        const list = (res || []).map(r => ({
          user_id: String(r.user_id),
          name: r.displayname || interaction.member?.displayName || interaction.user.username,
          pts: Number(r.total_points || 0),
        }));

        const idx = list.findIndex(r => r.user_id === userId);
        const rank = idx >= 0 ? idx + 1 : null;
        const me = list[idx] || {
          name: interaction.member?.displayName || interaction.user.username,
          pts: 0,
        };

        const embed = new EmbedBuilder()
          .setTitle('Twoje miejsce — łącznie')
          .setDescription(rank ? `**#${rank}** miejsce` : 'Nie znaleziono na liście (0 pkt lub brak wpisu).')
          .addFields(
            { name: 'Nick', value: me.name, inline: true },
            { name: 'Punkty (łącznie)', value: String(me.pts), inline: true },
          )
          .setFooter({ text: 'Ranking na podstawie tabel *_scores' })
          .setColor(0x00AE86);

        return interaction.editReply({ embeds: [embed] });
      }

      // ---------- KONKRETNA FAZA ----------
      let rows = [];
      const title = `Twoje miejsce — ${humanPhase(phase)}`;

      if (phase.startsWith('swiss_')) {
        const aliases = getSwissStageAliases(phase); // np. ['stage1','swiss_stage_1',...]
        let query, params;

        if (aliases.length) {
          const ph = aliases.map(() => '?').join(', ');
          // SUM + MAX + GROUP BY, bo łączysz kilka stage'y
          query = `
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM swiss_scores
            WHERE stage IN (${ph})
            GROUP BY user_id
            ORDER BY points DESC, user_id ASC
          `;
          params = [...aliases];
        } else {
          // Cały Swiss: suma po wszystkich stage'ach per user
          query = `
            SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
            FROM swiss_scores
            GROUP BY user_id
            ORDER BY points DESC, user_id ASC
          `;
          params = [];
        }

        const [phaseRows] = await pool.query(query, params);
        rows = phaseRows || [];

      } else if (phase === 'playoffs') {
        const [phaseRows] = await pool.query(`
          SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
          FROM playoffs_scores
          GROUP BY user_id
          ORDER BY points DESC, user_id ASC
        `);
        rows = phaseRows || [];

      } else if (phase === 'double_elim') {
        const [phaseRows] = await pool.query(`
          SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
          FROM doubleelim_scores
          GROUP BY user_id
          ORDER BY points DESC, user_id ASC
        `);
        rows = phaseRows || [];

      } else if (phase === 'playin') {
        const [phaseRows] = await pool.query(`
          SELECT user_id, MAX(displayname) AS displayname, SUM(points) AS points
          FROM playin_scores
          GROUP BY user_id
          ORDER BY points DESC, user_id ASC
        `);
        rows = phaseRows || [];

      } else {
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription('Nieobsługiwana faza.')
          .setColor(0x00AE86);
        return interaction.editReply({ embeds: [embed] });
      }

      const ordered = rows.map(r => ({
        user_id: String(r.user_id),
        name: r.displayname || interaction.member?.displayName || interaction.user.username,
        pts: Number(r.points || 0),
      }));

      const idx = ordered.findIndex(r => r.user_id === userId);
      const rank = idx >= 0 ? idx + 1 : null;
      const me = ordered[idx] || {
        name: interaction.member?.displayName || interaction.user.username,
        pts: 0,
      };

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(rank ? `**#${rank}** miejsce` : 'Nie znaleziono na liście (0 pkt lub brak wpisu w tej fazie).')
        .addFields(
          { name: 'Nick', value: me.name, inline: true },
          { name: 'Punkty', value: String(me.pts), inline: true },
        )
        .setFooter({ text: 'Ranking na podstawie tabel *_scores' })
        .setColor(0x00AE86);

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[moje_miejsce] Error:', err);
      return interaction.editReply({ content: '⚠️ Wystąpił błąd podczas pobierania rankingu.' });
    }
  },
};
