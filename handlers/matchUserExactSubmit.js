// handlers/matchUserExactSubmit.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
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

module.exports = async function matchUserExactSubmit(interaction) {
  const pool = db.getPoolForGuild(interaction.guildId)
  try {
    const ctx = userState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({ content: '❌ Brak kontekstu meczu.', ephemeral: true });
    }

    // ✅ P0: gate
    const gate = await assertPredictionsAllowed({ guildId: interaction.guildId, kind: 'MATCHES' });
    if (!gate.allowed) {
      return interaction.reply({ content: gate.message || '❌ Typowanie jest aktualnie zamknięte.', ephemeral: true });
    }

    const exactA = Number(interaction.fields.getTextInputValue('exact_a'));
    const exactB = Number(interaction.fields.getTextInputValue('exact_b'));

    if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
      return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
    }

    if (exactA === exactB) {
      return interaction.reply({ content: '❌ Na mapie nie może być remisu.', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked, start_time_utc FROM matches WHERE guild_id = ? AND id = ? LIMIT 1`,
      [interaction.guildId, ctx.matchId]
    );

    if (!match) {
      userState.clear(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '❌ Mecz nie istnieje.', ephemeral: true });
    }

    if (isMatchLocked(match)) {
      userState.clear(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '🔒 Typowanie tego meczu jest już zamknięte.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);
    const mapNo = Number(ctx.mapNo || 1);

    // ====== Wybrany wynik serii (opcjonalny, ale jeśli jest to walidujemy) ======
    const targetWinsA = Number.isFinite(Number(ctx.targetWinsA)) ? Number(ctx.targetWinsA) : null;
    const targetWinsB = Number.isFinite(Number(ctx.targetWinsB)) ? Number(ctx.targetWinsB) : null;
    const hasTarget = targetWinsA !== null && targetWinsB !== null;

    // ile map user ma wpisać (główna kontrola 2-0 => 2 mapy)
    const requiredMaps = Math.min(Number(ctx.requiredMaps || maxMaps), maxMaps);

    // aktualne liczniki
    const prevWinsA = Number(ctx.mapWinsA || 0);
    const prevWinsB = Number(ctx.mapWinsB || 0);

    const mapWinner = exactA > exactB ? 'A' : 'B';

    const nextWinsA = prevWinsA + (mapWinner === 'A' ? 1 : 0);
    const nextWinsB = prevWinsB + (mapWinner === 'B' ? 1 : 0);

    // === ZAPIS DOKŁADNEGO WYNIKU MAPY (BO3/BO5) ===
    // Wcześniej nic nie zapisywało się do DB dla BO3/BO5, więc export / staty wyglądały na puste.
    if (maxMaps > 1) {
      try {
        await pool.query(
          `INSERT INTO match_map_predictions (guild_id, match_id, user_id, map_no, pred_exact_a, pred_exact_b)
         VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
           pred_exact_a=VALUES(pred_exact_a),
           pred_exact_b=VALUES(pred_exact_b),
           updated_at=CURRENT_TIMESTAMP`,
          [interaction.guildId, match.id, interaction.user.id, mapNo, exactA, exactB]
        );
      } catch (e) {
        // Jeśli ktoś nie ma tej tabeli w DB, nie ubijamy całego flow.
        logger?.warn?.('matches', 'match_map_predictions table missing or insert failed', { message: e.message });
      }
    }

    // ---- WALIDACJA SPÓJNOŚCI Z WYBRANYM WYNIKIEM SERII ----
    if (hasTarget) {
      // 1) nie można przekroczyć docelowych wygranych map
      if (nextWinsA > targetWinsA || nextWinsB > targetWinsB) {
        return interaction.reply({
          content: `❌ Ten wynik mapy nie pasuje do wybranego wyniku serii (**${targetWinsA}-${targetWinsB}**).\nPopraw mapę **#${mapNo}**.`,
          ephemeral: true,
        });
      }

      // 2) jeśli to ostatnia wpisywana mapa, wynik MUSI się zgadzać co do mapWon
      const isLastMapByPlan = mapNo >= requiredMaps;
      if (isLastMapByPlan && (nextWinsA !== targetWinsA || nextWinsB !== targetWinsB)) {
        return interaction.reply({
          content: `❌ Po ostatniej mapie wynik serii musi wyjść **${targetWinsA}-${targetWinsB}**.\nTeraz wychodzi **${nextWinsA}-${nextWinsB}** — popraw mapę **#${mapNo}**.`,
          ephemeral: true,
        });
      }
    }

    // === ZAPIS DO DB ===
    if (maxMaps === 1) {
      // BO1: pred_a/pred_b to "mapy" (1-0 albo 0-1) wynikające ze zwycięzcy
      const predA = exactA > exactB ? 1 : 0;
      const predB = exactB > exactA ? 1 : 0;

      await pool.query(
        `INSERT INTO match_predictions (guild_id, match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pred_a=VALUES(pred_a),
       pred_b=VALUES(pred_b),
       pred_exact_a=VALUES(pred_exact_a),
       pred_exact_b=VALUES(pred_exact_b),
       updated_at=CURRENT_TIMESTAMP`,
        [interaction.guildId, match.id, interaction.user.id, predA, predB, exactA, exactB]
      );
    }

    // BO3 => 2, BO5 => 3 (bezpiecznik, nawet jak requiredMaps źle ustawione)
    const winsNeeded = maxMaps === 1 ? 1 : (maxMaps === 3 ? 2 : 3);

    // zapisujemy stan po tej mapie
    userState.set(interaction.guildId, interaction.user.id, {
      ...ctx,
      matchId: match.id,
      mapNo,
      requiredMaps,
      mapWinsA: nextWinsA,
      mapWinsB: nextWinsB,
    });

    const cur = userState.get(interaction.guildId, interaction.user.id) || ctx;

    const shouldFinish =
      (mapNo >= requiredMaps) ||
      (nextWinsA >= winsNeeded) ||
      (nextWinsB >= winsNeeded);

    if (!shouldFinish) {
      const nextMapNo2 = mapNo + 1;

      userState.set(interaction.guildId, interaction.user.id, {
        ...cur,
        matchId: match.id,
        mapNo: nextMapNo2,
        requiredMaps,
        mapWinsA: nextWinsA,
        mapWinsB: nextWinsB,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`match_exact_open:${match.id}:${nextMapNo2}`)
          .setLabel(`Wpisz mapę #${nextMapNo2}`)
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content: `✅ Zapisano wynik mapy **#${mapNo}**.\nKliknij poniżej, aby wpisać mapę **#${nextMapNo2}**.`,
        components: [row],
        ephemeral: true,
      });
    }

    // KONIEC FLOW
    userState.clear(interaction.guildId, interaction.user.id);

    return interaction.reply({
      content:
        maxMaps === 1
          ? `✅ Zapisano dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`
          : `✅ Zapisano dokładne wyniki dla BO${match.best_of} (wpisano mapy 1–${requiredMaps}).`,
      ephemeral: true,
    });
  } catch (err) {
    logger?.error?.('matches', 'matchUserExactSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać wyniku.', ephemeral: true }).catch(() => { });
  }
};
