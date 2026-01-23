const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState');

// ===== GUARDS =====
function requireGuild(interaction) {
  if (!interaction.guildId) {
    interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true
    }).catch(() => {});
    return false;
  }
  return true;
}

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) ||
         perms?.has(PermissionFlagsBits.ManageGuild);
}

function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);
  if (bo === 1) return 1;
  if (bo === 3) return 3;
  return 5;
}

// ===== DEFAULTS (GUILD-SAFE) =====
async function getDefaults(pool, guildId, matchId, maxMaps, mapNo) {
  try {
    if (maxMaps === 1) {
      const [[r]] = await pool.query(
        `SELECT exact_a, exact_b
         FROM match_results
         WHERE match_id = ? AND guild_id = ?
         LIMIT 1`,
        [matchId, guildId]
      );
      return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
    }

    const [[r]] = await pool.query(
      `SELECT exact_a, exact_b
       FROM match_map_results
       WHERE match_id = ?
         AND guild_id = ?
         AND map_no = ?
       LIMIT 1`,
      [matchId, guildId, mapNo]
    );
    return { a: r?.exact_a ?? '', b: r?.exact_b ?? '' };
  } catch {
    return { a: '', b: '' };
  }
}

module.exports = async function matchAdminExactOpen(interaction) {
  try {
    if (!requireGuild(interaction) || !hasAdminPerms(interaction)) return;

    const guildId = interaction.guildId;
    const pool = db.getPoolForGuild(guildId);

    const ctx = adminState.get(guildId, interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({
        content: '❌ Brak wybranego meczu. Wybierz najpierw mecz z listy.',
        ephemeral: true
      });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of
       FROM matches
       WHERE id = ? AND guild_id = ?
       LIMIT 1`,
      [ctx.matchId, guildId]
    );

    if (!match) {
      adminState.clear(guildId, interaction.user.id);
      return interaction.reply({
        content: '❌ Ten mecz nie istnieje lub nie należy do tego serwera.',
        ephemeral: true
      });
    }

    const maxMaps = maxMapsFromBo(match.best_of);

    let mapNo = maxMaps === 1 ? 1 : Number(ctx.mapNo || 0);
    if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
      mapNo = 1;
    }

    adminState.set(guildId, interaction.user.id, {
      ...ctx,
      matchId: match.id,
      teamA: match.team_a,
      teamB: match.team_b,
      bestOf: match.best_of,
      mapNo
    });

    const defaults = await getDefaults(pool, guildId, match.id, maxMaps, mapNo);

    const modal = new ModalBuilder()
      .setCustomId('match_admin_exact_submit')
      .setTitle(
        maxMaps === 1
          ? 'Oficjalny dokładny wynik'
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
    logger.error('matches', 'matchAdminExactOpen failed', {
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się otworzyć modala.',
      ephemeral: true
    }).catch(() => {});
  }
};
