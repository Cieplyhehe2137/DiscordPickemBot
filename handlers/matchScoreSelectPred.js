const { logInfo, logWarn, logError } = require('../utils/logger');
const userState = require('../utils/matchUserState');
const { isMatchLocked } = require('../utils/matchLock');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');
const { withGuild } = require('../utils/guildContext');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

module.exports = async function matchScoreSelectPred(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.update({
        content: '❌ Brak kontekstu serwera.',
        components: []
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const picked = interaction.values?.[0];
      if (!picked) {
        return interaction.update({
          content: '❌ Nie wybrano typu.',
          components: []
        });
      }

      const [guildIdFromValue, matchIdRaw, scoreRaw] = picked.split('|');

      if (guildIdFromValue !== guildId) {
        return interaction.update({
          content: '❌ Błędny kontekst serwera.',
          components: []
        });
      }

      const matchId = Number(matchIdRaw);
      const [winAraw, winBraw] = String(scoreRaw || '').split(':');
      const winA = Number(winAraw);
      const winB = Number(winBraw);

      if (
        !Number.isInteger(matchId) ||
        matchId <= 0 ||
        !Number.isInteger(winA) ||
        !Number.isInteger(winB)
      ) {
        return interaction.update({
          content: '❌ Niepoprawna wartość typu.',
          components: []
        });
      }

      // 🔒 GUILD-SAFE SELECT
      const [[match]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked, start_time_utc, phase
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

      if (isMatchLocked(match)) {
        return interaction.update({
          content: '🔒 Ten mecz jest zablokowany (nie można już typować).',
          components: []
        });
      }

      // 🔐 global gate (np. deadline)
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

      const maxMaps = maxMapsFromBo(match.best_of);
      const requiredMaps = Math.min(winA + winB, maxMaps);

      // ✅ zapis typowania SERII
      await pool.query(
        `
        INSERT INTO match_predictions
          (guild_id, match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b)
        VALUES (?, ?, ?, ?, ?, NULL, NULL)
        ON DUPLICATE KEY UPDATE
          pred_a = VALUES(pred_a),
          pred_b = VALUES(pred_b),
          pred_exact_a = NULL,
          pred_exact_b = NULL,
          updated_at = CURRENT_TIMESTAMP
        `,
        [guildId, match.id, interaction.user.id, winA, winB]
      );

      const prev = userState.get(guildId, interaction.user.id) || {};
      userState.set(guildId, interaction.user.id, {
        ...prev,
        matchId: match.id,
        teamA: match.team_a,
        teamB: match.team_b,
        bestOf: match.best_of,
        phase: match.phase,
        mapNo: 1,
        requiredMaps,
        targetWinsA: winA,
        targetWinsB: winB,
        mapWinsA: 0,
        mapWinsB: 0
      });

      return interaction.update({
        content:
          `🎯 Typujesz: **${match.team_a} ${winA}:${winB} ${match.team_b}** (BO${match.best_of})\n` +
          `Możesz teraz kliknąć **🧮 Wpisz dokładny wynik**.`,
        components: interaction.message.components
      });
    });

  } catch (err) {
    logError('matches', 'matchScoreSelectPred failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.update({
      content: '❌ Błąd przy wyborze typu.',
      components: []
    }).catch(() => {});
  }
};
