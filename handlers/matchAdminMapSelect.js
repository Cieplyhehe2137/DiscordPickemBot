const adminState = require('../utils/matchAdminState');
const pool = require('../db');

module.exports = async function matchAdminMapSelect(interaction) {
  const mapNo = Number(interaction.values?.[0]);
  const ctx = adminState.get(interaction.guildId, interaction.user.id);
  if (!ctx) return interaction.update({ content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.', components: [] });

  const [[m]] = await pool.query(`SELECT id, best_of FROM matches WHERE id=? LIMIT 1`, [ctx.matchId]);
  if (!m) return interaction.update({ content: '❌ Mecz nie istnieje.', components: [] });

  const maxMaps = Number(m.best_of) === 1 ? 1 : (Number(m.best_of) === 3 ? 3 : 5);
  if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
    return interaction.update({ content: '❌ Nieprawidłowa mapa.', components: [] });
  }

  adminState.set(interaction.guildId, interaction.user.id, { ...ctx, mapNo });

  return interaction.update({
    content: `✅ Wybrano mapę **#${mapNo}**. Kliknij ponownie **✍️ Wpisz dokładny wynik**, żeby wpisać liczby.`,
    components: []
  });
};
