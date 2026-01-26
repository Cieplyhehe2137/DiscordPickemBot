// commands/moje_typy.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { PHASE_CHOICES, humanPhase, getSwissStageAliases } = require('../utils/phase');
const { withGuild } = require('../utils/guildContext');

/* =========================
   HELPERS
========================= */
function parseList(input) {
  if (input == null) return [];
  if (Array.isArray(input)) {
    if (input.length && typeof input[0] === 'object') {
      return input.map(o => (o?.label ?? o?.value ?? '').toString().trim()).filter(Boolean);
    }
    return input.map(x => (x ?? '').toString().trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      if (parsed.length && typeof parsed[0] === 'object') {
        return parsed.map(o => (o?.label ?? o?.value ?? '').toString().trim()).filter(Boolean);
      }
      return parsed.map(x => (x ?? '').toString().trim()).filter(Boolean);
    }
  } catch (_) {}
  return String(input)
    .replace(/[[\]"]/g, '')
    .split(/[;,\n|]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

const joinOrDash = (arr) =>
  Array.isArray(arr) && arr.length ? arr.join(', ') : '—';

/* =========================
   COMMAND
========================= */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('moje_typy')
    .setDescription('Pokaż Twoje złożone typy — aktualna faza lub ostatnia, w której brałeś udział.')
    .addStringOption(opt =>
      opt.setName('faza')
        .setDescription('Wybierz fazę (opcjonalnie)')
        .addChoices(...PHASE_CHOICES.filter(c => c.value !== 'total'))
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

    await interaction.deferReply({ ephemeral: true });

    return withGuild(guildId, async ({ pool }) => {
      const userId = interaction.user.id;
      const manualPhase = interaction.options.getString('faza');

      try {
        /* =========================
           AUTO-DETEKCJA FAZY
        ========================= */
        let autoPhase = null;
        let autoStage = null;

        // 1️⃣ aktywny panel (TYLKO TEN GUILD)
        const [panels] = await pool.query(
          `
          SELECT phase, stage
          FROM active_panels
          WHERE guild_id = ?
            AND active = 1
          ORDER BY id DESC
          LIMIT 1
          `,
          [guildId]
        );

        if (panels.length) {
          autoPhase = panels[0].phase;
          autoStage = panels[0].stage;
        }

        // 2️⃣ fallback: ostatnia faza, w której user typował (TEN GUILD)
        if (!autoPhase) {
          const [last] = await pool.query(
            `
            SELECT phase, stage FROM (
              SELECT 'swiss' AS phase, stage, submitted_at
              FROM swiss_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL
              SELECT 'playoffs', NULL, submitted_at
              FROM playoffs_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL
              SELECT 'double_elim', NULL, submitted_at
              FROM doubleelim_predictions
              WHERE guild_id = ? AND user_id = ?

              UNION ALL
              SELECT 'playin', NULL, submitted_at
              FROM playin_predictions
              WHERE guild_id = ? AND user_id = ?
            ) t
            ORDER BY submitted_at DESC
            LIMIT 1
            `,
            [guildId, userId, guildId, userId, guildId, userId, guildId, userId]
          );

          if (last.length) {
            autoPhase = last[0].phase;
            autoStage = last[0].stage;
          }
        }

        const phaseToShow = manualPhase || autoPhase;
        if (!phaseToShow) {
          return interaction.editReply({
            content: 'Nie masz żadnych typów i nie ma aktywnej fazy.',
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`Twoje typy — ${humanPhase(phaseToShow)}`)
          .setColor(0x3B82F6);

        /* =========================
           SWISS
        ========================= */
        if (phaseToShow.startsWith('swiss')) {
          const aliases = getSwissStageAliases(phaseToShow);

          let sql = `
            SELECT *
            FROM swiss_predictions
            WHERE guild_id = ?
              AND user_id = ?
          `;
          const params = [guildId, userId];

          if (aliases.length) {
            sql += ` AND stage IN (${aliases.map(() => '?').join(', ')})`;
            params.push(...aliases);
          }

          sql += ` ORDER BY id DESC LIMIT 1`;

          const [rows] = await pool.query(sql, params);

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];
          embed.addFields(
            { name: '3-0 (2)', value: joinOrDash(parseList(r.pick_3_0)) },
            { name: '0-3 (2)', value: joinOrDash(parseList(r.pick_0_3)) },
            { name: 'Awansujące (6)', value: joinOrDash(parseList(r.advancing)) },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           PLAYOFFS
        ========================= */
        if (phaseToShow === 'playoffs') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playoffs_predictions
            WHERE guild_id = ? AND user_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];
          embed.addFields(
            { name: 'Półfinaliści (4)', value: joinOrDash(parseList(r.semifinalists)) },
            { name: 'Finaliści (2)', value: joinOrDash(parseList(r.finalists)) },
            { name: 'Zwycięzca', value: joinOrDash(parseList(r.winner)), inline: true },
            { name: '3. miejsce', value: joinOrDash(parseList(r.third_place_winner)), inline: true },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           DOUBLE ELIM
        ========================= */
        if (phaseToShow === 'double_elim') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM doubleelim_predictions
            WHERE guild_id = ? AND user_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          const r = rows[0];
          embed.addFields(
            { name: 'Upper Final A (2)', value: joinOrDash(parseList(r.upper_final_a)) },
            { name: 'Lower Final A (2)', value: joinOrDash(parseList(r.lower_final_a)) },
            { name: 'Upper Final B (2)', value: joinOrDash(parseList(r.upper_final_b)) },
            { name: 'Lower Final B (2)', value: joinOrDash(parseList(r.lower_final_b)) },
          );

          return interaction.editReply({ embeds: [embed] });
        }

        /* =========================
           PLAY-IN
        ========================= */
        if (phaseToShow === 'playin') {
          const [rows] = await pool.query(
            `
            SELECT *
            FROM playin_predictions
            WHERE guild_id = ? AND user_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, userId]
          );

          if (!rows.length) {
            return interaction.editReply({
              embeds: [embed.setDescription('Brak zapisanych typów dla tej fazy.')],
            });
          }

          embed.addFields({
            name: 'Wytypowane drużyny',
            value: joinOrDash(parseList(rows[0].teams)),
          });

          return interaction.editReply({ embeds: [embed] });
        }

        return interaction.editReply({
          embeds: [embed.setDescription('Nieobsługiwana faza.')],
        });

      } catch (err) {
        console.error('[moje_typy] error', err);
        return interaction.editReply({
          content: '⚠️ Wystąpił błąd podczas pobierania typów.',
        });
      }
    });
  },
};
