// handlers/matchUserExactOpen.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const pool = require('../db');
const logger = require('../utils/logger');
const userState = require('../utils/matchUserState');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5; // BO5 default
}

module.exports = async function matchUserExactOpen(interaction) {
  try {
    const ctx = userState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz (Typuj wyniki meczów).',
        ephemeral: true
      });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, is_locked FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      userState.clear(interaction.user.id);
      return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie.', ephemeral: true });
    }

    if (match.is_locked) {
      return interaction.reply({ content: '🔒 Ten mecz jest zablokowany (nie można już typować).', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    // === BO3/BO5: jeśli nie ma mapNo -> pokaż select mapy
    const mapNo = Number(ctx.mapNo || 0);
    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
      const opts = Array.from({ length: maxMaps }, (_, i) => ({
        label: `Mapa #${i + 1}`,
        value: String(i + 1)
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('match_user_map_select') // MUSI być w selectMap -> matchUserMapSelect
          .setPlaceholder('Wybierz mapę…')
          .addOptions(opts)
      );

      return interaction.reply({
        content: `🗺️ Ten mecz jest **BO${match.best_of}**. Wybierz mapę, dla której chcesz wpisać dokładny wynik:`,
        components: [row],
        ephemeral: true
      });
    }

    const effectiveMapNo = maxMaps === 1 ? 1 : mapNo;

    // defaults (ostatni zapis) zależnie od BO
    let defaults = { a: '', b: '' };

    if (maxMaps === 1) {
      const [[p]] = await pool.query(
        `SELECT pred_exact_a, pred_exact_b
         FROM match_predictions
         WHERE match_id=? AND user_id=? LIMIT 1`,
        [match.id, interaction.user.id]
      );
      if (p) {
        defaults.a = p.pred_exact_a === null || p.pred_exact_a === undefined ? '' : String(p.pred_exact_a);
        defaults.b = p.pred_exact_b === null || p.pred_exact_b === undefined ? '' : String(p.pred_exact_b);
      }
    } else {
      const [[p]] = await pool.query(
        `SELECT pred_exact_a, pred_exact_b
         FROM match_map_predictions
         WHERE match_id=? AND user_id=? AND map_no=? LIMIT 1`,
        [match.id, interaction.user.id, effectiveMapNo]
      );
      if (p) {
        defaults.a = p.pred_exact_a === null || p.pred_exact_a === undefined ? '' : String(p.pred_exact_a);
        defaults.b = p.pred_exact_b === null || p.pred_exact_b === undefined ? '' : String(p.pred_exact_b);
      }
    }

    const modal = new ModalBuilder()
      .setCustomId('match_user_exact_submit')
      .setTitle(
        maxMaps === 1
          ? `Dokładny wynik: ${match.team_a} vs ${match.team_b}`
          : `Dokładny wynik (mapa #${effectiveMapNo})`
      );

    const inA = new TextInputBuilder()
      .setCustomId('exact_a')
      .setLabel(`${match.team_a} — wynik`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('np. 13')
      .setValue(defaults.a);

    const inB = new TextInputBuilder()
      .setCustomId('exact_b')
      .setLabel(`${match.team_b} — wynik`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('np. 8')
      .setValue(defaults.b);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inA),
      new ActionRowBuilder().addComponents(inB)
    );

    return interaction.showModal(modal);
  } catch (err) {
    logger?.error?.('matches', 'matchUserExactOpen failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się otworzyć modala.', ephemeral: true }).catch(() => {});
  }
};
