const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ComponentType,
  StringSelectMenuBuilder
} = require('discord.js');

const pool = require('../db');
const { withGuild } = require('../utils/guildContext');

const ADMIN_USER_ID = process.env.PICKEM_ADMIN_ID || null;

// Prefiksy przycisków typowania
const TYPING_BUTTON_PREFIXES = ['open_', 'typuj_'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_pickem')
    .setDescription('🛑 Ręcznie zamyka fazę Pick\'Em i dezaktywuje przyciski typowania')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator
    ),

  async execute(interaction) {
    try {
      const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;
      const isEnvAdmin = ADMIN_USER_ID && ADMIN_USER_ID === interaction.user.id;

      const hasManageGuild =
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

      if (!(isGuildOwner || isEnvAdmin || hasManageGuild)) {
        return interaction.reply({
          content: '❌ Nie masz uprawnień do użycia tej komendy.',
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('🛑 Zamykanie fazy Pick\'Em')
        .setDescription(
          'Kliknij fazę, którą chcesz zamknąć.\n' +
          'Przyciski typowania zostaną dezaktywowane, a faza oznaczona jako `closed = 1`.'
        )
        .setColor('Red');

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_phase_swiss_stage_1')
          .setLabel('Zamknij Swiss 1')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('close_phase_swiss_stage_2')
          .setLabel('Zamknij Swiss 2')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('close_phase_swiss_stage_3')
          .setLabel('Zamknij Swiss 3')
          .setStyle(ButtonStyle.Danger),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_phase_playoffs')
          .setLabel('Zamknij Playoffs')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('close_phase_doubleelim')
          .setLabel('Zamknij Double Elim')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('close_phase_playin')
          .setLabel('Zamknij Play-In')
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        ephemeral: true,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300_000,
        filter: (i) =>
          i.customId?.startsWith('close_phase_') &&
          i.user.id === interaction.user.id &&
          i.message?.interaction?.id === interaction.id,
      });

      collector.on('collect', async (i) => {
        const guildId = i.guildId;
        if (!guildId) {
          return i.followUp({
            content: '❌ Ta funkcja działa tylko na serwerze (nie w DM).',
            ephemeral: true
          });
        }

        return withGuild(guildId, async () => {
          try {
            await i.deferUpdate();

            const phase = String(i.customId).replace('close_phase_', '');

            const [rows] = await pool.query(
              `
              SELECT message_id, channel_id
              FROM active_panels
              WHERE phase = ? AND closed = 0
              ORDER BY id DESC
              LIMIT 1
              `,
              [phase]
            );

            const messageId = rows?.[0]?.message_id;
            const channelId = rows?.[0]?.channel_id;

            let editOk = false;

            if (messageId && channelId) {
              try {
                const channel = await i.client.channels.fetch(channelId);
                const panelMsg = await channel.messages.fetch(messageId);

                const PHASE_REGEX = {
                  swiss_stage_1: /(swiss(?:[_\- ]*stage)?[_\- ]*1|swiss1|stage[_\- ]*1|s1)/i,
                  swiss_stage_2: /(swiss(?:[_\- ]*stage)?[_\- ]*2|swiss2|stage[_\- ]*2|s2)/i,
                  swiss_stage_3: /(swiss(?:[_\- ]*stage)?[_\- ]*3|swiss3|stage[_\- ]*3|s3)/i,
                  playoffs: /(playoffs?|final|semi|quarter)/i,
                  doubleelim: /(double|de[_\- ]|upper|lower|elim)/i,
                  playin: /(play[-_ ]?in|pi[_\- ])/i
                };

                const phaseRe =
                  PHASE_REGEX[phase] ||
                  new RegExp(
                    phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                    'i'
                  );

                const isTypingId = (id) =>
                  TYPING_BUTTON_PREFIXES.some(p =>
                    String(id || '').startsWith(p)
                  );

                const matchesPhase = (id) =>
                  phaseRe.test(String(id || ''));

                let disabledCount = 0;

                let updatedComponents = panelMsg.components.map(row => {
                  const newRow = new ActionRowBuilder();

                  const rebuilt = row.components.map(component => {
                    const id = component.customId || '';
                    const shouldDisable = isTypingId(id) && matchesPhase(id);

                    if (component.type === 2) {
                      const btn = ButtonBuilder.from(component);
                      return shouldDisable
                        ? (disabledCount++, btn
                            .setLabel('Typowanie zakończone')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true))
                        : btn;
                    }

                    if (component.type === 3) {
                      const sel = StringSelectMenuBuilder.from(component);
                      return shouldDisable
                        ? (disabledCount++, sel.setDisabled(true))
                        : sel;
                    }

                    return component;
                  });

                  newRow.addComponents(...rebuilt);
                  return newRow;
                });

                if (disabledCount === 0) {
                  updatedComponents = panelMsg.components.map(row => {
                    const newRow = new ActionRowBuilder();

                    const rebuilt = row.components.map(component => {
                      const id = component.customId || '';
                      const shouldDisable = isTypingId(id);

                      if (component.type === 2) {
                        const btn = ButtonBuilder.from(component);
                        return shouldDisable
                          ? btn
                              .setLabel('Typowanie zakończone')
                              .setStyle(ButtonStyle.Secondary)
                              .setDisabled(true)
                          : btn;
                      }

                      if (component.type === 3) {
                        const sel = StringSelectMenuBuilder.from(component);
                        return shouldDisable ? sel.setDisabled(true) : sel;
                      }

                      return component;
                    });

                    newRow.addComponents(...rebuilt);
                    return newRow;
                  });
                }

                await panelMsg.edit({ components: updatedComponents });
                editOk = true;
              } catch (e) {
                console.warn('[end_pickem] Nie udało się edytować panelu:', e?.message || e);
              }
            }

            await pool.query(
              `
              UPDATE active_panels
              SET closed = 1, closed_at = NOW()
              WHERE phase = ? AND closed = 0
              `,
              [phase]
            );

            await i.followUp({
              ephemeral: true,
              content: editOk
                ? `✅ Faza \`${phase}\` została zamknięta i przyciski typowania dezaktywowane.`
                : `✅ Faza \`${phase}\` została zamknięta. (Brak komponentów do dezaktywacji).`,
            });
          } catch (err) {
            console.error('[end_pickem] Błąd w collector handler:', err);
            await i.followUp({
              ephemeral: true,
              content: '❌ Błąd podczas zamykania fazy Pick\'Em.'
            });
          }
        });
      });
    } catch (err) {
      console.error('[end_pickem] Błąd główny:', err);
      await interaction.reply({
        ephemeral: true,
        content: '❌ Wystąpił błąd podczas uruchamiania komendy.'
      });
    }
  },
};
