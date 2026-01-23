const { withGuild } = require('../utils/guildContext');

await withGuild(guildId, async () => {
  await calculateScores(guildId);
});
