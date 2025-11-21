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
    .setDescription('Pokaż Twoje złożone typy dla wybranej fazy.')
    .addStringOption(opt =>
      opt.setName('faza')
        .setDescription('Wybierz etap/fazę turnieju')
        .addChoices(...PHASE_CHOICES.filter(c => c.value !== 'total'))
        .setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const phase = interaction.options.getString('faza') || 'playoffs';

    await interaction.deferReply({ ephemeral: true });

    try {
      const title = `Twoje typy — ${humanPhase(phase)}`;
      const embed = new EmbedBuilder().setTitle(title).setColor(0x3B82F6);

      // === SWISS (swiss_predictions) ===
      // Kolumny: pick_3_0, pick_0_3, advancing, submitted_at, stage, active
      if (phase.startsWith('swiss_')) {
        const aliases = getSwissStageAliases(phase);
        // Jeżeli z jakiegoś powodu aliasy puste, użyjemy fallbacku: dowolny stage
        let rows, params, whereStage;
        if (aliases.length) {
          const placeholders = aliases.map(() => '?').join(', ');
          whereStage = `AND stage IN (${placeholders})`;
          params = [userId, ...aliases];
        } else {
          whereStage = ''; // brak filtra po stage
          params = [userId];
        }

        // 1) próbuj po aliasach stage (jeśli są)
        [rows] = await pool.query(
          `SELECT username, displayname, user_id,
                  pick_3_0, pick_0_3, advancing, submitted_at, active, stage
             FROM swiss_predictions
            WHERE user_id = ?
              ${whereStage}
            ORDER BY active DESC, submitted_at DESC
            LIMIT 1`,
          params
        );

        // 2) fallback: jeśli nic nie ma (np. inne nazwy stage w DB) → ostatni dowolny wpis usera
        if (!rows || !rows.length) {
          [rows] = await pool.query(
            `SELECT username, displayname, user_id,
                    pick_3_0, pick_0_3, advancing, submitted_at, active, stage
               FROM swiss_predictions
              WHERE user_id = ?
              ORDER BY active DESC, submitted_at DESC
              LIMIT 1`,
            [userId]
          );
          if (rows && rows.length) {
            const realStage = rows[0].stage || 'unknown';
            embed.setTitle(`Twoje typy — ${humanPhase(phase)} (ostatni zapis z: ${realStage})`);
          }
        }

        if (!rows || !rows.length) {
          embed.setDescription('Brak zapisanych typów dla tej fazy.');
          return interaction.editReply({ embeds: [embed] });
        }

        const r = rows[0];
        const threeZero = parseList(r.pick_3_0);
        const zeroThree = parseList(r.pick_0_3);
        const qualifiers = parseList(r.advancing);

        embed
          .addFields(
            { name: '3-0 (2)', value: joinOrDash(threeZero), inline: false },
            { name: '0-3 (2)', value: joinOrDash(zeroThree), inline: false },
            { name: 'Awansujące (6)', value: joinOrDash(qualifiers), inline: false },
          )
          .setFooter({ text: `Ostatni zapis: ${r.submitted_at || '—'}${r.active ? ' • (AKTYWNE)' : ' • (ARCHIWUM)'} • stage: ${r.stage || '—'}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // === PLAYOFFS (playoffs_predictions) ===
      if (phase === 'playoffs') {
        const [rows] = await pool.query(
          `SELECT username, displayname, user_id,
                  semifinalists, finalists, winner, third_place_winner,
                  submitted_at, active
             FROM playoffs_predictions
            WHERE user_id = ?
            ORDER BY active DESC, submitted_at DESC
            LIMIT 1`,
          [userId]
        );

        if (!rows || !rows.length) {
          embed.setDescription('Brak zapisanych typów dla tej fazy.');
          return interaction.editReply({ embeds: [embed] });
        }

        const r = rows[0];
        const semifinalists = parseList(r.semifinalists);
        const finalists = parseList(r.finalists);
        const winner = joinOrDash(parseList(r.winner));
        const third = joinOrDash(parseList(r.third_place_winner));

        embed
          .addFields(
            { name: 'Półfinaliści (4)', value: joinOrDash(semifinalists), inline: false },
            { name: 'Finaliści (2)', value: joinOrDash(finalists), inline: false },
            { name: 'Zwycięzca', value: winner, inline: true },
            { name: '3. miejsce (opcjonalnie)', value: third, inline: true },
          )
          .setFooter({ text: `Ostatni zapis: ${r.submitted_at || '—'}${r.active ? ' • (AKTYWNE)' : ' • (ARCHIWUM)'}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // === DOUBLE ELIM (doubleelim_predictions) ===
      if (phase === 'double_elim') {
        const [rows] = await pool.query(
          `SELECT username, displayname, user_id,
                  upper_final_a, lower_final_a,
                  upper_final_b, lower_final_b,
                  submitted_at, active
             FROM doubleelim_predictions
            WHERE user_id = ?
            ORDER BY active DESC, submitted_at DESC
            LIMIT 1`,
          [userId]
        );

        if (!rows || !rows.length) {
          embed.setDescription('Brak zapisanych typów dla tej fazy.');
          return interaction.editReply({ embeds: [embed] });
        }

        const r = rows[0];

        embed
          .addFields(
            { name: 'Grupa A — Upper Final (2)', value: joinOrDash(parseList(r.upper_final_a)), inline: false },
            { name: 'Grupa A — Lower Final (2)', value: joinOrDash(parseList(r.lower_final_a)), inline: false },
            { name: 'Grupa B — Upper Final (2)', value: joinOrDash(parseList(r.upper_final_b)), inline: false },
            { name: 'Grupa B — Lower Final (2)', value: joinOrDash(parseList(r.lower_final_b)), inline: false },
          )
          .setFooter({ text: `Ostatni zapis: ${r.submitted_at || '—'}${r.active ? ' • (AKTYWNE)' : ' • (ARCHIWUM)'}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // === PLAY-IN (playin_predictions) ===
      if (phase === 'playin') {
        const [rows] = await pool.query(
          `SELECT username, displayname, user_id,
                  teams, submitted_at, active
             FROM playin_predictions
            WHERE user_id = ?
            ORDER BY active DESC, submitted_at DESC
            LIMIT 1`,
          [userId]
        );

        if (!rows || !rows.length) {
          embed.setDescription('Brak zapisanych typów dla tej fazy.');
          return interaction.editReply({ embeds: [embed] });
        }

        const r = rows[0];
        embed
          .addFields({ name: 'Wytypowane drużyny', value: joinOrDash(parseList(r.teams)), inline: false })
          .setFooter({ text: `Ostatni zapis: ${r.submitted_at || '—'}${r.active ? ' • (AKTYWNE)' : ' • (ARCHIWUM)'}` });

        return interaction.editReply({ embeds: [embed] });
      }

      // Fallback
      embed.setDescription('Nieobsługiwana faza.');
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[moje_typy] Error:', err);
      return interaction.editReply({ content: '⚠️ Wystąpił błąd podczas pobierania typów.' });
    }
  },
};
