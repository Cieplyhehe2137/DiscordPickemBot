// Podsumowanie turnieju jako wiadomość na kanale.
//
// Wysyłane raz, po zakończeniu turnieju - w jedynym momencie, kiedy wszyscy
// patrzą. Trzy nazwy z podium i linki do stron, które te wyniki tłumaczą.
//
// GRACZE PRZEZ WZMIANKĘ, nie przez nazwę. `<@id>` w opisie wiadomości Discord
// zamienia na aktualny nick i nie wysyła przy tym powiadomienia. Nazwa
// z rankingu idzie obok jako zapas: gdy ktoś wyszedł z serwera, wzmianka
// pokaże surowy identyfikator, a wtedy widać przynajmniej, kto to był.

const { EmbedBuilder } = require("discord.js");

const MEDALE = ["🥇", "🥈", "🥉"];

function miejsce(wpis, index) {
  const medal = MEDALE[index] || `**${wpis.rank || index + 1}.**`;

  const kto = wpis.userId ? `<@${wpis.userId}>` : wpis.name;

  // Przy remisie serwis daje dwa razy to samo miejsce - i tak ma zostać,
  // bo tak wygląda tabela, do której ta wiadomość linkuje.
  const nazwa = wpis.userId && wpis.name ? ` (${wpis.name})` : "";

  return `${medal} ${kto}${nazwa} — **${wpis.points}** pkt`;
}

function linie(links) {
  if (!links) return null;

  const wpisy = [];

  if (links.leaderboard) wpisy.push(`[Cała klasyfikacja](${links.leaderboard})`);
  if (links.myStats) wpisy.push(`[Twoje statystyki](${links.myStats})`);
  if (links.upsets) wpisy.push(`[Niespodzianki](${links.upsets})`);
  if (links.allTime) wpisy.push(`[Wszystkie czasy](${links.allTime})`);

  return wpisy.length ? wpisy.join(" • ") : null;
}

/**
 * @param {object} standings wynik fetchTournamentStandings
 * @param {object|null} links wynik siteLinks (null = post bez linków)
 */
function buildTournamentRecapEmbed({ eventName, standings, links }) {
  const podium = standings?.podium || [];

  const embed = new EmbedBuilder()
    .setColor(0xf5b342)
    .setTitle(`🏁 Koniec typowania — ${eventName || "turniej"}`)
    .setDescription(
      podium.length
        ? podium.map(miejsce).join("\n")
        : "Nikt nie zdobył punktów w tym turnieju.",
    )
    .setTimestamp();

  const ilu = Number(standings?.players || 0);

  if (ilu > 0) {
    embed.addFields({
      name: "Stawka",
      value:
        `**${ilu}** ${ilu === 1 ? "osoba" : "osób"} w klasyfikacji` +
        (standings?.matches ? ` • **${standings.matches}** meczów` : ""),
      inline: false,
    });
  }

  const nawigacja = linie(links);

  if (nawigacja) {
    embed.addFields({ name: "Zobacz na stronie", value: nawigacja, inline: false });
  } else {
    // Brak PUBLIC_SITE_URL w config/_base.env. Wiadomość i tak ma sens,
    // więc nie jest to powód do pominięcia jej - ale stopka mówi, czego brak.
    embed.setFooter({ text: "Linki do serwisu: ustaw PUBLIC_SITE_URL" });
  }

  return embed;
}

module.exports = { buildTournamentRecapEmbed };
