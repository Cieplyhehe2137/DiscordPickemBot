// handlers/matchAdminLockToggle.js

const { PermissionFlagsBits } = require('discord.js');
const pool = require('../db');
const logger = require('../utils/logger');
const { isMatchStarted } = require('../utils/matchLock');
const { DateTime } = require('luxon');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function matchAdminLockToggle(interaction) {
  try {
    if (!hasAdminPerms(interaction)) {
      return interaction.reply({ content: '❌ Brak uprawnień', ephemeral: true });
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ Brak kontekstu serwera', ephemeral: true });
    }

    const raw = String(interaction.customId || '');
    const matchId = Number(raw.split(':')[1]);
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return interaction.reply({ content: '❌ Niepoprawny matchId', ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, is_locked, start_time_utc
       FROM matches
       WHERE id = ? AND guild_id = ?
       LIMIT 1`,
      [matchId, guildId]
    );

    if (!match) {
      return interaction.reply({
        content: '❌ Nie znaleziono meczu dla tego serwera',
        ephemeral: true,
      });
    }

    const nowUtc = DateTime.utc();
    const started = isMatchStarted(match, nowUtc, 0);

    if (match.is_locked && started) {
      return interaction.reply({
        content: `🔒 Nie można odblokować – mecz **${match.team_a} vs ${match.team_b}** już wystartował`,
        ephemeral: true,
      });
    }

    const newVal = match.is_locked ? 0 : 1;

    await pool.query(
      `UPDATE matches
       SET is_locked = ?
       WHERE id = ? AND guild_id = ?`,
      [newVal, match.id, guildId]
    );

    logInfo('matches', 'Admin toggled match lock', {
      guild_id: guildId,
      matchId: match.id,
      from: !!match.is_locked,
      to: !!newVal,
      by: interaction.user?.id,
    });

    return interaction.reply({
      content: `${newVal ? '🔒 Zablokowano' : '🔓 Odblokowano'} mecz **${match.team_a} vs ${match.team_b}**.`,
      ephemeral: true,
    });

  } catch (err) {
    logger?.error?.('matches', 'matchAdminLockToggle failed', {
      message: err.message,
      stack: err.stack,
    });

    return interaction
      .reply({ content: '❌ Nie udało się zmienić blokady', ephemeral: true })
      .catch(() => {});
  }
};
