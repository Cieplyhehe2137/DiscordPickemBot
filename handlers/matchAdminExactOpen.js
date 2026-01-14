// handlers/matchAdminExactOpen.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState');

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

async function getDefaults(matchId, maxMaps, mapNo) {
  try {
    if (maxMaps === 1) {
      const [[r]] = await pool.query(
        `SELECT exact_a, exact_b FROM match_results WHERE match_id=? LIMIT 1`,
        [matchId]
      );
      return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
    }

    const [[r]] = await pool.query(
      `SELECT exact_a, exact_b
       FROM match_map_results
       WHERE match_id=? AND map_no=? LIMIT 1`,
      [matchId, mapNo]
    );
    return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
  } catch (e) {
    return { a: '', b: '' };
  }
}

module.exports = async function matchAdminExactOpen(interaction) {
  try {
    const ctx = adminState.get(interaction.guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak wybranego meczu. Wybierz najpierw mecz z listy.',
        ephemeral: true
      });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      adminState.clear(interaction.guildId, interaction.user.id);
      return interaction.reply({ content: '❌ Ten mecz nie istnieje już w bazie.', ephemeral: true });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    // START wizard: jeśli BO3/BO5 i nie ma mapNo -> start od mapy 1
    let mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 0);
    if (maxMaps > 1 && (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps)) {
      mapNo = 1;
      adminState.set(interaction.guildId, interaction.user.id, { ...ctx, matchId: match.id, teamA: match.team_a, teamB: match.team_b, bestOf: match.best_of, mapNo });
    } else {
      // odśwież ctx o pewne dane z DB (bezpiecznie)
      adminState.set(interaction.guildId, interaction.user.id, { ...ctx, matchId: match.id, teamA: match.team_a, teamB: match.team_b, bestOf: match.best_of, mapNo });
    }

    const defaults = await getDefaults(match.id, maxMaps, mapNo);

    const modal = new ModalBuilder()
      .setCustomId('match_admin_exact_submit')
      .setTitle(
        maxMaps === 1
          ? `Oficjalny dokładny wynik`
          : `Oficjalny dokładny wynik — mapa #${mapNo}`
      );

    const aInput = new TextInputBuilder()
      .setCustomId('exact_a')
      .setLabel(`${match.team_a} — wynik (np. 13)`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(defaults.a === '' ? '' : String(defaults.a));

    const bInput = new TextInputBuilder()
      .setCustomId('exact_b')
      .setLabel(`${match.team_b} — wynik (np. 8)`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(defaults.b === '' ? '' : String(defaults.b));

    modal.addComponents(
      new ActionRowBuilder().addComponents(aInput),
      new ActionRowBuilder().addComponents(bInput)
    );

    return interaction.showModal(modal);
  } catch (err) {
    logger?.error?.('matches', 'matchAdminExactOpen failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się otworzyć modala.', ephemeral: true }).catch(() => {});
  }
};
