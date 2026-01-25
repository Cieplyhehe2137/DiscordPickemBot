const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');
const { assertPredictionsAllowed } = require('../utils/protectionsGuards');
const { withGuild } = require('../utils/guildContext');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

async function getUserDefaults(pool, guildId, matchId, userId, maxMaps, mapNo) {
  if (maxMaps === 1) {
    const [[p]] = await pool.query(
      `
      SELECT pred_exact_a, pred_exact_b
      FROM match_predictions
      WHERE guild_id = ? AND match_id = ? AND user_id = ?
      LIMIT 1
      `,
      [guildId, matchId, userId]
    );
    return { a: p?.pred_exact_a ?? '', b: p?.pred_exact_b ?? '' };
  }

  const [[p]] = await pool.query(
    `
    SELECT pred_exact_a, pred_exact_b
    FROM match_map_predictions
    WHERE guild_id = ? AND match_id = ? AND user_id = ? AND map_no = ?
    LIMIT 1
    `,
    [guildId, matchId, userId, mapNo]
  );
  return { a: p?.pred_exact_a ?? '', b: p?.pred_exact_b ?? '' };
}

function buildModal({ match, maxMaps, mapNo, defaults }) {
  const modal = new ModalBuilder()
    .setCustomId('match_user_exact_submit')
    .setTitle(
      maxMaps === 1
        ? `Dokładny wynik: ${match.team_a} vs ${match.team_b}`
        : `Dokładny wynik — mapa #${mapNo}`
    );

  const inA = new TextInputBuilder()
    .setCustomId('exact_a')
    .setLabel(`${match.team_a} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  if (defaults.a !== '') inA.setValue(String(defaults.a));

  const inB = new TextInputBuilder()
    .setCustomId('exact_b')
    .setLabel(`${match.team_b} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  if (defaults.b !== '') inB.setValue(String(defaults.b));

  modal.addComponents(
    new ActionRowBuilder().addComponents(inA),
    new ActionRowBuilder().addComponents(inB)
  );

  return modal;
}

module.exports = async function matchUserSeriesSelect(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    const ctx = userState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu.',
        ephemeral: true
      });
    }

    const gate = await assertPredictionsAllowed({
      guildId: interaction.guildId,
      kind: 'MATCHES'
    });

    if (!gate.allowed) {
      return interaction.reply({
        content: gate.message || '❌ Typowanie jest aktualnie zamknięte.',
        ephemeral: true
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const [[match]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked
        FROM matches
        WHERE id = ? AND guild_id = ?
        LIMIT 1
        `,
        [ctx.matchId, guildId]
      );

      if (!match || match.is_locked) {
        userState.clear(guildId, interaction.user.id);
        return interaction.reply({
          content: '🔒 Mecz jest zablokowany.',
          ephemeral: true
        });
      }

      // FORMAT: guildId|matchId|2:1
      const raw = interaction.values?.[0];
      if (!raw) {
        return interaction.reply({
          content: '❌ Nie wybrano wyniku serii.',
          ephemeral: true
        });
      }

      const [, , score] = raw.split('|');
      const [winA, winB] = score.split(':').map(Number);

      if (!Number.isInteger(winA) || !Number.isInteger(winB)) {
        return interaction.reply({
          content: '❌ Niepoprawny wynik serii.',
          ephemeral: true
        });
      }

      const maxMaps = maxMapsFromBo(match.best_of);
      const requiredMaps = Math.min(winA + winB, maxMaps);

      userState.set(guildId, interaction.user.id, {
        ...ctx,
        matchId: match.id,
        mapNo: 1,
        requiredMaps,
        targetWinsA: winA,
        targetWinsB: winB,
        mapWinsA: 0,
        mapWinsB: 0
      });

      const defaults = await getUserDefaults(
        pool,
        guildId,
        match.id,
        interaction.user.id,
        maxMaps,
        1
      );

      const modal = buildModal({
        match,
        maxMaps,
        mapNo: 1,
        defaults
      });

      return interaction.showModal(modal);
    });

  } catch (err) {
    logger.error('matches', 'matchUserSeriesSelect failed', {
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się ustawić wyniku serii.',
      ephemeral: true
    }).catch(() => {});
  }
};
