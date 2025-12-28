// handlers/matchAdminExactOpenNext.js
const matchAdminExactOpen = require('./matchAdminExactOpen');

module.exports = async function matchAdminExactOpenNext(interaction) {
  // po kliknięciu po prostu otwieramy modal (ctx.mapNo już ustawiony)
  return matchAdminExactOpen(interaction);
};
