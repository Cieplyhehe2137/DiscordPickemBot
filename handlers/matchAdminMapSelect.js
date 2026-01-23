const adminState = require('../utils/matchAdminState');
const pool = require('../db');

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

  const [[m]] = await pool.query(
    `SELECT id, best_of
     FROM matches
     WHERE id = ? AND guild_id = ?
     LIMIT 1`,
    [ctx.matchId, guildId]
  );

  if (!m) {
    return interaction.update({
      content: '❌ Mecz nie istnieje dla tego serwera.',
      components: []
    });
  }

  const bo = Number(m.best_of);
  const maxMaps = bo === 1 ? 1 : (bo === 3 ? 3 : 5);

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
};
