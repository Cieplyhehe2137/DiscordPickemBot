const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

module.exports = async function openSetMatchTimeModal(interaction) {
  const [, matchId] = interaction.customId.split(":");

  if (!matchId) {
    return interaction.reply({
      content: "❌ Brak ID meczu.",
      ephemeral: true,
    });
  }

  // ETYKIETA MUSI PODAWAC TE SAMA STREFE, KTORA CZYTA PARSER.
  //
  // Stalo tu "(UTC)", a parseStartInputToUtc czyta wpisana wartosc jako czas
  // warszawski (utils/matchLock.js: DEFAULT_ZONE = "Europe/Warsaw") - te same
  // dwie strefy, ktore ten projekt juz raz pomylil i zaplacil za to polrocznym
  // bledem w godzinach startu.
  //
  // Administrator, ktory zaufal etykiecie i wpisal UTC, dostawal mecz
  // blokowany DWIE GODZINY PO STARCIE w czasie letnim - czyli typowanie
  // otwarte w trakcie gry. Potwierdzenie po zapisie i komunikat o zlym
  // formacie mowily "czas PL", wiec z trzech napisow klamal jeden.
  const modal = new ModalBuilder()
    .setCustomId(`match_set_time_modal:${matchId}`)
    .setTitle("Ustaw godzinę meczu")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("match_time")
          .setLabel("Data i godzina (czas polski)")
          // Czyszczenie godziny inaczej nie da sie odgadnac - pusty formularz
          // i slowo "clear" robia to samo, a nie ma gdzie tego napisac.
          .setPlaceholder("2026-01-28 18:00 albo clear")
          .setStyle(TextInputStyle.Short)
          .setRequired(true),
      ),
    );

  return interaction.showModal(modal);
};
