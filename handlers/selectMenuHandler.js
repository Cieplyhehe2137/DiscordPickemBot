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
      content: '❌ Ta akcja działa tylko na serwerze (nie w DM).',
      ephemeral: true,
    });
  }

  // Admin only
  if (!isAdmin(interaction)) {
    return interaction.reply({
      content: '❌ Brak uprawnień do użycia tego panelu.',
      ephemeral: true,
    });
  }

  const pool = db.getPoolForGuild(interaction.guildId);
  const selected = interaction.values[0];

  try {
    await interaction.deferReply({ ephemeral: true });

    // === SWISS ===
    if (selected === 'swiss') {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('📌 Typowanie fazy Swiss')
        .setDescription(
          '**Typujesz:**\n' +
            '• 🆙 **2 drużyny na 3-0**\n' +
            '• 🆘 **2 drużyny na 0-3**\n' +
            '• 🏅 **6 drużyn awansujących**\n\n' +
            '🔽 Wybierz etap fazy Swiss do uruchomienia:'
        );

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('admin_select_swiss_stage')
          .setPlaceholder('Wybierz etap Swiss...')
          .addOptions(
            { label: 'Swiss Stage 1', value: 'swiss_stage_1' },
            { label: 'Swiss Stage 2', value: 'swiss_stage_2' },
            { label: 'Swiss Stage 3', value: 'swiss_stage_3' }
          )
      );

      await interaction.followUp({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
      return;
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
          '• 🥉 **Zwycięzcę meczu o 3. miejsce (opcjonalnie)**\n\n' +
          '🔴 **Deadline:** 15 min przed startem meczu',
        buttonId: 'open_playoffs_dropdown',
        buttonLabel: 'Typuj Playoffs',
      },
      doubleelim: {
        color: 'Purple',
        title: '📌 Typowanie fazy Double Elim',
        description:
          '**Typujesz:**\n' +
          '• 🔝 **2 drużyny z Upper Final A**\n' +
          '• 🔻 **2 drużyny z Lower Final A**\n' +
          '• 🔝 **2 drużyny z Upper Final B**\n' +
          '• 🔻 **2 drużyny z Lower Final B**\n\n' +
          '🔴 **Deadline:** 15 min przed startem meczu',
        buttonId: 'open_doubleelim_modal',
        buttonLabel: 'Typuj Double Elim',
      },
      playin: {
        color: 'Blue',
        title: '📌 Typowanie fazy Play-In',
        description:
          '**Typujesz:**\n' +
          '• 🎯 **8 drużyn, które awansują z fazy Play-In**\n\n' +
          '🔴 **Deadline:** 15 min przed startem meczu',
        buttonId: 'open_playin_dropdown',
        buttonLabel: 'Typuj Play-In',
      },
    };

    const config = phaseConfig[selected];
    if (!config) {
      await interaction.followUp({
        content: `❌ Nieznana faza: ${selected}`,
        ephemeral: true,
      });
      return;
    }

    if (!interaction.channel) {
      await interaction.followUp({
        content: '❌ Nie można wysłać panelu — brak kanału.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(config.title)
      .setDescription(config.description);

    const componentRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(config.buttonId)
        .setLabel(config.buttonLabel)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`match_pick:${selected}`)
        .setLabel('🎯 Typuj wyniki meczów')
        .setStyle(ButtonStyle.Success)
    );

    const message = await interaction.channel.send({
      embeds: [embed],
      components: [componentRow],
    });

    await pool.query(
      `
        INSERT INTO active_panels (phase, channel_id, message_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE channel_id=VALUES(channel_id), message_id=VALUES(message_id)
      `,
      [selected, interaction.channel.id, message.id]
    );

    await interaction.followUp({
      content: `✅ Panel dla fazy \`${selected}\` został opublikowany.`,
      ephemeral: true,
    });
  } catch (err) {
    console.error('[select_pickem_phase]', err);

    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas publikowania panelu.',
        ephemeral: true,
      });
    }
  }
};
