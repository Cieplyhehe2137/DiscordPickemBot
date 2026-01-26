const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const { withGuild } = require('../utils/guildContext');

// Mapowanie faz na dane embedów i przycisków
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
    buttonId: 'open_doubleelim_dropdown',
    color: 'Purple'
  },
  playin: {
    title: 'Typowanie fazy Play-In',
    description:
      'Typujesz:\n\n' +
      '🎯 8 drużyn awansujących z Play-In\n\n' +
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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    // 🔒 guard uprawnień
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: '🚫 Nie masz uprawnień do użycia tej komendy.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📌 Wybierz fazę turnieju, którą chcesz rozpocząć:')
      .setColor('Orange');

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_pickem_phase')
        .setPlaceholder('Wybierz fazę turnieju')
        .addOptions(
          { label: 'Swiss', value: 'swiss' },
          { label: 'Playoffs', value: 'playoffs' },
          { label: 'Double Elimination', value: 'doubleelim' },
          { label: 'Play-In', value: 'playin' }
        )
    );

    return interaction.reply({
      embeds: [embed],
      components: [selectMenu],
      ephemeral: true
    });
  },

  // ============================================================
  // SELECT HANDLER
  // ============================================================
  async handlePhaseSelect(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'select_pickem_phase') return;

    // 🔒 guard uprawnień
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: '🚫 Nie masz uprawnień do tej akcji.',
        ephemeral: true
      });
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '❌ Ta funkcja działa tylko na serwerze.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    return withGuild(guildId, async ({ pool }) => {
      const selected = interaction.values[0];
      const config = phasesConfig[selected];

      if (!config) {
        return interaction.editReply({
          content: `❌ Nieznana faza: ${selected}`
        });
      }

      // 🧹 P0: zamknij stare panele tej fazy
      await pool.query(
        `UPDATE active_panels
         SET active = 0
         WHERE guild_id = ? AND phase = ?`,
        [guildId, selected]
      );

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

      const message = await interaction.channel.send({
        embeds: [embed],
        components: [row]
      });

      await pool.query(
        `INSERT INTO active_panels (
  guild_id, phase, channel_id, message_id,
  active, reminded, deadline
)
VALUES (?, ?, ?, ?, 1, 0, NULL)
ON DUPLICATE KEY UPDATE
  message_id = VALUES(message_id),
  active = 1,
  reminded = 0,
  deadline = NULL;
`,
        [guildId, selected, interaction.channel.id, message.id]
      );


      return interaction.editReply({
        content: `✅ Uruchomiono typowanie fazy **${config.title}**`
      });
    });
  }
};
