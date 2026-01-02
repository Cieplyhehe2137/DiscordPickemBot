const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db.js');
const { withGuild } = require('../utils/guildContext');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_phase')
    .setDescription('Całkowicie czyści tabelę active_panels i usuwa wszystkie panele Pick\'Em'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta komenda działa tylko na serwerze (nie w DM).',
        ephemeral: true
      });
    }

    const allowedRoles = ['1164253439417659456', '1301530484479758407', '1274136002868543591'];

    if (!interaction.member || !interaction.member.roles || 
        !interaction.member.roles.cache.some(role => allowedRoles.includes(role.id))) {
      return interaction.reply({
        content: '❌ Nie masz uprawnień do użycia tej komendy.',
        ephemeral: true
      });
    }

    return withGuild(guildId, async () => {
      try {
        await pool.query(`DELETE FROM active_panels`);
      // console.log(`✅ [${new Date().toISOString()}] Usunięto wszystkie rekordy z active_panels`);

        await interaction.reply({
          content: `✅ Wszystkie rekordy w tabeli **active_panels** zostały usunięte. Panele zostały całkowicie wyczyszczone.`,
          ephemeral: true
        });

      } catch (err) {
        console.error(`❌ Błąd przy kasowaniu tabeli active_panels:`, err);
        await interaction.followUp({
          content: `❌ Wystąpił błąd podczas czyszczenia tabeli.`,
          ephemeral: true
        });
      }
    });
  },
};
