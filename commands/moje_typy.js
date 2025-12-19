// commands/moje_typy.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db.js');
const { PHASE_CHOICES, humanPhase, getSwissStageAliases } = require('../utils/phase');

// Helpery
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

function joinOrDash(arr) {
  return Array.isArray(arr) && arr.length ? arr.join(', ') : '—';
}

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
    const userId = interaction.user.id;
    const manualPhase = interaction.options.getString('faza'); // użytkownik wybrał ręcznie?

    await interaction.deferReply({ ephemeral: true });

    try {
      // ============================================================
      // 🔍 AUTO-DETEKCJA FAZY
      // ============================================================

      let autoPhase = null;
      let autoStage = null;

      // 1) aktywny panel
      const [activePanels] = await pool.query(
        `SELECT phase, stage
         FROM active_panels
         WHERE active = 1
         ORDER BY id DESC
         LIMIT 1`
      );

      if (activePanels.length > 0) {
        autoPhase = activePanels[0].phase;
        autoStage = activePanels[0].stage;
      }

      // 2) jeśli brak aktywnego — ostatnia faza, w której user typował
      if (!autoPhase) {
        const [last] = await pool.query(`
          SELECT phase, stage FROM (
            SELECT 'swiss' AS phase, stage, submitted_at FROM swiss_predictions WHERE user_id = ?
            UNION ALL
            SELECT 'playoffs', NULL AS stage, submitted_at FROM playoffs_predictions WHERE user_id = ?
            UNION ALL
            SELECT 'double_elim', NULL AS stage, submitted_at FROM doubleelim_predictions WHERE user_id = ?
            UNION ALL
            SELECT 'playin', NULL AS stage, submitted_at FROM playin_predictions WHERE user_id = ?
          ) t
          ORDER BY submitted_at DESC
          LIMIT 1
        `, [userId, userId, userId, userId]);

        if (last.length > 0) {
          autoPhase = last[0].phase;
          autoStage = last[0].stage;
        }
      }

      // 3) wybór finalnej fazy
      const phaseToShow = manualPhase || autoPhase;

      if (!phaseToShow) {
        return interaction.editReply({
          content: 'Nie masz żadnych typów i nie ma aktywnej fazy.',
          ephemeral: true
        });
      }

      const title = `Twoje typy — ${humanPhase(phaseToShow)}`;
      const embed = new EmbedBuilder().setTitle(title).setColor(0x3B82F6);

      // ============================================================
      // === SWISS ===================================================
      // ============================================================
      if (phaseToShow.startsWith('swiss')) {
        const aliases = getSwissStageAliases(phaseToShow);

        let rows, params, whereStage;
        if (aliases.length) {
          const placeholders = aliases.map(() => '?').join(', ');
          whereStage = `AND stage IN (${placeholders})`;
          params = [userId, ...aliases];
        } else {
          whereStage = '';
          params = [userId];
        }

        [rows] = await pool.query(
          `SELECT *
           FROM swiss_predictions
           WHERE user_id = ?
           ${whereStage}
           ORDER BY submitted_at DESC
           LIMIT 1`,
          params
        );

        if (!rows.length) {
          return interaction.editReply({
            embeds: [
              embed.setDescription('Brak zapisanych typów dla tej fazy.')
            ]
          });
        }

        const r = rows[0];
        embed.addFields(
          { name: '3-0 (2)', value: joinOrDash(parseList(r.pick_3_0)), inline: false },
          { name: '0-3 (2)', value: joinOrDash(parseList(r.pick_0_3)), inline: false },
          { name: 'Awansujące (6)', value: joinOrDash(parseList(r.advancing)), inline: false },
        );
        embed.setFooter({ text: `Ostatni zapis: ${r.submitted_at} • stage: ${r.stage}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // ============================================================
      // === PLAYOFFS ===============================================
      // ============================================================
      if (phaseToShow === 'playoffs') {
        const [rows] = await pool.query(
          `SELECT *
           FROM playoffs_predictions
           WHERE user_id = ?
           ORDER BY submitted_at DESC
           LIMIT 1`,
          [userId]
        );

        if (!rows.length) {
          return interaction.editReply({
            embeds: [
              embed.setDescription('Brak zapisanych typów dla tej fazy.')
            ]
          });
        }

        const r = rows[0];

        embed.addFields(
          { name: 'Półfinaliści (4)', value: joinOrDash(parseList(r.semifinalists)), inline: false },
          { name: 'Finaliści (2)', value: joinOrDash(parseList(r.finalists)), inline: false },
          { name: 'Zwycięzca', value: joinOrDash(parseList(r.winner)), inline: true },
          { name: '3. miejsce', value: joinOrDash(parseList(r.third_place_winner)), inline: true }
        );

        embed.setFooter({ text: `Ostatni zapis: ${r.submitted_at}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // ============================================================
      // === DOUBLE ELIM ============================================
      // ============================================================
      if (phaseToShow === 'double_elim') {
        const [rows] = await pool.query(
          `SELECT *
           FROM doubleelim_predictions
           WHERE user_id = ?
           ORDER BY submitted_at DESC
           LIMIT 1`,
          [userId]
        );

        if (!rows.length) {
          return interaction.editReply({
            embeds: [
              embed.setDescription('Brak zapisanych typów dla tej fazy.')
            ]
          });
        }

        const r = rows[0];

        embed.addFields(
          { name: 'Upper Final – Grupa A (2)', value: joinOrDash(parseList(r.upper_final_a)), inline: false },
          { name: 'Lower Final – Grupa A (2)', value: joinOrDash(parseList(r.lower_final_a)), inline: false },
          { name: 'Upper Final – Grupa B (2)', value: joinOrDash(parseList(r.upper_final_b)), inline: false },
          { name: 'Lower Final – Grupa B (2)', value: joinOrDash(parseList(r.lower_final_b)), inline: false }
        );

        embed.setFooter({ text: `Ostatni zapis: ${r.submitted_at}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // ============================================================
      // === PLAY-IN =================================================
      // ============================================================
      if (phaseToShow === 'playin') {
        const [rows] = await pool.query(
          `SELECT *
           FROM playin_predictions
           WHERE user_id = ?
           ORDER BY submitted_at DESC
           LIMIT 1`,
          [userId]
        );

        if (!rows.length) {
          return interaction.editReply({
            embeds: [
              embed.setDescription('Brak zapisanych typów dla tej fazy.')
            ]
          });
        }

        const r = rows[0];

        embed.addFields({
          name: 'Wytypowane drużyny',
          value: joinOrDash(parseList(r.teams)),
          inline: false
        });

        embed.setFooter({ text: `Ostatni zapis: ${r.submitted_at}` });

        return interaction.editReply({ embeds: [embed] });
      }

      return interaction.editReply({
        embeds: [embed.setDescription('Nieobsługiwana faza.')]
      });

    } catch (err) {
      console.error('[moje_typy] Error:', err);
      return interaction.editReply({
        content: '⚠️ Wystąpił błąd podczas pobierania typów.'
      });
    }
  },
};
