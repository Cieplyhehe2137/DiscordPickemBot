const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📜 Pokazuje listę wszystkich komend i ich opis'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📜 Pomoc – Lista komend')
      .setColor('#2f3136')
      .setDescription('Oto lista komend, które możesz użyć z tym botem Pick\'Em:')
      .addFields(
        { name: '/ranking', value: 'Pokaż aktualny ranking punktów graczy.' },
        { name: '/moje_miejsce', value: 'Zobacz swoje miejsce w tabeli.' },
        { name: '/miejsce', value: 'Sprawdź miejsce i punkty danego użytkownika'},
        { name: '/moje_typy', value: 'Zobacz jakie drużyny sam wytypowałeś.' },
        { name: '/help', value: 'Wyświetl tę listę komend.' },
      )
      .setFooter({ text: 'Pick\'Em Bot CS2' });

    await interaction.reply({ embeds: [embed]});
  }
};
