// handlers/matchUserSeriesSelect.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

async function getUserDefaults(matchId, userId, maxMaps, mapNo) {
  if (maxMaps === 1) {
    const [[p]] = await pool.query(
      `SELECT pred_exact_a, pred_exact_b FROM match_predictions WHERE match_id=? AND user_id=? LIMIT 1`,
      [matchId, userId]
    );
    return { a: p?.pred_exact_a ?? '', b: p?.pred_exact_b ?? '' };
  }

  const [[p]] = await pool.query(
    `SELECT pred_exact_a, pred_exact_b
     FROM match_map_predictions
     WHERE match_id=? AND user_id=? AND map_no=? LIMIT 1`,
    [matchId, userId, mapNo]
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
    .setRequired(true)
    .setPlaceholder('np. 13')
    .setValue(defaults.a === '' ? '' : String(defaults.a));

  const inB = new TextInputBuilder()
    .setCustomId('exact_b')
    .setLabel(`${match.team_b} — wynik`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('np. 8')
    .setValue(defaults.b === '' ? '' : String(defaults.b));

  modal.addComponents(
    new ActionRowBuilder().addComponents(inA),
    new ActionRowBuilder().addComponents(inB)
  );

  return modal;
}

module.exports = async function matchUserSeriesSelect(interaction) {
  try {
    const ctx = userState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({ content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      userState.clear(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '❌ Mecz nie istnieje.', ephemeral: true });
    }
    if (match.is_locked) {
      return interaction.reply({ content: '🔒 Ten mecz jest zablokowany.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    const raw = interaction.values?.[0] || '';
    const [winA, winB] = raw.split('|').map(Number);

    if (!Number.isFinite(winA) || !Number.isFinite(winB) || winA < 0 || winB < 0) {
      return interaction.reply({ content: '❌ Niepoprawny wybór wyniku serii.', ephemeral: true });
    }

    const requiredMaps = Math.min(winA + winB, maxMaps);

    // ustaw state pod submit
    userState.set(interaction.guildId, interaction.user.id, {
      ...ctx,
      matchId: match.id,
      mapNo: 1,
      requiredMaps,
      targetWinsA: winA,
      targetWinsB: winB,
      mapWinsA: 0,
      mapWinsB: 0,
    });

    // od razu otwórz modal mapy #1
    const defaults = await getUserDefaults(match.id, interaction.user.id, maxMaps, 1);
    const modal = buildModal({ match, maxMaps, mapNo: 1, defaults });

    return interaction.showModal(modal);
  } catch (err) {
    logger?.error?.('matches', 'matchUserSeriesSelect failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się ustawić wyniku serii.', ephemeral: true }).catch(() => {});
  }
};
