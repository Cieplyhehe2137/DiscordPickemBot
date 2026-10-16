// /validate-config - kontrola konfiguracji bota.
//
// CO BYLO ZEPSUTE. Komenda wolala `runValidator(interaction.client)`, czyli
// korzeniowy validateConfig.js - funkcje bez argumentow, ktora nie zwracala
// niczego - i zaraz potem czytala `report.fail.length`. Konczylo sie to
// bledem "Cannot read properties of undefined (reading 'fail')" przy KAZDYM
// uzyciu, od pierwszego dnia. Ta sama funkcja w razie braku configu wolala
// process.exit(1), a komenda nie miala progu uprawnien - czyli istniala
// droga, w ktorej dowolny uczestnik serwera zatrzymywal bota.
//
// Teraz logika siedzi w services/configReport.js, ma testy bez Discorda,
// nigdy nie konczy procesu i nie pokazuje zadnej wartosci z configu - tylko
// nazwy kluczy i werdykty.
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const { getAllGuildConfig } = require("../utils/guildRegistry");
const { buildConfigReport } = require("../services/configReport");

// Pole embeda Discorda miesci 1024 znaki. Bez przyciecia raport z czterech
// serwerow potrafi je przekroczyc i wtedy Discord odrzuca CALA wiadomosc -
// czyli komenda znow nie dziala, tylko z innego powodu.
const LIMIT_POLA = 1024;

function fmt(lista) {
  if (!lista.length) return "-";

  const wiersze = [];

  let dlugosc = 0;

  for (const [i, wpis] of lista.entries()) {
    const wiersz = `• ${wpis}`;

    // 24 znaki zapasu na dopisek o pominietych.
    if (dlugosc + wiersz.length + 1 > LIMIT_POLA - 24) {
      wiersze.push(`… i ${lista.length - i} wiecej`);
      break;
    }

    wiersze.push(wiersz);
    dlugosc += wiersz.length + 1;
  }

  return wiersze.join("\n");
}

/**
 * Czyta z server/.env to, czego raport potrzebuje do kontroli zgodnosci.
 *
 * WYLACZNIE obecnosc klucza API i wartosc MATCH_LOCK_BEFORE_SEC - liczbe
 * sekund. Nic wiecej z tego pliku nie opuszcza tej funkcji, bo stoi w nim
 * haslo do bazy i SESSION_SECRET.
 */
function czytajServerEnv() {
  try {
    const sciezka = path.join(process.cwd(), "server", ".env");

    if (!fs.existsSync(sciezka)) return {};

    const parsed = dotenv.parse(fs.readFileSync(sciezka, "utf8"));

    return {
      hasCitoKey: Boolean(
        parsed.CITO_API_KEY && String(parsed.CITO_API_KEY).trim(),
      ),
      lockBeforeSec: parsed.MATCH_LOCK_BEFORE_SEC ?? null,
    };
  } catch {
    // Brak dostepu do pliku to normalny stan instalacji, w ktorej bot i API
    // stoja na osobnych maszynach. Raport odnotuje, ze kontrola wypadla.
    return {};
  }
}

/** Pobranie kanalu przez klienta bota, w formie, ktorej oczekuje raport. */
function zrobResolveChannel(client) {
  if (!client?.channels?.fetch) return null;

  return async (channelId) => {
    const kanal = await client.channels.fetch(channelId).catch(() => null);

    if (!kanal) return { ok: false, reason: "nie znaleziono" };

    return {
      ok: true,
      type: kanal.type === ChannelType.GuildText ? "text" : String(kanal.type),
      guildId: kanal.guildId ?? null,
    };
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("validate-config")
    .setDescription("Sprawdza konfigurację bota i pokazuje raport")
    .addBooleanOption((option) =>
      option
        .setName("embed")
        .setDescription("Pokazać raport publicznie na kanale")
        .setRequired(false),
    )
    // Raport nazywa kanaly i serwery, wiec nie jest dla kazdego uczestnika.
    // Brak tego progu byl druga polowa usterki tej komendy.
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild | PermissionFlagsBits.Administrator,
    ),

  async execute(interaction) {
    const isPublic = interaction.options.getBoolean("embed") || false;

    await interaction.deferReply({ ephemeral: !isPublic });

    try {
      const report = await buildConfigReport({
        env: process.env,
        guildConfigs: getAllGuildConfig(),
        resolveChannel: zrobResolveChannel(interaction.client),
        serverEnv: czytajServerEnv(),
      });

      const color = report.fail.length
        ? 0xe74c3c
        : report.warn.length
          ? 0xf39c12
          : 0x2ecc71;

      const embed = new EmbedBuilder()
        .setTitle("Kontrola konfiguracji")
        .setDescription(
          report.fail.length
            ? "Znalezione błędy wyłączają funkcje bota."
            : report.warn.length
              ? "Bot działa, ale część funkcji jest nieczynna."
              : "Konfiguracja bez zastrzeżeń.",
        )
        .setColor(color)
        .addFields(
          { name: `Błędy (${report.fail.length})`, value: fmt(report.fail) },
          {
            name: `Ostrzeżenia (${report.warn.length})`,
            value: fmt(report.warn),
          },
          { name: `W porządku (${report.pass.length})`, value: fmt(report.pass) },
        )
        .setTimestamp();

      if (report.extraNotes?.length) {
        embed.addFields({
          name: "📝 Notatki",
          value: fmt(report.extraNotes),
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("validate_config error:", err);

      await interaction.editReply({
        content: `Błąd walidatora: ${err.message || err}`,
      });
    }
  },
};
