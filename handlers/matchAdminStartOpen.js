// handlers/matchAdminStartOpen.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState');
const { DEFAULT_ZONE, formatStartLocal } = require('../utils/matchLock');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function matchAdminStartOpen(interaction) {
  try {
    if (!hasAdminPerms(interaction)) {
      return interaction.reply({ content: '❌ Brak uprawnień', ephemeral: true });
    }

    const raw = String(interaction.customId || '');
    const matchId = Number(raw.split(':')[1]);
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return interaction.reply({ content: '❌ Niepoprawny matchId', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, best_of, start_time_utc, is_locked FROM matches WHERE id=? LIMIT 1`,
      [matchId]
    );

    if (!match) {
      return interaction.reply({ content: '❌ Nie znaleziono meczu', ephemeral: true });
    }

    const prev = adminState.get(interaction.user.id) || {};
    adminState.set(interaction.user.id, {
      ...prev,
      matchId: Number(match.id),
      teamA: match.team_a,
      teamB: match.team_b, // ✅ FIX
      bestOf: Number(match.best_of),
    });

    const currentLocal = formatStartLocal(match.start_time_utc, DEFAULT_ZONE) || '';

    const modal = new ModalBuilder()
      .setCustomId('match_admin_start_submit')
      .setTitle('Ustaw start meczu');

    const input = new TextInputBuilder()
      .setCustomId('start_time')
      .setLabel('Start (czas PL) - np. 2025-12-27 21:30')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder('YYYY-MM-DD HH:mm (albo: clear)');

    // ✅ setValue tylko jeśli naprawdę jest stringiem
    if (typeof currentLocal === 'string' && currentLocal.length > 0) {
      input.setValue(currentLocal);
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  } catch (err) {
    logger?.error?.('matches', 'matchAdminStartOpen failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się otworzyć modala', ephemeral: true }).catch(() => {});
  }
};
