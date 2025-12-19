const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ogloszenie')
    .setDescription('📣 Publikuje ogłoszenie o starcie nowego Pick’Em'),

  async execute(interaction) {
    // ID admina który może to wywołać
    const authorizedUserId = '461851082570596352';

    if (interaction.user.id !== authorizedUserId) {
      return await interaction.reply({
        content: `❌ Nie masz uprawnień do użycia tej komendy.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📣 Nowa edycja Pick’Em!')
      .setColor('#2e8bff')
      .setDescription(
        'Rozpoczynamy nową odsłonę Pick’Em w całkowicie odświeżonym formacie!\n\n' +
        '📅 **Już jutro o godzinie 12:00 startujemy z typowaniem dla IEM Cologne 2025.**\n' +
        'Przygotuj swoje analizy i strategie – to idealny moment, aby powalczyć o najwyższe miejsca w tabeli.'
      )
      .addFields(
        {
          name: '🏆 System typowania i punktacji',
          value:
            '**⚔ Play-In:**\n' +
            '• Typujesz 8 drużyn, które awansują z fazy Play-In.\n' +
            '• Każdy poprawny typ = +1 punkt.\n\n' +
            '**🔄 Double Elimination:**\n' +
            '• Typujesz 2 drużyny z Upper Final A, 2 z Lower Final A,\n' +
            '  2 z Upper Final B oraz 2 z Lower Final B.\n' +
            '• Każdy poprawny typ = +2 punkty.\n\n' +
            '**🏆 Playoffs:**\n' +
            '• Typujesz 4 półfinalistów (+1 pkt za każdego),\n' +
            '  2 finalistów (+2 pkt za każdego) oraz zwycięzcę turnieju (+4 pkt).'
        },
        {
          name: '🎁 Nagrody',
          value:
            '🥇 1. miejsce – skin do **75 zł** wybrany przez zwycięzcę\n' +
            '🥈 2. miejsce – skin do **50 zł** wybrany przez zdobywcę 2. miejsca\n' +
            '🥉 3. miejsce – skin do **35 zł** wybrany przez zdobywcę 3. miejsca'
        },
        {
          name: 'ℹ️ Dodatkowe informacje',
          value:
            'System automatycznie zlicza punkty i aktualizuje ranking na żywo, który będzie dostępny na kanale wyników.\n' +
            'Przypominamy o konieczności oddania typów przed wyznaczonymi deadline’ami – ich przekroczenie uniemożliwia dalsze typowanie w danej fazie.'
        }
      )
      .setFooter({ text: 'Administracja Pick’Em' })
      .setTimestamp();

    await interaction.reply({
      content: '@everyone',
      embeds: [embed]
    });
  }
};
