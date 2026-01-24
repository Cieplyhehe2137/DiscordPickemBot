// commands/endPickem.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ComponentType,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  ChannelSelectMenuBuilder,
} = require('discord.js');

const { withGuild } = require('../utils/guildContext');
const logger = require('../utils/logger');

// Admin role IDs (opcjonalnie)
const ALLOWED_ROLES = ['1164253439417659456', '1301530484479758407', '1386396019339825363'];
const ADMIN_USER_ID = process.env.PICKEM_ADMIN_ID || null;

function isAuthorized(interaction) {
  if (!interaction?.guildId) return false;
  if (ADMIN_USER_ID && interaction.user?.id === ADMIN_USER_ID) return true;

  const perms = interaction.memberPermissions;
  if (perms?.has(PermissionFlagsBits.ManageGuild) || perms?.has(PermissionFlagsBits.Administrator)) return true;

  const memberRoles = interaction.member?.roles?.cache;
  if (!memberRoles) return false;
  return ALLOWED_ROLES.some((id) => memberRoles.has(id));
}

function parsePhaseStage(closeKey) {
  if (closeKey?.startsWith('swiss_stage_')) {
    const n = String(closeKey).replace('swiss_stage_', '');
    return { phase: 'swiss', stage: `stage${n}` };
  }
  return { phase: closeKey, stage: null };
}

function disableAllMessageComponents(message) {
  const disabledRows = [];

  for (const row of message.components || []) {
    const newRow = new ActionRowBuilder();

    for (const c of row.components || []) {
      if (c.type === ComponentType.Button) newRow.addComponents(ButtonBuilder.from(c).setDisabled(true));
      else if (c.type === ComponentType.StringSelect) newRow.addComponents(StringSelectMenuBuilder.from(c).setDisabled(true));
      else if (c.type === ComponentType.UserSelect) newRow.addComponents(UserSelectMenuBuilder.from(c).setDisabled(true));
      else if (c.type === ComponentType.RoleSelect) newRow.addComponents(RoleSelectMenuBuilder.from(c).setDisabled(true));
      else if (c.type === ComponentType.MentionableSelect) newRow.addComponents(MentionableSelectMenuBuilder.from(c).setDisabled(true));
      else if (c.type === ComponentType.ChannelSelect) newRow.addComponents(ChannelSelectMenuBuilder.from(c).setDisabled(true));
      else newRow.addComponents(c);
    }

    disabledRows.push(newRow);
  }

  return disabledRows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('end_pickem')
    .setDescription('Zamyka typowanie (dezaktywuje przyciski na panelu) dla wybranej fazy')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({ content: '❌ Ta komenda działa tylko na serwerze (nie w DM).', ephemeral: true });
    }

    if (!isAuthorized(interaction)) {
      return interaction.reply({ content: '❌ Brak uprawnień.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🛑 Zamykanie typowania (Pick’Em)')
      .setDescription('Wybierz fazę do zamknięcia. Bot wyłączy komponenty na panelu i oznaczy go jako zamknięty w bazie.')
      .setColor(0xEF4444);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_phase_swiss_stage_1').setLabel('Zamknij Swiss 1').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_phase_swiss_stage_2').setLabel('Zamknij Swiss 2').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_phase_swiss_stage_3').setLabel('Zamknij Swiss 3').setStyle(ButtonStyle.Danger),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_phase_playoffs').setLabel('Zamknij Playoffs').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_phase_doubleelim').setLabel('Zamknij Double Elim').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_phase_playin').setLabel('Zamknij Play-In').setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: true,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 1000 * 60 * 10,
    });

    collector.on('collect', async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'To nie jest Twój panel.', ephemeral: true });
        }
        if (!i.customId?.startsWith('close_phase_')) return;

        const closeKey = String(i.customId).replace('close_phase_', '');
        const { phase, stage } = parsePhaseStage(closeKey);

        await i.deferUpdate();

        await withGuild(guildId, async (pool) => {
          const [rows] = await pool.query(
            `
            SELECT id, channel_id, message_id
            FROM active_panels
            WHERE guild_id = ?
              AND phase = ?
              AND stage <=> ?
              AND active = 1
            ORDER BY id DESC
            LIMIT 1
            `,
            [guildId, phase, stage]
          );

          const panel = rows?.[0];
          if (!panel?.message_id || !panel?.channel_id) {
            return i.followUp({
              content: `⚠️ Nie znaleziono aktywnego panelu dla fazy **${phase}**${stage ? ` (${stage})` : ''}.`,
              ephemeral: true,
            });
          }

          const channel = await i.client.channels.fetch(panel.channel_id).catch(() => null);
          if (!channel || !channel.isTextBased?.()) {
            await pool.query(
              `UPDATE active_panels
               SET active = 0, closed = 1, closed_at = NOW()
               WHERE id = ? AND guild_id = ?`,
              [panel.id, guildId]
            );
            return i.followUp({ content: `⚠️ Kanał panelu nie istnieje / brak dostępu. Panel zamknięty w DB.`, ephemeral: true });
          }

          const panelMsg = await channel.messages.fetch(panel.message_id).catch(() => null);
          if (!panelMsg) {
            await pool.query(
              `UPDATE active_panels
               SET active = 0, closed = 1, closed_at = NOW()
               WHERE id = ? AND guild_id = ?`,
              [panel.id, guildId]
            );
            return i.followUp({ content: `⚠️ Wiadomość panelu nie istnieje. Panel zamknięty w DB.`, ephemeral: true });
          }

          await panelMsg.edit({ components: disableAllMessageComponents(panelMsg) });

          await pool.query(
            `UPDATE active_panels
             SET active = 0, closed = 1, closed_at = NOW()
             WHERE id = ? AND guild_id = ?`,
            [panel.id, guildId]
          );

          logger.info('endPickem', 'Phase closed', { guildId, phase, stage: stage || null, actor: i.user.id });

          return i.followUp({ content: `✅ Zamknięto fazę **${phase}**${stage ? ` (${stage})` : ''}.`, ephemeral: true });
        });

      } catch (err) {
        logger.error('endPickem', 'Error while closing phase', { guildId, error: err?.message });
        try { await i.followUp({ content: '⚠️ Błąd przy zamykaniu panelu.', ephemeral: true }); } catch (_) {}
      }
    });

    collector.on('end', async () => {
      try { await interaction.editReply({ components: [] }); } catch (_) {}
    });
  },
};
