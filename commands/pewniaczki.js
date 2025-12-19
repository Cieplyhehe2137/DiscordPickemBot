const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pewniaczki')
    .setDescription('🎯 Wpisz drużyny i wylosuj pewniaczki')
    .addStringOption(option =>
      option.setName('teams')
        .setDescription('Wpisz drużyny oddzielone spacją lub przecinkiem')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Ile drużyn wylosować? (domyślnie 5)')
        .setRequired(false)
    ),

  async execute(interaction) {
    // ✅ Sprawdzanie ID kanału
    if (interaction.channelId !== '1309975039017484308') {
      return await interaction.reply({
        content: '❌ Ta komenda może być używana tylko w wyznaczonym kanale.',
        ephemeral: true
      });
    }

    const allowedUsers = ['555800660357021696', '461851082570596352'];

    if (!allowedUsers.includes(interaction.user.id)) {
      return await interaction.reply({
        content: '❌ Nie masz uprawnień do tej komendy.',
        ephemeral: true
      });
    }

    const input = interaction.options.getString('teams');
    const count = interaction.options.getInteger('count') || 5;

    const teams = input.split(/[\s,;]+/).map(t => t.trim()).filter(t => t.length > 0);

    if (teams.length < count) {
      return await interaction.reply({
        content: `❌ Podaj przynajmniej ${count} drużyn!`,
        ephemeral: true
      });
    }

    const headers = [
      "🔥 Twoje pewniaczki 🔥",
      "💸 Kuponik już w grze:",
      "🤑 Masz to wygrane:",
      "🚀 Typy dla milionera:",
      "🤣 Ekspert z kanapy poleca:",
      "😎 Pewniaczki dnia to:"
    ];

    const footers = [
      "⚠️ Nie pytaj potem czemu nie weszło",
      "💀 Bookmacher płacze",
      "🏆 Gwarancja zwrotu? Nie ma.",
      "😂 Jak to nie siądzie, to siądzie następny",
      "🔮 Magiczna kula mówi: może wejść",
      "🐒 Analiza szympansa zakończona sukcesem"
    ];

    const shuffled = teams.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    const embed = new EmbedBuilder()
      .setTitle(headers[Math.floor(Math.random() * headers.length)])
      .setDescription(selected.map((team, i) => `**${i + 1}.** ${team}`).join('\n'))
      .setColor('Random')
      .setFooter({ text: footers[Math.floor(Math.random() * footers.length)] })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
