const { EmbedBuilder } = require('discord.js');

function formatBucket(items, limit = 10) {
  if (!items?.length) {
    return 'Brak typów.';
  }

  return items
    .slice(0, limit)
    .map((x, i) => {
      const pct = Number(x.pct || 0).toFixed(1);

      return `**${i + 1}. ${x.team}** — ${x.count} osób (${pct}%)`;
    })
    .join('\n');
}

function buildPopularityEmbed({ title, stats }) {
  const embed = new EmbedBuilder()
    .setColor(0x2b6cff)
    .setTitle(title || '📊 Popularność typów')
    .setDescription(
      `Łącznie typowało: **${stats.totalUsers || 0}** osób`
    )
    .setTimestamp();

  for (const [bucketName, items] of Object.entries(stats.buckets || {})) {
    embed.addFields({
      name: bucketName,
      value: formatBucket(items),
      inline: false
    });
  }

  if (!Object.keys(stats.buckets || {}).length) {
    embed.addFields({
      name: 'Brak danych',
      value: 'Nie znaleziono typów dla tej fazy.',
      inline: false
    });
  }

  return embed;
}

module.exports = {
  buildPopularityEmbed
};