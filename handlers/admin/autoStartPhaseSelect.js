const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const {
  phasesConfig
} = require('../../utils/pickemPanelPublisher');

module.exports =
  async function autoStartPhaseSelect(interaction) {

    const parts =
      interaction.customId.split(':');

    const eventId =
      Number(parts[2]);

    const phase =
      String(
        interaction.values?.[0] || ''
      );

    if (
      !eventId ||
      !phasesConfig[phase]
    ) {
      return interaction.reply({
        content:
          '❌ Niepoprawne dane auto-startu.',
        ephemeral: true
      });
    }

    await interaction.guild.channels.fetch();

    const me =
      interaction.guild.members.me;

    const channels =
      interaction.guild.channels.cache
        .filter(channel => {
          if (
            channel.type !==
            ChannelType.GuildText
          ) {
            return false;
          }

          const perms =
            channel.permissionsFor(me);

          return (
            perms?.has(
              PermissionFlagsBits.ViewChannel
            ) &&
            perms?.has(
              PermissionFlagsBits.SendMessages
            )
          );
        })
        .sort(
          (a, b) =>
            a.rawPosition -
            b.rawPosition
        )
        .first(25);

    if (!channels.length) {
      return interaction.update({
        content:
          '❌ Nie znalazłem kanału tekstowego, na którym bot może wysyłać wiadomości.',
        components: []
      });
    }

    const select =
      new StringSelectMenuBuilder()
        .setCustomId(
          `auto_start:channel_select:${eventId}:${phase}`
        )
        .setPlaceholder(
          'Wybierz kanał publikacji Pick’Em'
        )
        .addOptions(
          channels.map(channel => ({
            label:
              `#${channel.name}`.slice(
                0,
                100
              ),
            value: channel.id
          }))
        );

    return interaction.update({
      content:
        `✅ Faza: **${phasesConfig[phase].label}**\n` +
        'Wybierz kanał, na którym o wskazanej godzinie ma pojawić się panel Pick’Em.',

      components: [
        new ActionRowBuilder()
          .addComponents(select)
      ]
    });
  };