const mysqldump = require('mysqldump');
const path = require('path');
const fs = require('fs');

module.exports = async function backupDatabase(interaction) {
  try {
    // Powiadomienie przed rozpoczęciem
    await interaction.reply({
      content: '💽 **Tworzę kopię zapasową...** Trzymaj kciuki, żeby nie wybuchło! 💥',
      ephemeral: true
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.sql`;
    const filePath = path.join(__dirname, `../backup/${fileName}`);

    if (!fs.existsSync(path.join(__dirname, '../backup'))) {
      fs.mkdirSync(path.join(__dirname, '../backup'));
    }

    await mysqldump({
      connection: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
      },
      dumpToFile: filePath,
    });

    // Po zakończeniu
    await interaction.editReply({
      content: `✅ Backup zakończony! Plik zapisany jako \`${fileName}\`\n📦 Twoje dane są teraz zabezpieczone jak w skarbcu FBI 🔐`,
    });

  } catch (error) {
    console.error('❌ Błąd backupu:', error);
    try {
      await interaction.editReply({
        content: '❌ Coś poszło nie tak przy backupie... Może Gremliny w kablach? 🐭💥',
      });
    } catch (err2) {
      console.error('❌ Błąd przy edytowaniu wiadomości (interakcja już wygasła)');
    }
  }
};
