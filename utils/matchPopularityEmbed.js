const { EmbedBuilder } = require('discord.js');

function formatList(items, limit = 10) {
  if (!items?.length) return 'Brak typów.';

  return items
    .slice(0, limit)
    .map((x, i) => {
      const pct = Number(x.pct || 0).toFixed(1);
      return `**${i + 1}. ${x.label}** — ${x.count} osób (${pct}%)`;
    })
    .join('\n');
}

function buildMatchPopularityEmbed(stats) {
  const teamA = stats.match?.teamA || 'Team A';
  const teamB = stats.match?.teamB || 'Team B';

  return new EmbedBuilder()
    .setColor(0xf5b342)
    .setTitle(`📊 Typy społeczności — ${teamA} vs ${teamB}`)
    .setDescription(`Łącznie typowało: **${stats.totalUsers || 0}** osób`)
    .addFields(
      {
        name: '🏆 Kto wygra według społeczności?',
        value: formatList(stats.winner),
        inline: false
      },
      {
        name: '🎯 Najpopularniejsze wyniki',
        value: formatList(stats.scores),
        inline: false
      }
    )
    .setFooter({
      text: 'Statystyki pokazane po rozpoczęciu ostatniego meczu fazy'
    })
    .setTimestamp();
}

module.exports = {
  buildMatchPopularityEmbed
};