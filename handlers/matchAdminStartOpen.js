// handlers/matchAdminStartOpen.js
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
const { DEFAULT_ZONE, formatStartLocal } = require('../utils/matchLock');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) ||
         perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function matchAdminStartOpen(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    if (!hasAdminPerms(interaction)) {
      return interaction.reply({
        content: '❌ Brak uprawnień',
        ephemeral: true
      });
    }

    const raw = String(interaction.customId || '');
    const matchId = Number(raw.split(':')[1]);
    if (!Number.isInteger(matchId) || matchId <= 0) {
      return interaction.reply({
        content: '❌ Niepoprawny matchId',
        ephemeral: true
      });
    }

    const pool = db.getPoolForGuild(interaction.guildId);

    // 🔒 GUILD-SAFE SELECT
    const [[match]] = await pool.query(
      `
      SELECT id, team_a, team_b, best_of, start_time_utc, is_locked
      FROM matches
      WHERE id = ? AND guild_id = ?
      LIMIT 1
      `,
      [matchId, interaction.guildId]
    );

    if (!match) {
      return interaction.reply({
        content: '❌ Nie znaleziono meczu dla tego serwera.',
        ephemeral: true
      });
    }

    // zapisz kontekst admina
    const prev = adminState.get(interaction.guildId, interaction.user.id) || {};
    adminState.set(interaction.guildId, interaction.user.id, {
      ...prev,
      matchId: Number(match.id),
      teamA: match.team_a,
      teamB: match.team_b,
      bestOf: Number(match.best_of)
    });

    const currentLocal =
      formatStartLocal(match.start_time_utc, DEFAULT_ZONE) || '';

    const modal = new ModalBuilder()
      .setCustomId('match_admin_start_submit')
      .setTitle('Ustaw start meczu');

    const input = new TextInputBuilder()
      .setCustomId('start_time')
      .setLabel('Start (czas PL) — np. 2025-12-27 21:30')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('YYYY-MM-DD HH:mm (albo: clear)');

    if (typeof currentLocal === 'string' && currentLocal.length > 0) {
      input.setValue(currentLocal);
    }

    modal.addComponents(
      new ActionRowBuilder().addComponents(input)
    );

    return interaction.showModal(modal);

  } catch (err) {
    logger?.error?.('matches', 'matchAdminStartOpen failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się otworzyć modala.',
      ephemeral: true
    }).catch(() => {});
  }
};
