// handlers/teamsImportSubmit.js
const { PermissionFlagsBits } = require("discord.js");
const { logInfo, logWarn, logError } = require("../../utils/logger");
const teamsStore = require("../../utils/teamsStore");

// Wiadomość Discorda ma limit 2000 znaków, a słownik potrafi mieć ich
// trzydzieści - wyliczenie wszystkiego zjadłoby całą odpowiedź.
const LIMIT_POZYCJI = 12;

function lista(nazwy) {
  if (nazwy.length <= LIMIT_POZYCJI) return nazwy.join(", ");

  const reszta = nazwy.length - LIMIT_POZYCJI;

  return `${nazwy.slice(0, LIMIT_POZYCJI).join(", ")} i ${reszta} więcej`;
}

module.exports = async function teamsImportSubmit(interaction) {
  try {
    // tylko serwer
    if (!interaction.guildId) {
      return interaction.reply({
        content: "❌ Ta akcja działa tylko na serwerze.",
        ephemeral: true,
      });
    }

    // tylko admin
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content: "⛔ Tylko administracja.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const jsonText = interaction.fields.getTextInputValue("teams_json");

    if (!jsonText || !jsonText.trim()) {
      return interaction.reply({
        content: "⚠️ Pole z JSON-em nie może być puste.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const wynik = await teamsStore.importTeamsFromJsonText(guildId, jsonText);

    const linie = [
      `✅ Słownik drużyn ustawiony na **${wynik.imported}** nazw ` +
        `(zachowane: ${wynik.kept}, dodane: ${wynik.added}, ` +
        `usunięte: ${wynik.removed.length}).`,
    ];

    if (wynik.removed.length) {
      linie.push(`➖ Wypadły ze słownika: ${lista(wynik.removed)}`);
    }

    // CICHE ZABRANIE ROSTERA BYŁO TU GŁÓWNYM BŁĘDEM, więc ta linia jest
    // całym sensem zmiany: drużyna usunięta ze słownika wypada też
    // z rosterów turniejów, w których grała (`event_teams` ma CASCADE),
    // a taki turniej wraca na roster serwera i nikt o tym nie wiedział.
    if (wynik.rosterRowsRemoved) {
      linie.push(
        `⚠️ Razem z nimi zniknęło **${wynik.rosterRowsRemoved}** wskazań ` +
          `drużyn w rosterach turniejów: ${lista(wynik.rosterEventsAffected)}. ` +
          `Te turnieje wracają do rostera serwera - sprawdź je w panelu, ` +
          `sekcja Roster.`,
      );
    }

    return interaction.editReply({ content: linie.join("\n") });
  } catch (err) {
    logError("teams", "teamsImportSubmit failed", {
      guildId: interaction.guildId,
      userId: interaction.user?.id,
      message: err.message,
      stack: err.stack,
    });

    let msg = "❌ Nie udało się zaimportować drużyn.";

    if (err?.message === "INVALID_JSON") {
      msg =
        '❌ Błędny JSON. Przykład poprawnego formatu:\n`["FaZe","NAVI","G2"]`';
    } else if (err?.message === "NO_VALID_TEAMS") {
      msg = "⚠️ Nie znaleziono żadnych poprawnych nazw drużyn w danych.";
    } else if (err?.code === "ER_DUP_ENTRY") {
      msg = "⚠️ Część drużyn już istnieje w bazie.";
    }

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: msg });
    }

    return interaction.reply({
      content: msg,
      ephemeral: true,
    });
  }
};
