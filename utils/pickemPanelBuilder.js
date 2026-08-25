const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const phasesConfig = {
  swiss_stage1: {
    label: "Swiss Stage 1",
    title: "📌 Typowanie fazy Swiss 1",
    stage: "stage1",
    stageNumber: 1,
    color: "#ff9900",
    description:
      "• 🆙 **2 drużyny na 3-0**\n" +
      "• 🆘 **2 drużyny na 0-3**\n" +
      "• 🏅 **6 drużyn awansujących**",
    buttonId: "start_swiss_stage1",
    buttonLabel: "Typuj Swiss 1",
  },

  swiss_stage2: {
    label: "Swiss Stage 2",
    title: "📌 Typowanie fazy Swiss 2",
    stage: "stage2",
    stageNumber: 2,
    color: "#ff9900",
    description:
      "• 🆙 **2 drużyny na 3-0**\n" +
      "• 🆘 **2 drużyny na 0-3**\n" +
      "• 🏅 **6 drużyn awansujących**",
    buttonId: "start_swiss_stage2",
    buttonLabel: "Typuj Swiss 2",
  },

  swiss_stage3: {
    label: "Swiss Stage 3",
    title: "📌 Typowanie fazy Swiss 3",
    stage: "stage3",
    stageNumber: 3,
    color: "#ff9900",
    description:
      "• 🆙 **2 drużyny na 3-0**\n" +
      "• 🆘 **2 drużyny na 0-3**\n" +
      "• 🏅 **6 drużyn awansujących**",
    buttonId: "start_swiss_stage3",
    buttonLabel: "Typuj Swiss 3",
  },

  playoffs: {
    label: "Playoffs",
    title: "📌 Typowanie fazy Playoffs",
    color: "Green",
    description:
      "• 🏆 **4 półfinalistów**\n" +
      "• 🥈 **2 finalistów**\n" +
      "• 👑 **Zwycięzcę turnieju**\n" +
      "• 🥉 **3. miejsce (opcjonalnie)**",
    buttonId: "open_playoffs_dropdown",
    buttonLabel: "Typuj Playoffs",
  },

  doubleelim: {
    label: "Double Elimination",
    title: "📌 Typowanie fazy Double Elim",
    color: "Purple",
    description:
      "• 🔝 **Upper Final A (2)**\n" +
      "• 🔻 **Lower Final A (2)**\n" +
      "• 🔝 **Upper Final B (2)**\n" +
      "• 🔻 **Lower Final B (2)**",
    buttonId: "open_doubleelim_modal",
    buttonLabel: "Typuj Double Elim",
  },

  playin: {
    label: "Play-In",
    title: "📌 Typowanie fazy Play-In",
    color: "Blue",
    description: "• 🎯 **8 drużyn awansujących**",
    buttonId: "open_playin_dropdown",
    buttonLabel: "Typuj Play-In",
  },
};

function buildDescription(eventName, description) {
  return (
    `🏆 **Event:** ${eventName}\n\n` +
    `🎯 **Typujesz:**\n` +
    `${description}\n\n` +
    `🎮 **Mecze**\n` +
    `Typuj również wyniki poszczególnych spotkań.\n\n` +
    `📋 **Twoje dane**\n` +
    `Możesz w każdej chwili sprawdzić zapisane typy i statystyki.`
  );
}

function buildPickemPanel({ event, eventId, phase }) {
  const config = phasesConfig[phase];

  if (!config) {
    throw new Error(`Unknown Pick'Em phase: ${phase}`);
  }

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(config.title)
    .setDescription(buildDescription(event.name, config.description));

  if (phase.startsWith("swiss_stage")) {
    embed.setFooter({
      text: "⏰ Typowanie otwarte – brak deadline.",
    });
  } else {
    embed.setFooter({
      text: "Wybierz jedną z opcji poniżej.",
    });
  }

  const mainRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(config.buttonId)
      .setLabel(config.buttonLabel)
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

function buildSwissStageSelector(event) {
  const embed = new EmbedBuilder()
    .setColor("Orange")
    .setTitle("📌 Typowanie fazy Swiss")
    .setDescription(
      `🏆 **Event:** ${event.name}\n\n` +
        `🎯 **Typujesz:**\n` +
        `• 🆙 **2 drużyny na 3-0**\n` +
        `• 🆘 **2 drużyny na 0-3**\n` +
        `• 🏅 **6 drużyn awansujących**\n\n` +
        `🔽 **Wybierz etap fazy Swiss:**`,
    );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("admin_select_swiss_stage")
      .setPlaceholder("Wybierz etap Swiss...")
      .addOptions(
        {
          label: "Swiss Stage 1",
          value: "swiss_stage1",
        },
        {
          label: "Swiss Stage 2",
          value: "swiss_stage2",
        },
        {
          label: "Swiss Stage 3",
          value: "swiss_stage3",
        },
      ),
  );

  return {
    embeds: [embed],
    components: [row],
  };
}

module.exports = {
  phasesConfig,
  buildPickemPanel,
  buildSwissStageSelector,
};
