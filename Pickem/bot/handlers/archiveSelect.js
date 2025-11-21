const fs = require('fs');
const path = require('path');

const ARCHIVE_DIR = path.join(__dirname, '..', 'archiwum');

module.exports = async (interaction) => {
    try {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'archive_select') return;

        const value = interaction.values[0];
        if (!value || value === '__none__') {
            return interaction.reply({
                content: 'Aktualnie brak dostępnych plików archiwum',
                ephemeral: true,
            });
        }

        const filePath = path.join(ARCHIVE_DIR, value);

        if (!fs.existsSync(filePath)) {
            return interaction.reply({
                content: `Plik **${value}** nie został znaleziony w archiwum`,
                ephemeral: true,
            });
        }

        await interaction.reply({
            content: `Oto plik z archiwum: **${value}**`,
            files: [filePath],
            ephemeral: true,
        });
    } catch (err) {
        console.error('BŁĄD W archiveSelect', err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Wystąpił błąd podczas pobierania pliku z archiwum.',
                ephemeral: true,
            });
        }
    }
};