const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const phasesConfig = {
  swiss_stage1: {
    label: "Swiss Stage 1",
    stage: "stage1",
    stageNumber: 1,
  },

  swiss_stage2: {
    label: "Swiss Stage 2",
    stage: "stage2",
    stageNumber: 2,
  },

  swiss_stage3: {
    label: "Swiss Stage 3",
    stage: "stage3",
    stageNumber: 3,
  },

  playoffs: {
    label: "Playoffs",
    title: "📌 Typowanie fazy Playoffs",
    description:
      "**Typujesz:**\n" +
      "• 🏆 **4 półfinalistów**\n" +
      "• 🥈 **2 finalistów**\n" +
      "• 👑 **Zwycięzcę turnieju**\n" +
      "• 🥉 **3. miejsce (opcjonalnie)**",
    buttonId: "open_playoffs_dropdown",
    buttonLabel: "Typuj Playoffs",
    color: "Green",
  },

  doubleelim: {
    label: "Double Elimination",
    title: "📌 Typowanie fazy Double Elim",
    description:
      "**Typujesz:**\n" +
      "• 🔝 Upper Final A (2)\n" +
      "• 🔻 Lower Final A (2)\n" +
      "• 🔝 Upper Final B (2)\n" +
      "• 🔻 Lower Final B (2)",
    buttonId: "open_doubleelim_modal",
    buttonLabel: "Typuj Double Elim",
    color: "Purple",
  },

  playin: {
    label: "Play-In",
    title: "📌 Typowanie fazy Play-In",
    description: "**Typujesz:**\n" + "• 🎯 **8 drużyn awansujących**",
    buttonId: "open_playin_dropdown",
    buttonLabel: "Typuj Play-In",
    color: "Blue",
  },
};

function buildSwissPayload(event, eventId, phase, config) {
  const embed = new EmbedBuilder()
    .setTitle(`🟠 Etap Swiss (STAGE ${config.stageNumber})`)
    .setDescription("Kliknij przycisk poniżej, aby rozpocząć typowanie:")
    .setColor("#ff9900")
    .setFooter({
      text: "⏰ Typowanie otwarte – brak deadline.",
    });

  const mainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`start_${phase}`)
      .setLabel(`Typuj Swiss ${config.stageNumber}`)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`match_pick:${phase}`)
      .setLabel("Typuj mecze")
      .setEmoji("🎯")
      .setStyle(ButtonStyle.Success),
  );

  const playerRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`my_predictions:${phase}:${eventId}:0`)
      .setLabel("Moje typy")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`my_stats:${eventId}`)
      .setLabel("Moje statystyki")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [embed],
    components: [mainRow, playerRow],
  };
}

function buildStandardPayload(event, eventId, phase, config) {
  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(config.title)
    .setDescription(
      `🏆 Event: **${event.name}**\n\n` +
        config.description +
        "\n\n━━━━━━━━━━━━━━\n" +
        "🎯 Wyniki meczów typujesz osobno.\n" +
        "📋 Możesz sprawdzić swoje zapisane typy.\n" +
        "📊 Statystyki aktualizują się po rozliczeniu meczów.",
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(config.buttonId)
      .setLabel(config.buttonLabel)
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`match_pick:${phase}`)
      .setLabel("🎯 Typuj wyniki meczów")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`my_predictions:${phase}:${eventId}:0`)
      .setLabel("📋 Moje typy")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`my_stats:${eventId}`)
      .setLabel("📊 Moje statystyki")
      .setStyle(ButtonStyle.Secondary),
  );

  return {
    embeds: [embed],
    components: [row],
  };
}

async function publishPickemPanel({
  client,
  pool,
  guildId,
  eventId,
  phase,
  channelId,
}) {
  const config = phasesConfig[phase];

  if (!config) {
    throw new Error(`Unknown Pick'Em phase: ${phase}`);
  }

  const [events] = await pool.query(
    `
    SELECT id, name, slug, status
    FROM events
    WHERE id = ?
      AND guild_id = ?
    LIMIT 1
    `,
    [eventId, guildId],
  );

  const event = events[0];

  if (!event) {
    throw new Error(`Event ${eventId} not found for guild ${guildId}`);
  }

  const channel = await client.channels.fetch(String(channelId));

  if (!channel || typeof channel.send !== "function") {
    throw new Error(`Target channel ${channelId} is not sendable`);
  }

  const isSwiss = phase.startsWith("swiss_stage");

  const payload = isSwiss
    ? buildSwissPayload(event, eventId, phase, config)
    : buildStandardPayload(event, eventId, phase, config);

  const message = await channel.send({
    content: "@everyone",
    ...payload,
    allowedMentions: {
      parse: ["everyone"],
    },
  });

  await pool.query(
    `
    UPDATE events
    SET
      phase = ?,
      status = 'OPEN',
      is_open = 1,
      is_active = 1
    WHERE id = ?
      AND guild_id = ?
    `,
    [phase, eventId, guildId],
  );

  await pool.query(
    `
    UPDATE active_panels
    SET active = 0
    WHERE guild_id = ?
      AND phase = ?
    `,
    [guildId, phase],
  );

  if (isSwiss) {
    await pool.query(
      `
      INSERT INTO active_panels
      (
        guild_id,
        phase,
        stage,
        message_id,
        channel_id,
        reminded,
        closed,
        active,
        deadline
      )
      VALUES (?, ?, ?, ?, ?, 0, 0, 1, NULL)

      ON DUPLICATE KEY UPDATE
        message_id = VALUES(message_id),
        channel_id = VALUES(channel_id),
        stage = VALUES(stage),
        reminded = 0,
        closed = 0,
        closed_at = NULL,
        active = 1,
        deadline = NULL
      `,
      [guildId, phase, config.stage, message.id, channel.id],
    );
  } else {
    await pool.query(
      `
      INSERT INTO active_panels
      (
        guild_id,
        phase,
        channel_id,
        message_id,
        active,
        reminded,
        closed,
        deadline
      )
      VALUES (?, ?, ?, ?, 1, 0, 0, NULL)

      ON DUPLICATE KEY UPDATE
        message_id = VALUES(message_id),
        channel_id = VALUES(channel_id),
        active = 1,
        reminded = 0,
        closed = 0,
        closed_at = NULL,
        deadline = NULL
      `,
      [guildId, phase, channel.id, message.id],
    );
  }

  return {
    event,
    message,
    config,
  };
}

module.exports = {
  phasesConfig,
  publishPickemPanel,
};
