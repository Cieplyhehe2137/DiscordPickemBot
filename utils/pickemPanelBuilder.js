const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const { odmien, druzyny } = require("./odmiana");

// Trzeci słownik nazw faz w tym projekcie. Panel mówi 'swiss_stage1',
// konfiguracja typowania drużyn - 'stage1', a events.phase - 'SWISS_STAGE_1'.
// Tłumaczenie trzymamy w jednym miejscu, bo przy poprzednim rozjeździe
// (faza vs phase) wpisy były po cichu pomijane, a endpoint odpowiadał 200.
const FAZA_KONFIGURACJI = {
  swiss_stage1: "stage1",
  swiss_stage2: "stage2",
  swiss_stage3: "stage3",
  playin: "playin",
  playoffs: "playoffs",
  doubleelim: "doubleelim",
};

// events.phase -> faza panelu. Tego używa start typowania spoza Discorda.
const FAZA_PANELU = {
  SWISS_STAGE_1: "swiss_stage1",
  SWISS_STAGE_2: "swiss_stage2",
  SWISS_STAGE_3: "swiss_stage3",
  PLAY_IN: "playin",
  PLAYOFFS: "playoffs",
  DOUBLE_ELIM: "doubleelim",
};

const phasesConfig = {
  swiss_stage1: {
    label: "Swiss Stage 1",
    title: "📌 Typowanie fazy Swiss 1",
    stage: "stage1",
    stageNumber: 1,
    color: "#ff9900",
    opis: (l) =>
      `• 🆙 **${l.x3_0} ${druzyny(l.x3_0)} na 3-0**\n` +
      `• 🆘 **${l.x0_3} ${druzyny(l.x0_3)} na 0-3**\n` +
      `• 🏅 **${l.advancing} ${druzyny(l.advancing)} ` +
      odmien(l.advancing, "awansująca", "awansujące", "awansujących") +
      "**",
    buttonId: "start_swiss_stage1",
    buttonLabel: "Typuj Swiss 1",
  },

  swiss_stage2: {
    label: "Swiss Stage 2",
    title: "📌 Typowanie fazy Swiss 2",
    stage: "stage2",
    stageNumber: 2,
    color: "#ff9900",
    opis: (l) =>
      `• 🆙 **${l.x3_0} ${druzyny(l.x3_0)} na 3-0**\n` +
      `• 🆘 **${l.x0_3} ${druzyny(l.x0_3)} na 0-3**\n` +
      `• 🏅 **${l.advancing} ${druzyny(l.advancing)} ` +
      odmien(l.advancing, "awansująca", "awansujące", "awansujących") +
      "**",
    buttonId: "start_swiss_stage2",
    buttonLabel: "Typuj Swiss 2",
  },

  swiss_stage3: {
    label: "Swiss Stage 3",
    title: "📌 Typowanie fazy Swiss 3",
    stage: "stage3",
    stageNumber: 3,
    color: "#ff9900",
    opis: (l) =>
      `• 🆙 **${l.x3_0} ${druzyny(l.x3_0)} na 3-0**\n` +
      `• 🆘 **${l.x0_3} ${druzyny(l.x0_3)} na 0-3**\n` +
      `• 🏅 **${l.advancing} ${druzyny(l.advancing)} ` +
      odmien(l.advancing, "awansująca", "awansujące", "awansujących") +
      "**",
    buttonId: "start_swiss_stage3",
    buttonLabel: "Typuj Swiss 3",
  },

  playoffs: {
    label: "Playoffs",
    title: "📌 Typowanie fazy Playoffs",
    color: "Green",
    opis: (l) =>
      `• 🏆 **${l.semifinalists} ` +
      odmien(l.semifinalists, "półfinalistę", "półfinalistów", "półfinalistów") +
      "**\n" +
      `• 🥈 **${l.finalists} ` +
      odmien(l.finalists, "finalistę", "finalistów", "finalistów") +
      "**\n" +
      "• 👑 **Zwycięzcę turnieju**" +
      (l.third > 0 ? "\n• 🥉 **3. miejsce (opcjonalnie)**" : ""),
    buttonId: "open_playoffs_dropdown",
    buttonLabel: "Typuj Playoffs",
  },

  doubleelim: {
    label: "Double Elimination",
    title: "📌 Typowanie fazy Double Elim",
    color: "Purple",
    opis: (l) =>
      `• 🔝 **Upper Final A (${l.upperFinalA})**\n` +
      `• 🔻 **Lower Final A (${l.lowerFinalA})**\n` +
      `• 🔝 **Upper Final B (${l.upperFinalB})**\n` +
      `• 🔻 **Lower Final B (${l.lowerFinalB})**`,
    buttonId: "open_doubleelim_modal",
    buttonLabel: "Typuj Double Elim",
  },

  playin: {
    label: "Play-In",
    title: "📌 Typowanie fazy Play-In",
    color: "Blue",
    opis: (l) =>
      `• 🎯 **${l.teams} ${druzyny(l.teams)} ` +
      odmien(l.teams, "awansująca", "awansujące", "awansujących") +
      "**",
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

function buildPickemPanel({ event, eventId, phase, limity }) {
  const config = phasesConfig[phase];

  if (!config) {
    throw new Error(`Unknown Pick'Em phase: ${phase}`);
  }

  if (!limity) {
    throw new Error(`Missing Pick'Em limits for phase: ${phase}`);
  }

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(config.title)
    .setDescription(buildDescription(event.name, config.opis(limity)));

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

// Selektor etapu pokazuje się przed wyborem etapu, więc opis bierzemy
// z limitów Stage 1. W praktyce wszystkie etapy Swiss mają ten sam format,
// a gdyby się różniły, właściwe liczby i tak trafią do panelu
// opublikowanego dla konkretnego etapu.
function buildSwissStageSelector(event, eventId, limity) {
  const embed = new EmbedBuilder()
    .setColor("Orange")
    .setTitle("📌 Typowanie fazy Swiss")
    .setDescription(
      `🏆 **Event:** ${event.name}\n\n` +
        `🎯 **Typujesz:**\n` +
        `• 🆙 **${limity.x3_0} ${druzyny(limity.x3_0)} na 3-0**\n` +
        `• 🆘 **${limity.x0_3} ${druzyny(limity.x0_3)} na 0-3**\n` +
        `• 🏅 **${limity.advancing} ${druzyny(limity.advancing)} ` +
        odmien(limity.advancing, "awansująca", "awansujące", "awansujących") +
        "**\n\n" +
        `🔽 **Wybierz etap fazy Swiss:**`,
    );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("admin_select_swiss_stage")
      .setPlaceholder("Wybierz etap Swiss...")
      .addOptions(
        {
          label: "Swiss Stage 1",
          value: `swiss_stage1:${eventId}`,
        },
        {
          label: "Swiss Stage 2",
          value: `swiss_stage2:${eventId}`,
        },
        {
          label: "Swiss Stage 3",
          value: `swiss_stage3:${eventId}`,
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
  FAZA_KONFIGURACJI,
  FAZA_PANELU,
};
