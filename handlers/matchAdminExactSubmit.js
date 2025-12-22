// handlers/matchAdminExactSubmit.js
const pool = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState'); // jeśli nie masz - zrób kopię matchUserState.js

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

module.exports = async function matchAdminExactSubmit(interaction) {
  try {
    const ctx = adminState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz w panelu admina.',
        ephemeral: true
      });
    }

    const exactA = Number(interaction.fields.getTextInputValue('exact_a'));
    const exactB = Number(interaction.fields.getTextInputValue('exact_b'));

    if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
      return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      adminState.clear(interaction.user.id);
      return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);
    const mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 0);

    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
      return interaction.reply({
        content: '❌ Nie wybrano mapy. Wybierz mapę i spróbuj ponownie.',
        ephemeral: true
      });
    }

    if (maxMaps === 1) {
      // BO1 -> match_results.exact_a/b
      // UWAGA: jeśli masz res_a/res_b NOT NULL bez defaultu, to muszą być NULL-owalne (jak wcześniej ustaliliśmy).
      await pool.query(
        `INSERT INTO match_results (match_id, res_a, res_b, exact_a, exact_b)
         VALUES (?, NULL, NULL, ?, ?)
         ON DUPLICATE KEY UPDATE exact_a=VALUES(exact_a), exact_b=VALUES(exact_b)`,
        [match.id, exactA, exactB]
      );
    } else {
      // BO3/BO5 -> per mapa
      await pool.query(
        `INSERT INTO match_map_results (match_id, map_no, exact_a, exact_b)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE exact_a=VALUES(exact_a), exact_b=VALUES(exact_b), updated_at=CURRENT_TIMESTAMP`,
        [match.id, mapNo, exactA, exactB]
      );
    }

    logger?.info?.('matches', 'Admin exact saved', {
      adminId: interaction.user.id,
      matchId: match.id,
      mapNo,
      exactA,
      exactB
    });

    return interaction.reply({
      content:
        maxMaps === 1
          ? `✅ Zapisano oficjalny dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`
          : `✅ Zapisano oficjalny dokładny wynik (mapa #${mapNo}): **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`,
      ephemeral: true
    });
  } catch (err) {
    logger?.error?.('matches', 'matchAdminExactSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać wyniku.', ephemeral: true }).catch(() => {});
  }
};
