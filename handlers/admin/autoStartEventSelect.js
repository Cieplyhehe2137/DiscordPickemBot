const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function phaseMenu(eventId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`auto_start:phase_select:${eventId}`)
      .setPlaceholder("Wybierz fazę / etap")
      .addOptions(
        {
          label: "Swiss Stage 1",
          value: "swiss_stage1",
          emoji: "1️⃣",
        },
        {
          label: "Swiss Stage 2",
          value: "swiss_stage2",
          emoji: "2️⃣",
        },
        {
          label: "Swiss Stage 3",
          value: "swiss_stage3",
          emoji: "3️⃣",
        },
        {
          label: "Playoffs",
          value: "playoffs",
          emoji: "🏆",
        },
        {
          label: "Double Elimination",
          value: "doubleelim",
          emoji: "🔁",
        },
        {
          label: "Play-In",
          value: "playin",
          emoji: "🎯",
        },
      ),
  );
}

module.exports = async function autoStartEventSelect(interaction) {
  const value = String(interaction.values?.[0] || "");

  if (value === "new") {
    const modal = new ModalBuilder()
      .setCustomId("auto_start:new_event_modal")
      .setTitle("Nowy event Pick’Em")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("event_name")
            .setLabel("Nazwa eventu")
            .setPlaceholder("np. PGL Singapore 2027")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(255),
        ),
      );

    return interaction.showModal(modal);
  }

  const eventId = Number(value);

  if (!eventId) {
    return interaction.reply({
      content: "❌ Niepoprawny event.",
      ephemeral: true,
    });
  }

  return interaction.update({
    content:
      "✅ Event wybrany. Teraz wybierz fazę, która ma wystartować automatycznie.",
    components: [phaseMenu(eventId)],
  });
};

module.exports.phaseMenu = phaseMenu;
