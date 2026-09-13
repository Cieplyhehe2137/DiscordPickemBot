const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const { withGuild } = require("../utils/guildContext");
const {
  backfillProfiles,
  DOMYSLNY_LIMIT,
} = require("../services/backfillProfiles");

// Uzupełnienie nicków i awatarów graczy z zakończonych turniejów.
//
// Cała logika siedzi w services/backfillProfiles.js - tutaj zostaje samo
// spięcie z Discordem: uprawnienia, pobieranie użytkownika przez klienta bota
// i raport. Dzięki temu to, co robi tysiąc zapytań do cudzego serwisu, ma
// testy, a ta komenda jest na tyle krótka, że widać ją całą naraz.

// Jedna operacja na gildię naraz. Bez tego dwa wywołania pytałyby Discorda
// o tych samych graczy równolegle i podwoiły ruch bez żadnego zysku.
const TRWA = new Set();

// Co ile graczy odświeżać odpowiedź. Edycja odpowiedzi to też zapytanie do
// Discorda - przy co dwudziestym graczu daje ~55 edycji na pełny przebieg.
const CO_ILE_RAPORT = 20;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("uzupelnij_profile")
    .setDescription(
      "Pobiera z Discorda nicki i awatary graczy, którzy nie mają ich w bazie",
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription(
          `Ilu graczy sprawdzić w tym przebiegu (domyślnie ${DOMYSLNY_LIMIT})`,
        )
        .setMinValue(1)
        .setMaxValue(1000),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.editReply(
        "❌ Ta komenda działa tylko na serwerze (nie w DM).",
      );
    }

    if (TRWA.has(guildId)) {
      return interaction.editReply(
        "⏳ Uzupełnianie profili już trwa na tym serwerze.",
      );
    }

    const limit = interaction.options.getInteger("limit") ?? DOMYSLNY_LIMIT;

    TRWA.add(guildId);

    try {
      return await withGuild({ guildId }, async ({ pool }) => {
        let ostatniRaport = 0;

        const wynik = await backfillProfiles({
          pool,
          guildId,
          limit,

          // Klient bota. `fetch` sam korzysta z pamięci podręcznej, więc
          // powtórzony identyfikator nie generuje drugiego zapytania.
          fetchUser: (userId) => interaction.client.users.fetch(userId),

          async onProgress(stan) {
            if (stan.przetworzonych - ostatniRaport < CO_ILE_RAPORT) return;

            ostatniRaport = stan.przetworzonych;

            // Odpowiedź może już nie istnieć (token żyje 15 minut), a to nie
            // powód, żeby przerywać uzupełnianie.
            await interaction
              .editReply(
                `⏳ ${stan.przetworzonych}/${stan.sprawdzonych} — ` +
                  `zapisanych ${stan.zapisanych}`,
              )
              .catch(() => {});
          },
        });

        if (wynik.sprawdzonych === 0) {
          return interaction.editReply(
            "✅ Wszyscy gracze z rankingu mają już nick i awatar.",
          );
        }

        const linie = [
          `✅ Sprawdzonych: **${wynik.sprawdzonych}**`,
          `💾 Zapisanych: **${wynik.zapisanych}**`,
        ];

        if (wynik.nieznanych > 0) {
          linie.push(
            `👻 Kont, których Discord nie zna: **${wynik.nieznanych}** ` +
              "(skasowane — zostaną przy inicjale)",
          );
        }

        if (wynik.bledow > 0) {
          linie.push(
            `⚠️ Nieudanych: **${wynik.bledow}** — uruchom komendę ponownie`,
          );
        }

        if (wynik.sprawdzonych === limit) {
          linie.push(
            "",
            "ℹ️ Limit wyczerpany — uruchom ponownie, żeby wziąć kolejnych.",
          );
        }

        return interaction.editReply(linie.join("\n"));
      });
    } catch (err) {
      console.error("BACKFILL PROFILES ERROR:", err);

      return interaction
        .editReply("❌ Nie udało się uzupełnić profili. Szczegóły w logach.")
        .catch(() => {});
    } finally {
      TRWA.delete(guildId);
    }
  },
};
