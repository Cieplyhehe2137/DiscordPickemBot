// handlers/matchUserExactSubmit.js
const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

module.exports = async function matchUserExactSubmit(interaction) {
  try {
    const ctx = userState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz (Typuj wyniki meczów).',
        ephemeral: true
      });
    }

    const exactA = Number(interaction.fields.getTextInputValue('exact_a'));
    const exactB = Number(interaction.fields.getTextInputValue('exact_b'));

    if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
      return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      userState.clear(interaction.user.id);
      return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie.', ephemeral: true });
    }
    if (match.is_locked) {
      return interaction.reply({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);
    const mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 0);

    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
      return interaction.reply({
        content: '❌ Nie wybrano mapy. Kliknij 🧮 Wpisz dokładny wynik i wybierz mapę.',
        ephemeral: true
      });
    }

    if (maxMaps === 1) {
      // BO1 -> trzymamy w match_predictions (kompatybilność)
      await pool.query(
        `INSERT INTO match_predictions (match_id, user_id, pred_exact_a, pred_exact_b)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           pred_exact_a=VALUES(pred_exact_a),
           pred_exact_b=VALUES(pred_exact_b),
           updated_at=CURRENT_TIMESTAMP`,
        [match.id, interaction.user.id, exactA, exactB]
      );
    } else {
      // BO3/BO5 -> per mapa
      await pool.query(
        `INSERT INTO match_map_predictions (match_id, user_id, map_no, pred_exact_a, pred_exact_b)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           pred_exact_a=VALUES(pred_exact_a),
           pred_exact_b=VALUES(pred_exact_b),
           updated_at=CURRENT_TIMESTAMP`,
        [match.id, interaction.user.id, mapNo, exactA, exactB]
      );
    }

    logger?.info?.('matches', 'User exact saved', {
      userId: interaction.user.id,
      matchId: match.id,
      mapNo,
      exactA,
      exactB
    });

    return interaction.reply({
      content:
        maxMaps === 1
          ? `✅ Zapisano dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`
          : `✅ Zapisano dokładny wynik (mapa #${mapNo}): **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`,
      ephemeral: true
    });
  } catch (err) {
    logger?.error?.('matches', 'matchUserExactSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać wyniku.', ephemeral: true }).catch(() => {});
  }
};
