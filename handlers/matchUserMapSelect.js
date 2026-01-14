const userState = require('../utils/matchUserState');
const pool = require('../db');

module.exports = async function matchUserMapSelect(interaction) {
  const val = interaction.values?.[0]; // np. "3"
  const mapNo = Number(val);

  const ctx = userState.get(interaction.guildId, interaction.user.id);
  if (!ctx) {
    return interaction.update({ content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.', components: [] });
  }

  // sprawdź mecz (żeby nie wybierać mapy z kosmosu)
  const [[m]] = await pool.query(`SELECT id, team_a, team_b, best_of, is_locked FROM matches WHERE id=? LIMIT 1`, [ctx.matchId]);
  if (!m) return interaction.update({ content: '❌ Mecz nie istnieje.', components: [] });
  if (m.is_locked) return interaction.update({ content: '🔒 Ten mecz jest zablokowany.', components: [] });

  const maxMaps = Number(m.best_of) === 1 ? 1 : (Number(m.best_of) === 3 ? 3 : 5);
  if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
    return interaction.update({ content: '❌ Nieprawidłowa mapa.', components: [] });
  }

  userState.set(interaction.guildId, interaction.user.id, { ...ctx, mapNo });

  // po wyborze mapy – odpalamy modal (ten sam handler co wcześniej)
  // UWAGA: tutaj nie da się "showModal" po update. Najprościej: w matchUserExactOpen robimy wybór mapy
  // dlatego ten handler może tylko odpowiedzieć instrukcją, a modal otwieramy z buttona.
  return interaction.update({
    content: `✅ Wybrano mapę **#${mapNo}**. Kliknij ponownie **🧮 Wpisz dokładny wynik**, żeby wpisać liczby.`,
    components: []
  });
};
