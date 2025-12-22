// handlers/matchScoreSelect.js
const pool = require('../db');
const logger = require('../utils/logger');
const { validateScore, computeTotalPoints } = require('../utils/matchScoring');
const userState = require('../utils/matchUserState');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function matchScoreSelect(interaction) {
  try {
    const mode = interaction.customId === 'match_score_select_res' ? 'res' : 'pred';
    const val = interaction.values?.[0];
    if (!val) return interaction.update({ content: '❌ Nie wybrano wyniku.', components: [] });

    // value: MATCHID|A:B
    const [matchIdStr, scoreStr] = val.split('|');
    const matchId = Number(matchIdStr);
    const [aStr, bStr] = String(scoreStr).split(':');
    const a = Number(aStr);
    const b = Number(bStr);

    const [[match]] = await pool.query(
      `SELECT id, phase, team_a, team_b, best_of, is_locked
       FROM matches
       WHERE id=?
       LIMIT 1`,
      [matchId]
    );

    if (!match) return interaction.update({ content: '❌ Nie znaleziono meczu.', components: [] });

    // walidacja wg BO
    const v = validateScore({ a, b, bestOf: match.best_of });
    if (!v.ok) return interaction.update({ content: `❌ ${v.reason}`, components: [] });

    if (mode === 'pred') {
      if (match.is_locked) {
        return interaction.update({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', components: [] });
      }

      await pool.query(
        `INSERT INTO match_predictions (match_id, user_id, pred_a, pred_b)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE pred_a=VALUES(pred_a), pred_b=VALUES(pred_b), updated_at=CURRENT_TIMESTAMP`,
        [matchId, interaction.user.id, a, b]
      );

      // zostawiamy od razu przycisk do wpisania dokładnego wyniku
      userState.set(interaction.user.id, {
        matchId: match.id,
        teamA: match.team_a,
        teamB: match.team_b,
        bestOf: match.best_of,
        phase: match.phase
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('match_user_exact_open')
          .setLabel('🧮 Wpisz dokładny wynik')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({
        content: `✅ Zapisano typ serii: **${match.team_a} ${a}:${b} ${match.team_b}**\nJeśli chcesz, wpisz też dokładny wynik (np. 13:8):`,
        components: [row]
      });
    }

    // === tryb ADMIN: oficjalny wynik + przeliczenie punktów ===
    await pool.query(
      `INSERT INTO match_results (match_id, res_a, res_b)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE res_a=VALUES(res_a), res_b=VALUES(res_b), finished_at=CURRENT_TIMESTAMP`,
      [matchId, a, b]
    );

    // przeliczenie punktów dla wszystkich typów
    // pobierz też typ dokładny (pred_exact_a/pred_exact_b) jeśli istnieje
    let preds = [];
    try {
      const [rows] = await pool.query(
        `SELECT user_id, pred_a, pred_b, pred_exact_a, pred_exact_b
         FROM match_predictions
         WHERE match_id=?`,
        [matchId]
      );
      preds = rows;
    } catch (e) {
      // kompatybilność wstecz, jeśli nie ma jeszcze kolumn pred_exact_a/b
      const [rows] = await pool.query(
        `SELECT user_id, pred_a, pred_b
         FROM match_predictions
         WHERE match_id=?`,
        [matchId]
      );
      preds = rows.map(r => ({ ...r, pred_exact_a: null, pred_exact_b: null }));
    }

    // official exact (np. 13:8) może zostać ustawiony później
    const [[ex]] = await pool.query(
      `SELECT exact_a, exact_b FROM match_results WHERE match_id=? LIMIT 1`,
      [matchId]
    );
    const exactA = ex?.exact_a ?? null;
    const exactB = ex?.exact_b ?? null;

    for (const p of preds) {
      const pts = computeTotalPoints({
        predA: p.pred_a,
        predB: p.pred_b,
        resA: a,
        resB: b,
        predExactA: p.pred_exact_a,
        predExactB: p.pred_exact_b,
        exactA,
        exactB
      });
      await pool.query(
        `INSERT INTO match_points (match_id, user_id, points)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE points=VALUES(points), computed_at=CURRENT_TIMESTAMP`,
        [matchId, p.user_id, pts]
      );
    }

    // zablokuj mecz po wpisaniu wyniku
    await pool.query(`UPDATE matches SET is_locked=1 WHERE id=?`, [matchId]);

    logger.info('matches', 'Official match result saved', { matchId, a, b, computedFor: preds.length });

    return interaction.update({
      content: `✅ Ustawiono wynik: **${match.team_a} ${a}:${b} ${match.team_b}**\nPrzeliczono punkty dla: **${preds.length}** typów. (mecz 🔒)`,
      components: []
    });
  } catch (err) {
    logger.error('matches', 'matchScoreSelect failed', { message: err.message, stack: err.stack });
    return interaction.update({ content: '❌ Błąd przy zapisie.', components: [] }).catch(() => { });
  }
};
