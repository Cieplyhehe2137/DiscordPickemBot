const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db');
const teams = require('../teams.json');

module.exports = async (interaction) => {
  const embed = new EmbedBuilder()
    .setColor('#00b0f4')
    .setTitle('📌 Pick\'Em – Play-In')
    .setDescription('Wybierz 8 drużyn, które Twoim zdaniem awansują z fazy Play-In.');

  const dropdown = new StringSelectMenuBuilder()
    .setCustomId('playin_qualified')
    .setPlaceholder('Wybierz 8 drużyn awansujących')
    .setMinValues(8)
    .setMaxValues(8)
    .addOptions(teams.map(team => ({ label: team, value: team })));

  const row = new ActionRowBuilder().addComponents(dropdown);
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_playin')
      .setLabel('✅ Zatwierdź typy')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.update({
    embeds: [embed],
    components: [row, confirmRow]
  });

  await pool.query(
    `INSERT INTO active_panels (message_id, phase, stage, reminded)
     VALUES (?, 'playin', null, false)
     ON DUPLICATE KEY UPDATE phase = 'playin', stage = null, reminded = false`,
    [interaction.message.id]
  );
};
