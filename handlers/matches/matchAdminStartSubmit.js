const { logInfo, logWarn, logError } = require('../../utils/logger');
const adminState = require('../../utils/matchAdminState');
const { DateTime } = require('luxon');
const { withGuild } = require('../../utils/guildContext');
const {
  DEFAULT_ZONE,
  parseStartInputToUtc,
  isMatchStarted
} = require('../../utils/matchLock');
const { getMatchById } = require('../../utils/matchesStore');

module.exports = async function matchAdminStartSubmit(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Brak kontekstu serwera.',
        ephemeral: true
      });
    }

    await withGuild(interaction, async ({ pool, guildId }) => {
      const ctx = adminState.get(guildId, interaction.user.id);
      if (!ctx?.matchId) {
        return interaction.reply({
          content: '❌ Brak wybranego meczu. Wybierz mecz ponownie.',
          ephemeral: true
        });
      }

      const input = interaction.fields.getTextInputValue('start_time');
      const parsed = parseStartInputToUtc(input, DEFAULT_ZONE);

      if (!parsed.ok) {
        return interaction.reply({
          content: `❌ ${parsed.reason}`,
          ephemeral: true
        });
      }

      const match = await getMatchById(pool, guildId, ctx.matchId);

      if (!match) {
        adminState.clear(guildId, interaction.user.id);
        return interaction.reply({
          content: '❌ Mecz nie istnieje już w bazie dla tego serwera.',
          ephemeral: true
        });
      }

      // 🧹 USUNIĘCIE STARTU
      if (parsed.cleared) {
        await pool.query(
          `
          UPDATE matches
          SET start_time_utc = NULL
          WHERE id = ? AND guild_id = ?
          `,
          [match.id, guildId]
        );

        return interaction.reply({
          content: `✅ Usunięto start meczu **${match.team_a} vs ${match.team_b}**`,
          ephemeral: true
        });
      }

      const utcDt = parsed.utc;       // luxon DateTime (UTC)
      const utcJs = utcDt.toJSDate(); // JS Date

      await pool.query(
        `
        UPDATE matches
        SET start_time_utc = ?
        WHERE id = ? AND guild_id = ?
        `,
        [utcJs, match.id, guildId]
      );

      const nowUtc = DateTime.utc();
      let lockedNow = false;

      // 🔒 auto-lock jeśli start już minął
      if (isMatchStarted({ start_time_utc: utcJs }, nowUtc, 0)) {
        const [res] = await pool.query(
          `
          UPDATE matches
          SET is_locked = 1
          WHERE id = ?
            AND guild_id = ?
            AND is_locked = 0
          `,
          [match.id, guildId]
        );

        lockedNow = res.affectedRows > 0;
      }

      const localStr = utcDt.setZone(DEFAULT_ZONE).toFormat('yyyy-LL-dd HH:mm');
      const utcStr = utcDt.toFormat("yyyy-LL-dd HH:mm 'UTC'");

      logInfo('matches', 'Match start_time_utc updated', {
        guild_id: guildId,
        matchId: match.id,
        local: localStr,
        utc: utcStr,
        lockedNow,
        by: interaction.user?.id
      });

      return interaction.reply({
        content:
          `✅ Ustawiono start dla **${match.team_a} vs ${match.team_b}**\n` +
          `🕒 Czas PL: **${localStr}**\n` +
          `🌍 UTC: **${utcStr}**` +
          (lockedNow
            ? `\n🔒 Mecz był już po starcie — został automatycznie zablokowany.`
            : ''),
        ephemeral: true
      });
    });

  } catch (err) {
    logError('matches', 'matchAdminStartSubmit failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.reply({
      content: '❌ Nie udało się zapisać startu meczu.',
      ephemeral: true
    }).catch(() => {});
  }
};
