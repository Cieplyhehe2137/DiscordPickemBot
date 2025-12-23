// handlers/matchUserExactSubmit.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

async function getDefaults(matchId, userId, maxMaps, mapNo) {
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

function buildModal(match, maxMaps, mapNo, defaults) {
  const modal = new ModalBuilder()
    .setCustomId('match_user_exact_submit')
    .setTitle(maxMaps === 1 ? `Dokładny wynik` : `Dokładny wynik — mapa #${mapNo}`);

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

module.exports = async function matchUserExactSubmit(interaction) {
  try {
    const ctx = userState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({ content: '❌ Brak kontekstu meczu.', ephemeral: true });
    }

    const exactA = Number(interaction.fields.getTextInputValue('exact_a'));
    const exactB = Number(interaction.fields.getTextInputValue('exact_b'));

    if (!Number.isFinite(exactA) || !Number.isFinite(exactB) || exactA < 0 || exactB < 0) {
      return interaction.reply({ content: '❌ Wynik musi być liczbą >= 0.', ephemeral: true });
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
      userState.clear(interaction.user.id);
      return interaction.reply({ content: '🔒 Typowanie tego meczu jest już zamknięte.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);
    const mapNo = Number(ctx.mapNo || 1);

    // zapis do DB
    if (maxMaps === 1) {
      await pool.query(
        `INSERT INTO match_predictions (match_id, user_id, pred_exact_a, pred_exact_b)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           pred_exact_a=VALUES(pred_exact_a),
           pred_exact_b=VALUES(pred_exact_b),
           updated_at=CURRENT_TIMESTAMP`,
        [match.id, interaction.user.id, exactA, exactB]
      );
    } else {
      await pool.query(
        `INSERT INTO match_map_predictions (match_id, user_id, map_no, pred_exact_a, pred_exact_b)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           pred_exact_a=VALUES(pred_exact_a),
           pred_exact_b=VALUES(pred_exact_b),
           updated_at=CURRENT_TIMESTAMP`,
        [match.id, interaction.user.id, mapNo, exactA, exactB]
      );
    }

    // ✅ NIE OTWIERAMY KOLEJNEGO MODALA Z MODAL SUBMIT (bo showModal tu nie istnieje)
    // Zamiast tego: ephemeral + button -> button otworzy kolejny modal
    if (maxMaps > 1 && mapNo < maxMaps) {
      const nextMapNo = mapNo + 1;
      userState.set(interaction.user.id, { ...ctx, mapNo: nextMapNo });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`match_exact_open:${match.id}:${nextMapNo}`)
          .setLabel(`Wpisz mapę #${nextMapNo}`)
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content: `✅ Zapisano wynik mapy **#${mapNo}**.\nKliknij poniżej, aby wpisać mapę **#${nextMapNo}**.`,
        components: [row],
        ephemeral: true,
      });
    }

    // Koniec flow
    if (maxMaps > 1) {
      userState.set(interaction.user.id, { ...ctx, mapNo: 1 }); // albo: userState.clear(...)
    }

    return interaction.reply({
      content:
        maxMaps === 1
          ? `✅ Zapisano dokładny wynik: **${match.team_a} ${exactA}:${exactB} ${match.team_b}**`
          : `✅ Zapisano dokładne wyniki dla BO${match.best_of} (mapy 1–${maxMaps}).`,
      ephemeral: true,
    });
  } catch (err) {
    logger?.error?.('matches', 'matchUserExactSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać wyniku.', ephemeral: true }).catch(() => {});
  }
};
