// handlers/restoreBackupSelector.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'restore_backup_select') return;

  try {
    const file = interaction.values[0];

    console.log('Selected backup:', file);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_restore_backup:${file}`)
        .setLabel('✅ Potwierdź przywracanie')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_restore_backup')
        .setLabel('❌ Anuluj')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `⚠️ Czy na pewno chcesz przywrócić backup:\n**${file}**`,
      components: [row],
      ephemeral: true
    });

  } catch (err) {
    console.error('RESTORE SELECT ERROR:', err);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Błąd podczas wyboru backupu.',
        ephemeral: true
      });
    }
  }
};
