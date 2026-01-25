const userState = require('../utils/matchUserState');
const logger = require('../utils/logger');
const { withGuild } = require('../utils/guildContext');

module.exports = async function matchUserMapSelect(interaction) {
  try {
    if (!interaction.guildId) {
      return interaction.reply({
        content: '❌ Ta akcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    const val = interaction.values?.[0];
    const mapNo = Number(val);

    await withGuild(interaction, async ({ pool, guildId }) => {
      const ctx = userState.get(guildId, interaction.user.id);
      if (!ctx?.matchId) {
        return interaction.update({
          content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.',
          components: []
        });
      }

      // 🔒 guild-safe SELECT
      const [[m]] = await pool.query(
        `
        SELECT id, team_a, team_b, best_of, is_locked
        FROM matches
        WHERE id = ? AND guild_id = ?
        LIMIT 1
        `,
        [ctx.matchId, guildId]
      );

      if (!m) {
        userState.clear(guildId, interaction.user.id);
        return interaction.update({
          content: '❌ Mecz nie istnieje.',
          components: []
        });
      }

      if (m.is_locked) {
        userState.clear(guildId, interaction.user.id);
        return interaction.update({
          content: '🔒 Ten mecz jest zablokowany.',
          components: []
        });
      }

      const maxMaps =
        Number(m.best_of) === 1 ? 1 :
        Number(m.best_of) === 3 ? 3 : 5;

      if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
        return interaction.update({
          content: '❌ Nieprawidłowa mapa.',
          components: []
        });
      }

      // ✅ zapisz wybraną mapę
      userState.set(guildId, interaction.user.id, {
        ...ctx,
        mapNo
      });

      logger.info('matches', 'User selected map', {
        guild_id: guildId,
        matchId: m.id,
        mapNo,
        userId: interaction.user.id
      });

      return interaction.update({
        content:
          `✅ Wybrano mapę **#${mapNo}**.\n` +
          `Kliknij ponownie **🧮 Wpisz dokładny wynik**, aby wpisać liczby.`,
        components: []
      });
    });

  } catch (err) {
    logger.error('matches', 'matchUserMapSelect failed', {
      guild_id: interaction.guildId,
      message: err.message,
      stack: err.stack
    });

    return interaction.update({
      content: '❌ Wystąpił błąd przy wyborze mapy.',
      components: []
    }).catch(() => {});
  }
};
