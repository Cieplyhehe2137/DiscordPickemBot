// handlers/clearMatchesPhaseSelect.js
const pool = require('../db');
const logger = require('../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

function hasAdminPerms(interaction) {
  const perms = interaction.memberPermissions;
  return perms?.has(PermissionFlagsBits.Administrator) || perms?.has(PermissionFlagsBits.ManageGuild);
}

module.exports = async function clearMatchesPhaseSelect(interaction) {
  try {
    if (!hasAdminPerms(interaction)) {
      return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ Brak kontekstu serwera (guild_id).', ephemeral: true });
    }

    const phase = interaction.values?.[0];
    if (!phase) {
      return interaction.update({ content: '❌ Nie wybrano fazy.', components: [] });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // usuń punkty, typy, wyniki dla meczów w danej fazie i guild
      const [r1] = await conn.query(
        `DELETE mp FROM match_points mp
         JOIN matches m ON m.id = mp.match_id
         WHERE m.phase = ? AND m.guild_id = ?`,
        [phase, guildId]
      );

      const [r2] = await conn.query(
        `DELETE pr FROM match_predictions pr
         JOIN matches m ON m.id = pr.match_id
         WHERE m.phase = ? AND m.guild_id = ?`,
        [phase, guildId]
      );

      const [r3] = await conn.query(
        `DELETE mr FROM match_results mr
         JOIN matches m ON m.id = mr.match_id
         WHERE m.phase = ? AND m.guild_id = ?`,
        [phase, guildId]
      );

      const [r4] = await conn.query(
        `DELETE FROM matches
         WHERE phase = ? AND guild_id = ?`,
        [phase, guildId]
      );

      await conn.commit();

      logger.info('matches', 'Cleared matches phase (guild-safe)', {
        guild_id: guildId,
        phase,
        deleted_points: r1?.affectedRows ?? 0,
        deleted_predictions: r2?.affectedRows ?? 0,
        deleted_results: r3?.affectedRows ?? 0,
        deleted_matches: r4?.affectedRows ?? 0,
        by: interaction.user?.id
      });

      return interaction.update({
        content:
          `✅ Wyczyściłem fazę **${phase}** (MATCHES):\n` +
          `• punkty: **${r1?.affectedRows ?? 0}**\n` +
          `• typy: **${r2?.affectedRows ?? 0}**\n` +
          `• wyniki: **${r3?.affectedRows ?? 0}**\n` +
          `• mecze: **${r4?.affectedRows ?? 0}**`,
        components: []
      });
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      logger.error('matches', 'clearMatchesPhaseSelect failed', {
        guild_id: guildId,
        phase,
        message: err.message,
        stack: err.stack
      });
      return interaction.update({ content: '❌ Błąd podczas czyszczenia meczów fazy.', components: [] });
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error('matches', 'clearMatchesPhaseSelect outer failed', {
      message: err.message,
      stack: err.stack
    });
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '❌ Błąd.', ephemeral: true });
    }
  }
};
