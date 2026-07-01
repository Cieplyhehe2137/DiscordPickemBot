const adminState = require('../../utils/matchAdminState');
const { withGuild } = require('../../utils/guildContext');
const { getMatchById } = require('../../utils/matchesStore');
const { maxMapsFromBo } = require('../../utils/mapLabels');

module.exports = async function matchAdminMapSelect(interaction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    return interaction.update({
      content: '❌ Brak kontekstu serwera.',
      components: []
    });
  }

  const mapNo = Number(interaction.values?.[0]);
  const ctx = adminState.get(guildId, interaction.user.id);

  if (!ctx?.matchId) {
    return interaction.update({
      content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.',
      components: []
    });
  }

  return withGuild(interaction, async ({ pool, guildId }) => {
    const m = await getMatchById(pool, guildId, ctx.matchId);

    if (!m) {
      return interaction.update({
        content: '❌ Mecz nie istnieje dla tego serwera.',
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

    adminState.set(guildId, interaction.user.id, {
      ...ctx,
      mapNo
    });

    return interaction.update({
      content:
        `✅ Wybrano mapę **#${mapNo}**.\n` +
        `Kliknij ponownie **✍️ Wpisz dokładny wynik**, żeby wpisać liczby.`,
      components: []
    });
  });
};
