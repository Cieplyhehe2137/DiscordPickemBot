const {
  ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder,
  ButtonBuilder, ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadTeams() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'teams.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) {
    console.error('❌ Błąd przy wczytywaniu teams.json:', e);
  }
  return [];
}

module.exports = async (interaction) => {
  try {
    console.log('✅ Kliknięto przycisk Wyniki Double Elim');

    
    await interaction.deferReply({ ephemeral: true });
    console.log('✅ deferReply wykonany');

    const teams = loadTeams();
    console.log('📂 Załadowane drużyny:', teams);

    if (!teams.length) {
      return interaction.editReply({
        content: '⚠️ Nie udało się wczytać listy drużyn z pliku `teams.json`.',
        components: []
      });
    }

    const options = teams.map(t => ({ label: t, value: t }));

    const embed = new EmbedBuilder()
      .setColor('#3399ff')
      .setTitle('🛠️ Oficjalne wyniki – Double Elimination')
      .setDescription([
        'Wybierz po **1 drużynie** w każdej pozycji:',
        '• **Upper Final – Grupa A**',
        '• **Lower Final – Grupa A**',
        '• **Upper Final – Grupa B**',
        '• **Lower Final – Grupa B**',
        '',
        'Na końcu kliknij **Zatwierdź wyniki**.'
      ].join('\n'));

    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('official_doubleelim_upper_final_a')
        .setPlaceholder('Upper Final – Grupa A')
        .setMinValues(1).setMaxValues(2)
        .addOptions(options)
    );
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('official_doubleelim_lower_final_a')
        .setPlaceholder('Lower Final – Grupa A')
        .setMinValues(1).setMaxValues(2)
        .addOptions(options)
    );
    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('official_doubleelim_upper_final_b')
        .setPlaceholder('Upper Final – Grupa B')
        .setMinValues(1).setMaxValues(2)
        .addOptions(options)
    );
    const row4 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('official_doubleelim_lower_final_b')
        .setPlaceholder('Lower Final – Grupa B')
        .setMinValues(1).setMaxValues(2)
        .addOptions(options)
    );
    const confirm = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_official_doubleelim')
        .setLabel('✅ Zatwierdź wyniki')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3, row4, confirm]
    });
    console.log('✅ editReply wysłany');
  } catch (err) {
    console.error('❌ Błąd w openDoubleElimResultsDropdown:', err);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ content: '❌ Wystąpił błąd przy otwieraniu wyników Double Elim.', ephemeral: true });
      } catch {}
    }
  }
};
