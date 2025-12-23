// handlers/matchUserExactOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
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

function buildSeriesSelect(match, maxMaps) {
  const a = match.team_a;
  const b = match.team_b;

  const options =
    maxMaps === 3
      ? [
        { label: `${a} 2-0`, value: `2|0` },
        { label: `${a} 2-1`, value: `2|1` },
        { label: `${b} 2-1`, value: `1|2` },
        { label: `${b} 2-0`, value: `0|2` },
      ]
      : [
        { label: `${a} 3-0`, value: `3|0` },
        { label: `${a} 3-1`, value: `3|1` },
        { label: `${a} 3-2`, value: `3|2` },
        { label: `${b} 3-2`, value: `2|3` },
        { label: `${b} 3-1`, value: `1|3` },
        { label: `${b} 3-0`, value: `0|3` },
      ];

  const select = new StringSelectMenuBuilder()
    .setCustomId('match_series_select')
    .setPlaceholder('Wybierz wynik serii (żeby wiedzieć ile map wpisać)')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

module.exports = async function matchUserExactOpen(interaction) {
  try {
    const ctx = userState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.',
        ephemeral: true,
      });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      userState.clear(interaction.user.id);
      return interaction.reply({ content: '❌ Mecz nie istnieje.', ephemeral: true });
    }
    if (match.is_locked) {
      return interaction.reply({ content: '🔒 Ten mecz jest zablokowany.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    // ustal mapNo (z ctx)
    let mapNo = Number(ctx.mapNo || 0);
    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
      mapNo = 1;
      userState.set(interaction.user.id, { ...ctx, mapNo });
    }

    const effectiveMapNo = maxMaps === 1 ? 1 : mapNo;

    // === NOWE: jeśli BO3/BO5 i jesteśmy na mapie #1 i nie ma requiredMaps -> pokaż wybór wyniku serii
    if (maxMaps > 1 && effectiveMapNo === 1 && !ctx?.requiredMaps) {
      return interaction.reply({
        content: '🎯 Najpierw wybierz wynik serii w dropdownie **„Wybierz swój typ…”** (nad przyciskiem).',
        ephemeral: true,
      });
    }


    // reset liczników na starcie (żeby nie mieszało między próbami)
    if (maxMaps > 1 && effectiveMapNo === 1) {
      userState.set(interaction.user.id, {
        ...ctx,
        matchId: match.id,
        mapNo: 1,
        mapWinsA: 0,
        mapWinsB: 0,
        // requiredMaps zostaje (jeśli już ustawione)
      });
    }

    const defaults = await getUserDefaults(match.id, interaction.user.id, maxMaps, effectiveMapNo);
    const modal = buildModal({ match, maxMaps, mapNo: effectiveMapNo, defaults });

    return interaction.showModal(modal);
  } catch (err) {
    logger?.error?.('matches', 'matchUserExactOpen failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się otworzyć modala.', ephemeral: true }).catch(() => { });
  }
};
