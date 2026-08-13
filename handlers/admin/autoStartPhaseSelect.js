const {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType
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

        const select =
            new ChannelSelectMenuBuilder()
                .setCustomId(
                    `auto_start:channel_select:${eventId}:${phase}`
                )
                .setPlaceholder(
                    'Wybierz kanał publikacji Pick’Em'
                )
                .setChannelTypes(
                    ChannelType.GuildText
                )
                .setMinValues(1)
                .setMaxValues(1);

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