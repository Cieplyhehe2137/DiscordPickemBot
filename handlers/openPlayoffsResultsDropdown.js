// openPlayoffsResultsDropdown.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs/promises");
const path = require("path");

async function loadTeams() {
  const filePath = path.join(process.cwd(), "data", "teams.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

module.exports = async (interaction) => {
  // musi być button
  if (!interaction.isButton()) return;

  // 🔥 NAJWAŻNIEJSZE: poprawione customId
  if (interaction.customId !== "open_results_playoffs") return;

  await interaction.deferReply({ ephemeral: true });

  const teams = await loadTeams();

  const embed = new EmbedBuilder()
    .setTitle("🏆 Ustaw wyniki Playoffs")
    .setDescription(
      "Wybierz drużyny w dropdownach poniżej.\n" +
      "Możesz dodawać partiami — dokładnie jak w Swiss Stage."
    )
    .setColor("#ffcc00");

  // PÓŁFINALIŚCI
  const semifinalsMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("results_playoffs_semifinalists")
      .setPlaceholder("Wybierz półfinalistów (max 4)")
      .setMinValues(0)
      .setMaxValues(4)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );

  // FINALIŚCI
  const finalsMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("results_playoffs_finalists")
      .setPlaceholder("Wybierz finalistów (max 2)")
      .setMinValues(0)
      .setMaxValues(2)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );

  // ZWYCIĘZCA
  const winnerMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("results_playoffs_winner")
      .setPlaceholder("Wybierz zwycięzcę (1 drużyna)")
      .setMinValues(0)
      .setMaxValues(1)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );

  // 3. MIEJSCE (opcjonalne)
  const thirdMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("results_playoffs_third_place_winner")
      .setPlaceholder("Wybierz 3. miejsce (opcjonalne)")
      .setMinValues(0)
      .setMaxValues(1)
      .addOptions(teams.map(t => ({ label: t, value: t })))
  );

  // PRZYCISK ZATWIERDŹ
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("confirm_playoffs_results")
      .setLabel("Zatwierdź")
      .setStyle(ButtonStyle.Success)
  );

  // ODPOWIEDŹ
  return interaction.editReply({
    embeds: [embed],
    components: [
      semifinalsMenu,
      finalsMenu,
      winnerMenu,
      thirdMenu,
      confirmRow
    ]
  });
};
