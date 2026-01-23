const db = require('../db.js');
const isAdmin = require('../utils/isAdmin');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

module.exports = async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'select_pickem_phase') return;

  if (!interaction.guildId) {
    return interaction.reply({
      content: '❌ Ta akcja działa tylko na serwerze.',
      ephemeral: true,
    });
  }

  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '❌ Brak uprawnień do użycia tego panelu.',
      ephemeral: true,
    });
  }

  const selected = interaction.values[0];
  const pool = db.getPoolForGuild(interaction.guildId);

  try {
    await interaction.deferReply({ ephemeral: true });

    // ===== SWISS =====
    if (selected === 'swiss') {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('📌 Typowanie fazy Swiss')
        .setDescription(
          '**Typujesz:**\n' +
          '• 🆙 **2 drużyny na 3-0**\n' +
          '• 🆘 **2 drużyny na 0-3**\n' +
          '• 🏅 **6 drużyn awansujących**\n\n' +
          '🔽 Wybierz etap fazy Swiss:'
        );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('admin_select_swiss_stage')
          .setPlaceholder('Wybierz etap Swiss...')
          .addOptions(
            { label: 'Swiss Stage 1', value: 'swiss_stage1' },
            { label: 'Swiss Stage 2', value: 'swiss_stage2' },
            { label: 'Swiss Stage 3', value: 'swiss_stage3' }
          )
      );

      return interaction.followUp({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    }

    const phaseConfig = {
      playoffs: {
        color: 'Green',
        title: '📌 Typowanie fazy Playoffs',
        description:
          '**Typujesz:**\n' +
          '• 🏆 **4 półfinalistów**\n' +
          '• 🥈 **2 finalistów**\n' +
          '• 👑 **Zwycięzcę turnieju**\n' +
          '• 🥉 **3. miejsce (opcjonalnie)**',
        buttonId: 'open_playoffs_dropdown',
        buttonLabel: 'Typuj Playoffs',
      },
      doubleelim: {
        color: 'Purple',
        title: '📌 Typowanie fazy Double Elim',
        description:
          '**Typujesz:**\n' +
          '• 🔝 Upper Final A (2)\n' +
          '• 🔻 Lower Final A (2)\n' +
          '• 🔝 Upper Final B (2)\n' +
          '• 🔻 Lower Final B (2)',
        buttonId: 'open_doubleelim_modal',
        buttonLabel: 'Typuj Double Elim',
      },
      playin: {
        color: 'Blue',
        title: '📌 Typowanie fazy Play-In',
        description:
          '**Typujesz:**\n' +
          '• 🎯 **8 drużyn awansujących**',
        buttonId: 'open_playin_dropdown',
        buttonLabel: 'Typuj Play-In',
      },
    };

    const config = phaseConfig[selected];
    if (!config) {
      return interaction.followUp({
        content: `❌ Nieznana faza: ${selected}`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(config.title)
      .setDescription(config.description);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(config.buttonId)
        .setLabel(config.buttonLabel)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`match_pick:${selected}`)
        .setLabel('🎯 Typuj wyniki meczów')
        .setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    await pool.query(
      `
      INSERT INTO active_panels (guild_id, phase, channel_id, message_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        channel_id = VALUES(channel_id),
        message_id = VALUES(message_id)
      `,
      [interaction.guildId, selected, interaction.channel.id, msg.id]
    );

    await interaction.editReply({
      content: `✅ Panel dla fazy **${selected}** został opublikowany.`,
    });

  } catch (err) {
    console.error('[select_pickem_phase]', err);
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas publikowania panelu.',
      });
    }
  }
};
