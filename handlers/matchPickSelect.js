const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');
const { scoreOptionsForBo } = require('../utils/scoreOptions');
const { sendMatchList } = require('./openMatchPick');
const userState = require('../utils/matchUserState');
const { isMatchLocked } = require('../utils/matchLock');

module.exports = async function matchPickSelect(interaction) {
  try {
    if (!interaction.isStringSelectMenu()) return;

    const mode =
      interaction.customId === 'match_pick_select_res' ? 'res' : 'pred';

    const picked = interaction.values?.[0];
    if (!picked) {
      return interaction.update({
        content: '❌ Nie wybrano opcji',
        components: []
      });
    }

    const [type, phaseKey, third] = picked.split('|');

    // ===============================
    // PAGINACJA
    // ===============================
    if (type === 'NEXT') {
      const nextPage = Number(third || 0);
      return sendMatchList({
        interaction,
        phaseKey,
        mode,
        page: nextPage,
        isUpdate: true
      });
    }

    if (type !== 'MATCH') {
      return interaction.update({
        content: '❌ Nieznana opcja',
        components: []
      });
    }

    const matchId = Number(third);

    await withGuild(interaction, async (pool, guildId) => {
      // ===============================
      // POBIERZ MECZ (PER GUILD)
      // ===============================
      const [[match]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked, start_time_utc
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

      if (mode === 'pred' && isMatchLocked(match)) {
        return interaction.update({
          content: '🔒 Ten mecz jest zablokowany (nie można już typować).',
          components: []
        });
      }

      // ===============================
      // OPCJE WYNIKU
      // ===============================
      const options = scoreOptionsForBo(
        match.best_of,
        match.team_a,
        match.team_b
      );

      if (!options.length) {
        return interaction.update({
          content: '❌ Nieobsługiwany format BO w tym meczu',
          components: []
        });
      }

      const scoreOptions = options.map(o => ({
        label: o.label,
        value: `${match.id}|${o.value}`
      }));

      const scoreCustomId =
        mode === 'res'
          ? 'match_score_select_res'
          : 'match_score_select_pred';

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(scoreCustomId)
          .setPlaceholder(
            mode === 'res'
              ? 'Wybierz oficjalny wynik...'
              : 'Wybierz swój typ...'
          )
          .addOptions(scoreOptions)
      );

      // ===============================
      // DODATKOWY PRZYCISK (PRED)
      // ===============================
      let extraRows = [];

      if (mode === 'pred') {
        userState.set(guildId, interaction.user.id, {
          matchId: match.id,
          teamA: match.team_a,
          teamB: match.team_b,
          bestOf: match.best_of,
          phase: phaseKey
        });

        extraRows.push(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('match_user_exact_open')
              .setLabel('🧮 Wpisz dokładny wynik')
              .setStyle(ButtonStyle.Secondary)
          )
        );
      }

      return interaction.update({
        content:
          mode === 'res'
            ? `🧾 Ustaw oficjalny wynik: **${match.team_a} vs ${match.team_b}** (Bo${match.best_of})`
            : `🎯 Typujesz mecz: **${match.team_a} vs ${match.team_b}** (Bo${match.best_of})`,
        components: [row, ...extraRows]
      });
    });
  } catch (err) {
    logger.error('matches', 'matchPickSelect failed', {
      message: err.message,
      stack: err.stack
    });

    try {
      return interaction.update({
        content: '❌ Błąd w wyborze meczu.',
        components: []
      });
    } catch (_) {}
  }
};
