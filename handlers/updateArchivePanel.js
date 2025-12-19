const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
require('dotenv').config();

const ARCHIVE_FOLDER = path.join(__dirname, '../archiwum');

module.exports = async function updateArchivePanel(client) {
  const channelId = process.env.EXPORT_CHANNEL_ID;
  if (!channelId) {
    // console.error('❌ EXPORT_CHANNEL_ID nie jest ustawione w .env');
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(err => {
    // console.error(`❌ Nie można pobrać kanału: ${err.message}`);
    return null;
  });

  if (!channel) return;

  const files = fs.readdirSync(ARCHIVE_FOLDER)
    .filter(file => file.endsWith('.xlsx'))
    .sort((a, b) => fs.statSync(path.join(ARCHIVE_FOLDER, b)).mtime - fs.statSync(path.join(ARCHIVE_FOLDER, a)).mtime);

  if (files.length === 0) {
    return channel.send('📭 Brak plików w archiwum.');
  }

  const embed = new EmbedBuilder()
    .setTitle('📚 Archiwum turniejów PickEm')
    .setDescription('Lista zapisanych turniejów (najnowsze na górze):')
    .setColor('Blue')
    .setTimestamp();

  files.slice(0, 10).forEach(file => {
    embed.addFields({
      name: `📁 ${file}`,
      value: `✉️ Zarchiwizowano: ${new Date(fs.statSync(path.join(ARCHIVE_FOLDER, file)).mtime).toLocaleString('pl-PL')}`
    });
  });

  const prevMessage = (await channel.messages.fetch({ limit: 10 })).find(msg => msg.embeds[0]?.title?.includes('Archiwum turniej'));

  if (prevMessage) {
    await prevMessage.edit({ embeds: [embed] });
    // console.log('🔁 Zaktualizowano panel archiwum');
  } else {
    await channel.send({ embeds: [embed] });
    // console.log('📤 Wysłano nowy panel archiwum');
  }
}
