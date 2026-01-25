const logger = require('../utils/logger');
const { validateScore } = require('../utils/matchScoring');
const userState = require('../utils/matchUserState');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');
const { withGuild } = require('../utils/guildContext');

module.exports = async function matchScoreSelect(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.update({
        content: '❌ Brak kontekstu serwera.',
        components: []
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const mode =
        interaction.customId === 'match_score_select_res' ? 'res' : 'pred';

      const val = interaction.values?.[0];
      if (!val) {
        return interaction.update({
          content: '❌ Nie wybrano wyniku.',
          components: []
        });
      }

      const [guildIdFromValue, matchIdStr, scoreStr] = val.split('|');

      if (guildIdFromValue !== guildId) {
        return interaction.update({
          content: '❌ Błędny kontekst serwera.',
          components: []
        });
      }

      const matchId = Number(matchIdStr);
      const [aStr, bStr] = String(scoreStr || '').split(':');
      const a = Number(aStr);
      const b = Number(bStr);

      // 🔒 GUILD-SAFE SELECT
      const [[match]] = await pool.query(
        `
        SELECT id, phase, team_a, team_b, best_of, is_locked
        FROM matches
        WHERE guild_id = ? AND id = ?
        LIMIT 1
        `,
        [guildId, matchId]
      );

      if (!match) {
        return interaction.update({
          content: '❌ Nie znaleziono meczu.',
          components: []
        });
      }

      const v = validateScore({ a, b, bestOf: match.best_of });
      if (!v.ok) {
        return interaction.update({
          content: `❌ ${v.reason}`,
          components: []
        });
      }

      // ================= USER =================
      if (mode === 'pred') {
        if (match.is_locked) {
          return interaction.update({
            content: '🔒 Ten mecz jest zablokowany (nie można już typować).',
            components: []
          });
        }

        const gate = await assertPredictionsAllowed({
          guildId,
          kind: 'MATCHES'
        });

        if (!gate.allowed) {
          return interaction.update({
            content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
            components: []
          });
        }

        await pool.query(
          `
          INSERT INTO match_predictions (guild_id, match_id, user_id, pred_a, pred_b)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            pred_a = VALUES(pred_a),
            pred_b = VALUES(pred_b),
            updated_at = CURRENT_TIMESTAMP
          `,
          [guildId, matchId, interaction.user.id, a, b]
        );

        userState.set(guildId, interaction.user.id, {
          matchId: match.id,
          teamA: match.team_a,
          teamB: match.team_b,
          bestOf: match.best_of,
          phase: match.phase
        });

        return interaction.update({
          content: `✅ Zapisano typ serii: **${match.team_a} ${a}:${b} ${match.team_b}**`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('match_user_exact_open')
                .setLabel('🧮 Wpisz dokładny wynik')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      // ================= ADMIN =================
      await pool.query(
        `
        INSERT INTO match_results (guild_id, match_id, res_a, res_b)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          res_a = VALUES(res_a),
          res_b = VALUES(res_b),
          finished_at = CURRENT_TIMESTAMP
        `,
        [guildId, matchId, a, b]
      );

      await pool.query(
        `
        UPDATE matches
        SET is_locked = 1
        WHERE guild_id = ? AND id = ?
        `,
        [guildId, matchId]
      );

      logger.info('matches', 'Official match result saved', {
        guild_id: guildId,
        matchId,
        a,
        b,
        by: interaction.user?.id
      });

      return interaction.update({
        content:
          `✅ Ustawiono wynik: **${match.team_a} ${a}:${b} ${match.team_b}**\n` +
          `➡️ Punkty zostaną przeliczone przez **calculateScores**.`,
        components: []
      });
    });

  } catch (err) {
    logger.error('matches', 'matchScoreSelect failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.update({
      content: '❌ Błąd przy zapisie wyniku.',
      components: []
    }).catch(() => {});
  }
};
