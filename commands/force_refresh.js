const { SlashCommandBuilder } = require('discord.js');
const { DateTime } = require('luxon');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force_refresh_direct')
    .setDescription('Force-refresh tylko dla konkretnych ID, z timestamp w description'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // TWOJE KONKRETNE ID
    const channel_id = "1389389388441452626";
    const message_id = "1393895488574586960";

    // TWOJA KONKRETNA DATA
    const deadlineDate = DateTime.fromJSDate(new Date(deadline));
    const unixTimestamp = Math.floor(deadlineDate.toSeconds());

    try {
      // console.log(`🔍 Próbuję channel_id=${channel_id}, message_id=${message_id}, unix=${unixTimestamp}`);

      const channel = await interaction.client.channels.fetch(channel_id).catch(err => {
        // console.error(`❌ Nie znaleziono kanału ${channel_id}:`, err.message);
        return null;
      });

      if (!channel) {
        console.log(`⚠️ Brak kanału ${channel_id}`);
        // await interaction.followUp(`❌ Nie znaleziono kanału ${channel_id}`);
        return;
      }
      console.log(`✅ Znaleziono kanał ${channel_id}`);

      const message = await channel.messages.fetch(message_id, { cache: false, force: true }).catch(err => {
        // console.error(`❌ Nie znaleziono wiadomości ${message_id}:`, err.message);
        return null;
      });

      if (!message) {
        // console.log(`⚠️ Brak wiadomości ${message_id}`);
        await interaction.followUp(`❌ Nie znaleziono wiadomości ${message_id}`);
        return;
      }
      // console.log(`✅ Znaleziono wiadomość ${message_id}`);

      const updatedEmbed = message.embeds[0]
        ? message.embeds[0].toJSON()
        : null;

      if (!updatedEmbed) {
        // console.log(`⚠️ Wiadomość ${message_id} nie ma embed.`);
        await interaction.followUp(`⚠️ Wiadomość ${message_id} nie ma embed.`);
        return;
      }

      // 🔥 Wstawiamy timestamp do DESCRIPTION
      updatedEmbed.description = `🕒 Deadline <t:${unixTimestamp}:R> (<t:${unixTimestamp}:F>)`;

      await message.edit({ embeds: [updatedEmbed] });

      // console.log(`✅ Zaktualizowano description w wiadomości ${message_id}`);
      await interaction.followUp(`✅ Zaktualizowano description w wiadomości ${message_id}`);

    } catch (err) {
      // console.error('❌ Błąd w force_refresh_direct:', err);
      await interaction.followUp('❌ Wystąpił błąd podczas force-refresh.');
    }
  },
};
