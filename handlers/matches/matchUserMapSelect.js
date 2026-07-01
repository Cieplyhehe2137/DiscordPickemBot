const userState = require('../../utils/matchUserState');
const { logInfo, logWarn, logError } = require('../../utils/logger');
const { withGuild } = require('../../utils/guildContext');
const { getMatchById } = require('../../utils/matchesStore');
const { maxMapsFromBo } = require('../../utils/mapLabels');

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

      const m = await getMatchById(pool, guildId, ctx.matchId);

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

      const maxMaps = maxMapsFromBo(m.best_of);

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

      logInfo('matches', 'User selected map', {
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
    logError('matches', 'matchUserMapSelect failed', {
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
