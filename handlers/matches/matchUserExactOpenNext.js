// handlers/matchUserExactOpenNext.js
const matchUserExactOpen = require('./matchUserExactOpen');

module.exports = async function matchUserExactOpenNext(interaction) {
  // ctx.mapNo już jest ustawione w state -> open pokaże właściwą mapę
  return matchUserExactOpen(interaction);
};
