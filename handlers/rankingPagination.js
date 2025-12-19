const { generateRankingEmbed } = require('../commands/ranking');

module.exports = async (interaction) => {
    if (!interaction.isButton()) return;

    const [prefix, direction, faza, page] = interaction.customId.split('_');
    if (prefix !== 'ranking') return;

    let newPage = Number(page);
    newPage = direction === 'prev' ? newPage - 1 : newPage + 1;
    if (newPage < 1) newPage = 1;

    const { embed, buttons } = await generateRankingEmbed(faza, newPage);
    if (!embed) {
        return interaction.reply({ content: 'BRAK KOLEJNYCH WYNIKÓW', ephemeral: true });
    }

    await interaction.update({ embeds: [embed], components: [buttons] });
};