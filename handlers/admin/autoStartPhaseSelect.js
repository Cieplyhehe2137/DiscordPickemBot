const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const {
  phasesConfig
} = require('../../utils/pickemPanelPublisher');

function getAvailableChannels(interaction) {
  const me = interaction.guild.members.me;

  return interaction.guild.channels.cache
    .filter(channel => {
      if (channel.type !== ChannelType.GuildText) {
        return false;
      }

      const permissions = channel.permissionsFor(me);

      return (
        permissions?.has(PermissionFlagsBits.ViewChannel) &&
        permissions?.has(PermissionFlagsBits.SendMessages)
      );
    })
    .sort((a, b) => a.rawPosition - b.rawPosition);
}

function buildChannelPage(interaction, eventId, phase, page = 0) {
  const channels = getAvailableChannels(interaction);

  const pageSize = 25;
  const totalPages = Math.max(
    1,
    Math.ceil(channels.size / pageSize)
  );

  const safePage = Math.max(
    0,
    Math.min(page, totalPages - 1)
  );

  const channelArray = Array.from(channels.values());

  const start = safePage * pageSize;
  const pageChannels = channelArray.slice(
    start,
    start + pageSize
  );

  if (!pageChannels.length) {
    return {
      content:
        '❌ Nie znalazłem kanałów tekstowych, na których bot może wysyłać wiadomości.',
      components: []
    };
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(
      `auto_start:channel_select:${eventId}:${phase}`
    )
    .setPlaceholder(
      `Wybierz kanał — strona ${safePage + 1}/${totalPages}`
    )
    .addOptions(
      pageChannels.map(channel => ({
        label: `#${channel.name}`.slice(0, 100),
        value: channel.id
      }))
    );

  const rows = [
    new ActionRowBuilder().addComponents(select)
  ];

  if (totalPages > 1) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `auto_start:channel_page:${eventId}:${phase}:${safePage - 1}`
          )
          .setLabel('◀️ Poprzednia')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage <= 0),

        new ButtonBuilder()
          .setCustomId(
            `auto_start:channel_page:${eventId}:${phase}:${safePage + 1}`
          )
          .setLabel('Następna ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages - 1)
      )
    );
  }

  return {
    content:
      `✅ Faza: **${phasesConfig[phase].label}**\n` +
      `📢 Wybierz kanał publikacji Pick’Em.\n` +
      `📄 Strona **${safePage + 1}/${totalPages}** — ` +
      `łącznie kanałów: **${channels.size}**`,

    components: rows
  };
}

module.exports = async function autoStartPhaseSelect(interaction) {
  const parts = interaction.customId.split(':');

  const eventId = Number(parts[2]);

  const phase = String(
    interaction.values?.[0] || ''
  );

  if (!eventId || !phasesConfig[phase]) {
    return interaction.reply({
      content: '❌ Niepoprawne dane auto-startu.',
      ephemeral: true
    });
  }

  await interaction.guild.channels.fetch();

  const payload = buildChannelPage(
    interaction,
    eventId,
    phase,
    0
  );

  return interaction.update(payload);
};

module.exports.buildChannelPage = buildChannelPage;