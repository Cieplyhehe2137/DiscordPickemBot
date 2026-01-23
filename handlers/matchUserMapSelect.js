const userState = require('../utils/matchUserState');
const db = require('../db');

module.exports = async function matchUserMapSelect(interaction) {
  const val = interaction.values?.[0];
  const mapNo = Number(val);

  const ctx = userState.get(interaction.guildId, interaction.user.id);
  if (!ctx) {
    return interaction.update({
      content: '❌ Brak kontekstu meczu. Wybierz mecz jeszcze raz.',
      components: []
    });
  }

  const pool = db.getPoolForGuild(interaction.guildId); // ✅ BRAKOWAŁO TEGO

  const [[m]] = await pool.query(
    `
    SELECT id, team_a, team_b, best_of, is_locked
    FROM matches
    WHERE id = ? AND guild_id = ?
    LIMIT 1
    `,
    [ctx.matchId, interaction.guildId]
  );

  if (!m) {
    return interaction.update({ content: '❌ Mecz nie istnieje.', components: [] });
  }

  if (m.is_locked) {
    return interaction.update({ content: '🔒 Ten mecz jest zablokowany.', components: [] });
  }

  const maxMaps =
    Number(m.best_of) === 1 ? 1 :
    Number(m.best_of) === 3 ? 3 : 5;

  if (!Number.isInteger(mapNo) || mapNo < 1 || mapNo > maxMaps) {
    return interaction.update({ content: '❌ Nieprawidłowa mapa.', components: [] });
  }

  userState.set(interaction.guildId, interaction.user.id, {
    ...ctx,
    mapNo
  });

  return interaction.update({
    content: `✅ Wybrano mapę **#${mapNo}**. Kliknij ponownie **🧮 Wpisz dokładny wynik**, żeby wpisać liczby.`,
    components: []
  });
};
