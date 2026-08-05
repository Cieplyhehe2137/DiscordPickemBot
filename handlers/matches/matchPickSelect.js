const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { logInfo, logError } = require('../../utils/logger');
const { withGuild } = require('../../utils/guildContext');
const { scoreOptionsForBo } = require('../../utils/scoreOptions');
const { sendMatchList } = require('./openMatchPick');
const userState = require('../../utils/matchUserState');
const { isMatchLocked } = require('../../utils/matchLock');
const { getMapLabel } = require('../../utils/mapLabels');

function formatSavedPrediction(match, prediction, mapPredictions) {
  if (!prediction) {
    return [
      '📋 **Twój zapisany typ**',
      '',
      '🎮 Ten mecz nie został jeszcze wytypowany.'
    ].join('\n');
  }

  const lines = [
    '📋 **Twój zapisany typ**',
    '',
    `🏆 **${match.team_a} ${prediction.pred_a}:${prediction.pred_b} ${match.team_b}**`
  ];

  if (
    Number(match.best_of) === 1 &&
    prediction.pred_exact_a != null &&
    prediction.pred_exact_b != null
  ) {
    lines.push(
      '',
      `🗺️ **Dokładny wynik:** ${match.team_a} ` +
        `**${prediction.pred_exact_a}:${prediction.pred_exact_b}** ` +
        `${match.team_b}`
    );

    return lines.join('\n');
  }

  if (mapPredictions.length > 0) {
    lines.push('', '🗺️ **Wyniki map:**');

    for (const map of mapPredictions) {
      const mapLabel = getMapLabel(
        map.map_no,
        match.best_of,
        match.team_a,
        match.team_b
      );

      lines.push(
        `• **${mapLabel}:** ` +
          `${match.team_a} ${map.pred_exact_a}:${map.pred_exact_b} ${match.team_b}`
      );
    }
  } else {
    lines.push(
      '',
      '⚠️ Nie zapisano jeszcze dokładnych wyników map.'
    );
  }

  return lines.join('\n');
}

module.exports = async function matchPickSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;

    const mode =
      interaction.customId === 'match_pick_select_res'
        ? 'res'
        : 'pred';

    const picked = interaction.values?.[0];

    if (!picked) {
      return interaction.update({
        content: '❌ Nie wybrano opcji.',
        components: []
      });
    }

    logInfo('matches', 'matchPickSelect value', {
      customId: interaction.customId,
      picked
    });

    const [type, phaseKey, third] = picked.split('|');

    if (type === 'NEXT' || type === 'PREV') {
      const targetPage = Math.max(0, Number(third) || 0);

      return sendMatchList({
        interaction,
        phaseKey,
        mode,
        page: targetPage,
        isUpdate: true
      });
    }

    if (type !== 'MATCH') {
      return interaction.update({
        content: '❌ Nieznana opcja.',
        components: []
      });
    }

    const matchId = Number(third);

    if (!matchId) {
      return interaction.update({
        content: '❌ Nieprawidłowy mecz.',
        components: []
      });
    }

    return withGuild(interaction, async ({ pool, guildId }) => {
      const [[match]] = await pool.query(
        `
        SELECT
          id,
          event_id,
          phase,
          team_a,
          team_b,
          best_of,
          is_locked,
          start_time_utc
        FROM matches
        WHERE guild_id = ?
          AND id = ?
          AND phase = ?
        LIMIT 1
        `,
        [guildId, matchId, phaseKey]
      );

      if (!match) {
        return interaction.update({
          content: '❌ Nie znaleziono meczu.',
          components: []
        });
      }

      const locked = isMatchLocked(match);

      let prediction = null;
      let mapPredictions = [];

      if (mode === 'pred') {
        const [[savedPrediction]] = await pool.query(
          `
          SELECT
            pred_a,
            pred_b,
            pred_exact_a,
            pred_exact_b,
            updated_at
          FROM match_predictions
          WHERE guild_id = ?
            AND match_id = ?
            AND user_id = ?
          LIMIT 1
          `,
          [
            guildId,
            match.id,
            interaction.user.id
          ]
        );

        prediction = savedPrediction || null;

        const [savedMaps] = await pool.query(
          `
          SELECT
            map_no,
            pred_exact_a,
            pred_exact_b
          FROM match_map_predictions
          WHERE guild_id = ?
            AND match_id = ?
            AND user_id = ?
          ORDER BY map_no ASC
          `,
          [
            guildId,
            match.id,
            interaction.user.id
          ]
        );

        mapPredictions = savedMaps || [];
      }

      const options = scoreOptionsForBo(
        match.best_of,
        match.team_a,
        match.team_b
      );

      if (!options.length) {
        return interaction.update({
          content: '❌ Nieobsługiwany format BO w tym meczu.',
          components: []
        });
      }

      const scoreOptions = options.map((option) => ({
        label: option.label,
        value: `${guildId}|${match.id}|${option.value}`,
        default:
          mode === 'pred' &&
          prediction != null &&
          `${prediction.pred_a}:${prediction.pred_b}` === option.value
      }));

      const scoreCustomId =
        mode === 'res'
          ? 'match_score_select_res'
          : 'match_score_select_pred';

      const rows = [];

      if (mode === 'res') {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(scoreCustomId)
              .setPlaceholder('Wybierz oficjalny wynik...')
              .addOptions(scoreOptions)
          )
        );
      }

      if (mode === 'pred' && !locked) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(scoreCustomId)
              .setPlaceholder(
                prediction
                  ? 'Zmień swój wynik serii...'
                  : 'Wybierz swój typ...'
              )
              .addOptions(scoreOptions)
          )
        );

        userState.set(guildId, interaction.user.id, {
          matchId: match.id,
          teamA: match.team_a,
          teamB: match.team_b,
          bestOf: match.best_of,
          phase: phaseKey
        });

        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('match_user_exact_open')
              .setLabel(
                prediction
                  ? '✏️ Edytuj wyniki map'
                  : '🧮 Wpisz dokładne wyniki map'
              )
              .setStyle(ButtonStyle.Secondary)
          )
        );
      }

      // Przycisk powrotu pokazujemy również przy zablokowanym meczu.
      if (mode === 'pred') {
        rows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`match_pick_back:${phaseKey}:0`)
              .setLabel('⬅️ Wróć do listy')
              .setStyle(ButtonStyle.Secondary)
          )
        );
      }

      if (mode === 'res') {
        return interaction.update({
          content:
            `🧾 Ustaw oficjalny wynik: ` +
            `**${match.team_a} vs ${match.team_b}** ` +
            `(Bo${match.best_of})`,
          components: rows
        });
      }

      const predictionPreview = formatSavedPrediction(
        match,
        prediction,
        mapPredictions
      );

      let lockInfo;

      if (locked) {
        lockInfo =
          '\n\n🔒 Ten mecz jest już zablokowany. ' +
          'Typ można sprawdzić, ale nie można go edytować.';
      } else if (prediction) {
        lockInfo =
          '\n\n✏️ Możesz zmienić wynik serii lub wyniki map poniżej.';
      } else {
        lockInfo =
          '\n\n👇 Wybierz wynik serii, a następnie wpisz dokładne wyniki map.';
      }

      return interaction.update({
        content:
          `🎯 **${match.team_a} vs ${match.team_b}** ` +
          `(Bo${match.best_of})\n\n` +
          predictionPreview +
          lockInfo,
        components: rows
      });
    });
  } catch (err) {
    logError('matches', 'matchPickSelect failed', {
      message: err.message,
      stack: err.stack
    });

    try {
      return await interaction.update({
        content: '❌ Błąd w wyborze meczu.',
        components: []
      });
    } catch (_) {
      return null;
    }
  }
};