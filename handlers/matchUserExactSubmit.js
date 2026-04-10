const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');
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

function getRequiredMapsFromSeries(targetWinsA, targetWinsB, maxMaps) {
  if (
    Number.isInteger(targetWinsA) &&
    Number.isInteger(targetWinsB) &&
    targetWinsA >= 0 &&
    targetWinsB >= 0
  ) {
    const totalMaps = targetWinsA + targetWinsB;

    if (totalMaps >= 1 && totalMaps <= maxMaps) {
      return totalMaps;
    }
  }

  return maxMaps;
}

function validateScore(a, b) {
  const scoreA = Number(a);
  const scoreB = Number(b);

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return 'Wynik musi być liczbą całkowitą.';
  }

  if (scoreA < 0 || scoreB < 0) {
    return 'Wynik nie może być ujemny.';
  }

  if (scoreA === scoreB) {
    return 'Na mapie nie może być remisu.';
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);

  // Regulaminowy czas: 13:0 do 13:11
  if (winner === 13 && loser <= 11) {
    return null;
  }

  // OT: 16:14, 19:17, 22:20, 25:23 itd.
  if (
    winner >= 16 &&
    winner - loser === 2 &&
    (winner - 16) % 3 === 0 &&
    (loser - 14) % 3 === 0
  ) {
    return null;
  }

  return 'Nieprawidłowy wynik mapy CS2. Dozwolone np. 13:8, 13:11, 16:14, 19:17.';
}

module.exports = async function matchUserExactSubmit(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Brak kontekstu serwera.',
        ephemeral: true
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const ctx = userState.get(guildId, interaction.user.id);
      if (!ctx?.matchId) {
        return interaction.reply({
          content: '❌ Brak kontekstu meczu.',
          ephemeral: true
        });
      }

      const gate = await assertPredictionsAllowed({
        guildId,
        kind: 'MATCHES'
      });

      if (!gate.allowed) {
        return interaction.reply({
          content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
          ephemeral: true
        });
      }

      const exactARaw = interaction.fields.getTextInputValue('exact_a');
      const exactBRaw = interaction.fields.getTextInputValue('exact_b');

      const validationError = validateScore(exactARaw, exactBRaw);
      if (validationError) {
        return interaction.reply({
          content: `❌ ${validationError}`,
          ephemeral: true
        });
      }

      const exactA = Number(exactARaw);
      const exactB = Number(exactBRaw);

      const [[match]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked, start_time_utc
        FROM matches
        WHERE guild_id = ? AND id = ?
        LIMIT 1
        `,
        [guildId, ctx.matchId]
      );

      if (!match) {
        userState.clear(guildId, interaction.user.id);
        return interaction.reply({
          content: '❌ Mecz nie istnieje.',
          ephemeral: true
        });
      }

      if (isMatchLocked(match)) {
        userState.clear(guildId, interaction.user.id);
        return interaction.reply({
          content: '🔒 Typowanie tego meczu jest już zamknięte.',
          ephemeral: true
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);
      const mapNo = Number(ctx.mapNo || 1);

      const targetWinsA = Number.isFinite(Number(ctx.targetWinsA))
        ? Number(ctx.targetWinsA)
        : null;
      const targetWinsB = Number.isFinite(Number(ctx.targetWinsB))
        ? Number(ctx.targetWinsB)
        : null;
      const hasTarget = targetWinsA !== null && targetWinsB !== null;

      const requiredMaps = hasTarget
        ? getRequiredMapsFromSeries(targetWinsA, targetWinsB, maxMaps)
        : Math.min(Number(ctx.requiredMaps || maxMaps), maxMaps);

      const prevWinsA = Number(ctx.mapWinsA || 0);
      const prevWinsB = Number(ctx.mapWinsB || 0);

      const mapWinner = exactA > exactB ? 'A' : 'B';
      const nextWinsA = prevWinsA + (mapWinner === 'A' ? 1 : 0);
      const nextWinsB = prevWinsB + (mapWinner === 'B' ? 1 : 0);

      // ===== WALIDACJA SERII =====
      if (hasTarget) {
        if (nextWinsA > targetWinsA || nextWinsB > targetWinsB) {
          return interaction.reply({
            content:
              `❌ Ten wynik mapy nie pasuje do wybranego wyniku serii ` +
              `(**${targetWinsA}-${targetWinsB}**).\nPopraw mapę **#${mapNo}**.`,
            ephemeral: true
          });
        }

        const isLastPlannedMap = mapNo >= requiredMaps;
        if (
          isLastPlannedMap &&
          (nextWinsA !== targetWinsA || nextWinsB !== targetWinsB)
        ) {
          return interaction.reply({
            content:
              `❌ Po ostatniej mapie wynik serii musi wynosić ` +
              `**${targetWinsA}-${targetWinsB}**.\n` +
              `Teraz wychodzi **${nextWinsA}-${nextWinsB}**.`,
            ephemeral: true
          });
        }
      }

      // === BO1 ===
      if (maxMaps === 1) {
        const predA = exactA > exactB ? 1 : 0;
        const predB = exactB > exactA ? 1 : 0;

        await pool.query(
          `
          INSERT INTO match_predictions
            (guild_id, match_id, user_id, pred_a, pred_b, pred_exact_a, pred_exact_b)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            pred_a = VALUES(pred_a),
            pred_b = VALUES(pred_b),
            pred_exact_a = VALUES(pred_exact_a),
            pred_exact_b = VALUES(pred_exact_b),
            updated_at = CURRENT_TIMESTAMP
          `,
          [guildId, match.id, interaction.user.id, predA, predB, exactA, exactB]
        );

        userState.clear(guildId, interaction.user.id);

        return interaction.reply({
          content: `✅ Zapisano dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`,
          ephemeral: true
        });
      }

      const winsNeeded = maxMaps === 3 ? 2 : 3;
      const shouldFinish =
        mapNo >= requiredMaps ||
        nextWinsA >= winsNeeded ||
        nextWinsB >= winsNeeded;

      // === ZAPIS MAPY (dopiero po pełnej walidacji) ===
      try {
        await pool.query(
          `
          INSERT INTO match_map_predictions
            (guild_id, match_id, user_id, map_no, pred_exact_a, pred_exact_b)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            pred_exact_a = VALUES(pred_exact_a),
            pred_exact_b = VALUES(pred_exact_b),
            updated_at = CURRENT_TIMESTAMP
          `,
          [guildId, match.id, interaction.user.id, mapNo, exactA, exactB]
        );
      } catch (e) {
        logger.warn('matches', 'match_map_predictions insert failed', {
          message: e.message
        });

        return interaction.reply({
          content: '❌ Nie udało się zapisać wyniku mapy.',
          ephemeral: true
        });
      }

      if (!shouldFinish) {
        const nextMapNo = mapNo + 1;

        userState.set(guildId, interaction.user.id, {
          ...ctx,
          matchId: match.id,
          mapNo: nextMapNo,
          requiredMaps,
          mapWinsA: nextWinsA,
          mapWinsB: nextWinsB
        });

        return interaction.reply({
          content:
            `✅ Zapisano wynik mapy **#${mapNo}**.\n` +
            `Kliknij poniżej, aby wpisać mapę **#${nextMapNo}**.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`match_exact_open:${match.id}:${nextMapNo}`)
                .setLabel(`Wpisz mapę #${nextMapNo}`)
                .setStyle(ButtonStyle.Primary)
            )
          ],
          ephemeral: true
        });
      }

      userState.clear(guildId, interaction.user.id);

      return interaction.reply({
        content: `✅ Zapisano dokładne wyniki dla BO${match.best_of} (mapy 1–${requiredMaps}).`,
        ephemeral: true
      });
    });
  } catch (err) {
    logger.error('matches', 'matchUserExactSubmit failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się zapisać wyniku.',
      ephemeral: true
    }).catch(() => {});
  }
};