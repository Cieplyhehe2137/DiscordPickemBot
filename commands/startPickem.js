const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const pool = require('../db.js');
const { withGuild } = require('../utils/guildContext');

const allowedRoles = [
  "1164253439417659456",
  "1301530484479758407",
  "1386396019339825363",
  "1372662767881814017"
];

// Mapowanie faz na dane embedów i przycisków do typowania
const phasesConfig = {
  swiss: {
    title: 'Typowanie fazy Swiss',
    description:
      'Typujesz:\n\n' +
      '🆙 2 drużyny na 3-0\n' +
      '🆘 2 drużyny na 0-3\n' +
      '🏅 6 drużyn awansujących\n\n' +
      '🔴 Deadline: 15 min przed startem meczu',
    buttonLabel: 'Typuj Swiss',
    buttonId: 'open_swiss_modal',
    color: 'Blue'
  },
  playoffs: {
    title: 'Typowanie fazy Playoffs',
    description:
      'Typujesz:\n\n' +
      '🏆 4 półfinalistów\n' +
      '🥈 2 finalistów\n' +
      '👑 Zwycięzcę turnieju\n' +
      '🥉 3. miejsce (opcjonalnie)\n\n' +
      '🔴 Deadline: 15 min przed startem meczu',
    buttonLabel: 'Typuj Playoffs',
    buttonId: 'open_playoffs_modal',
    color: 'Green'
  },
  doubleelim: {
    title: 'Typowanie fazy Double Elimination',
    description:
      'Typujesz:\n\n' +
      '🔵 2 drużyny z Upper Final A\n' +
      '🔴 2 drużyny z Lower Final A\n' +
      '🟢 2 drużyny z Upper Final B\n' +
      '🟣 2 drużyny z Lower Final B\n\n' +
      '🔴 Deadline: 15 min przed startem meczu',
    buttonLabel: 'Typuj Double Elim',
    buttonId: 'open_doubleelim_modal',
    color: 'Purple'
  },
  playin: {
    title: 'Typowanie fazy Play-In',
    description:
      'Typujesz:\n\n' +
      '🎯 8 drużyn, które awansują z fazy Play-In\n\n' +
      '🔴 Deadline: 15 min przed startem meczu',
    buttonLabel: 'Typuj Play-In',
    buttonId: 'open_playin_modal',
    color: 'DarkBlue'
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start_pickem')
    .setDescription('Rozpoczyna wybór fazy turnieju Pick\'Em')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const isAdmin = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));
    if (!isAdmin) {
      return await interaction.reply({
        content: '🚫 Nie masz uprawnień do użycia tej komendy.',
        ephemeral: true
      });
    }

    // Wyślij adminowi select menu do wyboru fazy
    const embed = new EmbedBuilder()
      .setTitle('📌 Wybierz fazę turnieju, którą chcesz rozpocząć:')
      .setColor('Orange');

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_pickem_phase')
        .setPlaceholder('Wybierz fazę turnieju')
        .addOptions([
          { label: 'Swiss', description: 'Typowanie fazy Swiss', value: 'swiss' },
          { label: 'Playoffs', description: 'Typowanie fazy Playoffs', value: 'playoffs' },
          { label: 'Double Elimination', description: 'Typowanie Double Elim', value: 'doubleelim' },
          { label: 'Play-In', description: 'Typowanie fazy Play-In', value: 'playin' }
        ])
    );

    await interaction.reply({
      embeds: [embed],
      components: [selectMenu],
      ephemeral: true
    });
  },

  // Dodaj tę funkcję do eksportu, aby obsłużyć wybór fazy (w index.js ją wywołaj przy interakcji select menu)
  async handlePhaseSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'select_pickem_phase') return;

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).', ephemeral: true });
    }

    return withGuild(guildId, async () => {
      const selected = interaction.values[0];
      const config = phasesConfig[selected];
      if (!config) {
        return interaction.reply({ content: `❌ Nieznana faza: ${selected}`, ephemeral: true });
      }

      // Przygotuj embed i przycisk dla wybranej fazy
      const embed = new EmbedBuilder()
        .setTitle(config.title)
        .setDescription(config.description)
        .setColor(config.color);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(config.buttonId)
          .setLabel(config.buttonLabel)
          .setStyle(ButtonStyle.Primary)
      );

      // Wyślij embed i przycisk na ten sam kanał
      const message = await interaction.channel.send({ embeds: [embed], components: [row] });

      // Zapisz panel do bazy active_panels
      await pool.query(`
        INSERT INTO active_panels (phase, channel_id, message_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id)
      `, [selected, interaction.channel.id, message.id]);

      // Odpowiedz ephemeral użytkownikowi, że faza została uruchomiona
      await interaction.reply({ content: `✅ Uruchomiono typowanie fazy **${config.title}**`, ephemeral: true });
    });
  }
};
