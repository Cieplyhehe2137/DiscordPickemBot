// handlers/matchScoreSelectPred.js
const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');
const { isMatchLocked } = require('../utils/matchLock');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

module.exports = async function matchScoreSelectPred(interaction) {
  try {
    const picked = interaction.values?.[0]; // value: `${match.id}|${o.value}`
    if (!picked) return interaction.update({ content: '❌ Nie wybrano typu.', components: [] });

    const [matchIdRaw, scoreRaw] = picked.split('|'); // scoreRaw np. "2:0"
    const matchId = Number(matchIdRaw);

    const [winAraw, winBraw] = String(scoreRaw || '').split(':');
    const winA = Number(winAraw);
    const winB = Number(winBraw);

    if (!Number.isFinite(matchId) || matchId <= 0 || !Number.isFinite(winA) || !Number.isFinite(winB)) {
      return interaction.update({ content: '❌ Niepoprawna wartość typu.', components: [] });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked, start_time_utc, phase
       FROM matches
       WHERE id=?
       LIMIT 1`,
      [matchId]
    );

    if (!match) {
      return interaction.update({ content: '❌ Nie znaleziono meczu.', components: [] });
    }
    if (isMatchLocked(match)) {
      return interaction.update({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', components: [] });
    }

    // ✅ P0: gate
    const gate = await assertPredictionsAllowed({ guildId: interaction.guildId, kind: 'MATCHES' });
    if (!gate.allowed) {
      return interaction.update({ content: gate.message || '❌ Typowanie jest aktualnie zamknięte.', components: [] });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    // requiredMaps: 2-0 => 2, 2-1 => 3, 3-1 => 4 itd.
    const requiredMaps = Math.min(winA + winB, maxMaps);

    // === KLUCZOWE: ZAPISZ TYP SERII DO DB ===
    // Bez tego match_predictions zostaje puste, więc export i rankingi "nic nie widzą".
    // Dodatkowo: jeśli user zmieni serię, czyścimy pred_exact_* (żeby nie trzymać niespójnych danych).
    await pool.query(
      `INSERT INTO match_predictions (match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b)
   VALUES (?, ?, ?, ?, NULL, NULL)
   ON DUPLICATE KEY UPDATE
     pred_a=VALUES(pred_a),
     pred_b=VALUES(pred_b),
     pred_exact_a=NULL,
     pred_exact_b=NULL,
     updated_at=CURRENT_TIMESTAMP`,
      [match.id, interaction.user.id, winA, winB]
    );

    // zapis do state (to jest to, czego potrzebuje matchUserExactSubmit)
    const prev = userState.get(interaction.guildId, interaction.user.id) || {};
    userState.set(interaction.guildId, interaction.user.id, {
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
      mapWinsB: 0,
    });

    // Nie musimy zmieniać UI – wystarczy potwierdzenie.
    // Zostawiamy components jak były, tylko dopisujemy info w content.
    return interaction.update({
      content: `🎯 Typujesz: **${match.team_a} ${winA}:${winB} ${match.team_b}** (Bo${match.best_of})\nMożesz teraz kliknąć **🧮 Wpisz dokładny wynik** i wpiszesz tylko potrzebne mapy.`,
      components: interaction.message.components,
    });
  } catch (err) {
    logger.error('matches', 'matchScoreSelectPred failed', { message: err.message, stack: err.stack });
    return interaction.update({ content: '❌ Błąd przy wyborze typu.', components: [] }).catch(() => { });
  }
};
