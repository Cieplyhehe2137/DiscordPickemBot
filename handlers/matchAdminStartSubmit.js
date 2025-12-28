const pool = require('../db');
const logger = require('../utils/logger');
const adminState = require('../utils/matchAdminState');
const { DateTime } = require('luxon');
const { DEFAULT_ZONE, parseStartInputToUtc, isMatchStarted } = require('../utils/matchLock');

module.exports = async function matchAdminStartSubmit(interaction) {
  try {
    const ctx = adminState.get(interaction.user.id);
    if (!ctx?.matchId) {
      return interaction.reply({ content: '❌ Brak wybranego meczu. Wybierz mecz ponownie', ephemeral: true });
    }

    const input = interaction.fields.getTextInputValue('start_time');
    const parsed = parseStartInputToUtc(input, DEFAULT_ZONE);
    if (!parsed.ok) {
      return interaction.reply({ content: `❌ ${parsed.reason}`, ephemeral: true });
    }

    const [[match]] = await pool.query(
      `SELECT id, team_a, team_b, start_time_utc, is_locked FROM matches WHERE id=? LIMIT 1`,
      [ctx.matchId]
    );

    if (!match) {
      adminState.delete(interaction.user.id);
      return interaction.reply({ content: '❌ Mecz nie istnieje już w bazie', ephemeral: true });
    }

    if (parsed.cleared) {
      await pool.query(`UPDATE matches SET start_time_utc = NULL WHERE id=?`, [match.id]);
      return interaction.reply({
        content: `✅ Usunięto start meczu dla **${match.team_a} vs ${match.team_b}**`,
        ephemeral: true,
      });
    }

    const utcDt = parsed.utc;              // luxon DateTime (UTC)
    const utcJs = utcDt.toJSDate();        // JS Date for mysql2

    await pool.query(`UPDATE matches SET start_time_utc = ? WHERE id=?`, [utcJs, match.id]);

    const nowUtc = DateTime.utc();
    let lockedNow = false;

    // jeśli start już minął -> lock od razu
    if (!match.is_locked && isMatchStarted({ start_time_utc: utcJs }, nowUtc, 0)) {
      await pool.query(`UPDATE matches SET is_locked = 1 WHERE id=? AND is_locked=0`, [match.id]);
      lockedNow = true;
    }

    const localStr = utcDt.setZone(DEFAULT_ZONE).toFormat('yyyy-LL-dd HH:mm');
    const utcStr = utcDt.toFormat("yyyy-LL-dd HH:mm 'UTC'");

    logger.info('matches', 'Match start_time_utc updated', {
      matchId: match.id,
      local: localStr,
      utc: utcStr,
      lockedNow,
    });

    return interaction.reply({
      content:
        `✅ Ustawiono start dla **${match.team_a} vs ${match.team_b}**\n` +
        `🕒 Czas PL: **${localStr}**\n` +
        `🌍 UTC: **${utcStr}**` +
        (lockedNow ? `\n🔒 Mecz był już po starcie — został automatycznie zablokowany.` : ''),
      ephemeral: true,
    });
  } catch (err) {
    logger?.error?.('matches', 'matchAdminStartSubmit failed', { message: err.message, stack: err.stack });
    return interaction.reply({ content: '❌ Nie udało się zapisać startu meczu.', ephemeral: true }).catch(() => {});
  }
};
