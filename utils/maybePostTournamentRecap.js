// Wysyła podsumowanie turnieju na kanał - albo mówi, dlaczego nie wysłało.
//
// Wołane na końcu /end_tournament, po odświeżeniu panelu archiwum. Nazwa
// zaczyna się od "maybe" z tego samego powodu co maybePostMatchStats: ta
// funkcja ma PRAWO nic nie zrobić i wołający musi to przyjąć spokojnie.
//
// NIGDY NIE PRZERYWA KOŃCZENIA TURNIEJU. Zakończenie zapisuje do bazy,
// archiwizuje i wystawia plik - wiadomość na kanale jest przy tym dodatkiem.
// Dlatego każdy błąd kończy się wpisem { posted: false, reason } i logiem,
// a nie wyjątkiem w górę.
//
// KANAŁ. Kolejność prób i powód każdej:
//
//   1. PICKEM_CHANNEL_ID z configu serwera - kanał, na którym stoją panele
//      typowania, czyli tam, gdzie siedzą gracze.
//   2. panel_channel_id z OSTATNIEGO meczu tego turnieju - dwa z czterech
//      serwerów nie mają ustawionego klucza wyżej, a panele meczowe zawsze
//      gdzieś poszły. To jest kanał, który gracze na pewno widzą.
//   3. nic - ARCHIVE_CHANNEL_ID celowo NIE jest zapasem. Kanał archiwum
//      należy do organizatora i podsumowanie dla graczy nie ma tam czego
//      robić; lepiej nie wysłać nic niż wysłać w złe miejsce.
//
// BEZ PROGU, inaczej niż przy statystykach meczu. Tam progi istnieją, bo
// major ma 106 meczów i tyle samo byłoby wiadomości. Tutaj wiadomość jest
// JEDNA na turniej, więc nie ma czego dławić: pomijamy tylko turniej,
// w którym nikt nie zdobył punktu, bo wtedy nie ma czego pokazać.

const { ChannelType } = require("discord.js");

const { logInfo, logWarn } = require("./logger");
const { siteLinks } = require("./siteLinks");
const { fetchTournamentStandings } = require("./fetchTournamentStandings");
const { buildTournamentRecapEmbed } = require("./tournamentRecapEmbed");

async function ostatniKanalPaneli(pool, guildId, eventId) {
  try {
    const [[row]] = await pool.query(
      `
      SELECT panel_channel_id
      FROM matches
      WHERE guild_id = ?
        AND event_id = ?
        AND panel_channel_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
      `,
      [guildId, eventId],
    );

    return row?.panel_channel_id ? String(row.panel_channel_id) : null;
  } catch (err) {
    logWarn("recap", "Nie udalo sie odczytac kanalu paneli", {
      guildId,
      eventId,
      message: err?.message,
    });

    return null;
  }
}

async function maybePostTournamentRecap({
  client,
  pool,
  guildId,
  eventId,
  eventName,
  eventSlug,
  config = {},
  fetchImpl = fetch,
}) {
  if (!client || !pool || !guildId || !eventId) {
    return { posted: false, reason: "missing_arguments" };
  }

  const standings = await fetchTournamentStandings({
    apiBaseUrl: config.PUBLIC_API_URL,
    eventSlug,
    fetchImpl,
  });

  if (!standings) {
    return { posted: false, reason: "no_standings" };
  }

  if (!standings.podium.length) {
    return { posted: false, reason: "nobody_scored" };
  }

  const channelId =
    String(config.PICKEM_CHANNEL_ID || "").trim() ||
    (await ostatniKanalPaneli(pool, guildId, eventId));

  if (!channelId) {
    logWarn("recap", "Brak kanalu na podsumowanie turnieju", {
      guildId,
      eventId,
    });

    return { posted: false, reason: "no_channel" };
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || typeof channel.send !== "function") {
    logWarn("recap", "Kanal podsumowania nieosiagalny", { guildId, channelId });

    return { posted: false, reason: "channel_unavailable" };
  }

  // Kanał z innego serwera to pomyłka w configu, nie sytuacja do obsługi -
  // tak samo sprawdza to panel archiwum.
  if (channel.guildId && String(channel.guildId) !== String(guildId)) {
    logWarn("recap", "Kanal podsumowania nalezy do innego serwera", {
      guildId,
      channelId,
      channelGuildId: String(channel.guildId),
    });

    return { posted: false, reason: "channel_other_guild" };
  }

  if (channel.type !== undefined && channel.type !== ChannelType.GuildText) {
    logWarn("recap", "Kanal podsumowania nie jest tekstowy", {
      guildId,
      channelId,
    });

    return { posted: false, reason: "channel_not_text" };
  }

  const embed = buildTournamentRecapEmbed({
    eventName,
    standings,
    links: siteLinks({
      baseUrl: config.PUBLIC_SITE_URL,
      guildSlug: config.GUILD_SLUG,
      eventSlug,
    }),
  });

  await channel.send({ embeds: [embed] });

  logInfo("recap", "Podsumowanie turnieju wyslane", {
    guildId,
    eventId,
    channelId,
    players: standings.players,
  });

  return { posted: true, channelId, players: standings.players };
}

module.exports = { maybePostTournamentRecap };
