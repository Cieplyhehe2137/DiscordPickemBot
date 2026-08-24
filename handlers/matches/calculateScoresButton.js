// handlers/calculateScoresButton.js
const calculateScores = require("./calculateScores");

module.exports = async function calculateScoresButton(interaction, client) {
  const guildId = interaction.guildId;

  if (!guildId) {
    throw new Error("calculateScoresButton called without guildId");
  }

  // eventId świadomie null: calculateScores samo ustala event (aktywny, a gdy
  // go nie ma - ostatni z meczami). Wcześniej stała tu zmienna `eventId`,
  // która nigdy nie została zadeklarowana, więc przycisk wywracał się na
  // ReferenceError i nie działał w ogóle. Zniknął też otaczający withGuild:
  // calculateScores otwiera własny kontekst gildii, więc opakowanie tylko
  // dokładało drugie zapytanie do puli.
  const wynik = await calculateScores(guildId, null);

  if (interaction.replied || interaction.deferred) return;

  // Zarchiwizowanego turnieju nie przeliczamy - zasady punktacji map zmieniły
  // się po IEM Cologne 2026, więc przeliczenie przepisałoby zamknięty ranking.
  if (wynik?.skipped) {
    await interaction.reply({
      content:
        `⚠️ Turniej **${wynik.eventName}** jest zarchiwizowany — punkty NIE zostały przeliczone.\n` +
        "Zasady punktacji map zmieniły się po jego zakończeniu, więc przeliczenie zmieniłoby " +
        "zamknięty ranking. Aby zrobić to świadomie, najpierw cofnij archiwizację.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: "✅ Punkty zostały przeliczone",
    ephemeral: true,
  });
};
