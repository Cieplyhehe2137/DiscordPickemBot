const { withGuild } = require("../../utils/guildContext");

const { publishPickemPanel } = require("../../utils/pickemPanelPublisher");

const { logInfo, logError } = require("../../utils/logger");

const startedGuilds = new Set();
const runningGuilds = new Set();

// Uchwyty timerow watchera - po jednym komplecie na guild. Bez nich nie da
// sie ich zatrzymac przy zamykaniu procesu i tick potrafi wystartowac
// zapytanie do puli, ktora wlasnie sie zamyka.
const timery = [];

// Nieudane próby per event. Zlecenie zostaje w kolejce dopóki się nie uda,
// więc bez licznika watcher ponawia je co 30 sekund w nieskończoność -
// źle ustawiony kanał daje wieczny strumień błędów w logach i nikt się
// nie dowiaduje, że event nigdy nie wystartuje.
const nieudanePodejscia = new Map();

// Ile razy ponawiać błąd, który może być chwilowy (rate limit, sieć,
// awaria Discorda). Przy tyknięciu co 30 s daje to ~2,5 minuty.
const MAX_PODEJSC = 5;

// Błędy Discorda, których ponawianie nie ma sensu - to konfiguracja,
// nie chwilowa awaria. Nie czekamy z nimi pięciu podejść.
const BLEDY_KONFIGURACJI = new Map([
  [10003, "kanał nie istnieje lub bot go nie widzi"],
  [50001, "bot nie ma dostępu do kanału"],
  [50013, "bot nie ma uprawnień do pisania na kanale"],
]);

// Zdejmuje zlecenie z kolejki - tak samo, jak robi to ręczne anulowanie
// auto-startu, więc panel admina przestaje pokazywać event jako zaplanowany.
async function porzucZlecenie(pool, guildId, eventId) {
  await pool.query(
    `
    UPDATE events
    SET
      auto_start_at = NULL,
      auto_start_phase = NULL,
      auto_start_channel_id = NULL
    WHERE id = ?
      AND guild_id = ?
    `,
    [eventId, guildId],
  );

  nieudanePodejscia.delete(eventId);
}

function startPickemAutoStartWatcher(client, guildId) {
  const key = String(guildId || "");

  if (!key || startedGuilds.has(key)) {
    return;
  }

  startedGuilds.add(key);

  logInfo("PickEm auto-start watcher started", { guildId });

  const tick = async () => {
    if (runningGuilds.has(key)) {
      return;
    }

    runningGuilds.add(key);

    try {
      await withGuild(guildId, async ({ pool }) => {
        // ==================================================
        // EVENTY GOTOWE DO AUTO-STARTU
        // ==================================================
        //
        // Auto-start może podnieść tylko event:
        //
        // status    = UPCOMING
        // is_open   = 0
        // is_active = 0
        //
        // Sam watcher NIE aktywuje eventu.
        // Robi to publishPickemPanel() dopiero po
        // poprawnym opublikowaniu panelu na Discordzie.
        // ==================================================

        const [rows] = await pool.query(
          `
          SELECT
            id,
            name,
            auto_start_phase,
            auto_start_channel_id,
            auto_start_at
          FROM events
          WHERE guild_id = ?
            AND status = 'UPCOMING'
            AND is_open = 0
            AND is_active = 0
            AND COALESCE(is_archived, 0) = 0
            AND auto_start_at IS NOT NULL
            AND auto_start_phase IS NOT NULL
            AND auto_start_channel_id IS NOT NULL
            AND auto_started_at IS NULL
            AND auto_start_at <= UTC_TIMESTAMP()
          ORDER BY auto_start_at ASC, id ASC
          `,
          [guildId],
        );

        for (const event of rows) {
          try {
            // ================================================
            // PUBLIKACJA + AKTYWACJA EVENTU
            // ================================================
            //
            // publishPickemPanel() jest jedynym miejscem,
            // które przeprowadza:
            //
            // UPCOMING / 0 / 0
            //       ↓
            // OPEN / 1 / 1
            // ================================================

            await publishPickemPanel({
              client,
              pool,
              guildId,
              eventId: Number(event.id),
              phase: event.auto_start_phase,
              channelId: event.auto_start_channel_id,
            });

            // ================================================
            // OZNACZ AUTO-START JAKO WYKONANY
            // ================================================

            const [updateResult] = await pool.query(
              `
              UPDATE events
              SET auto_started_at = UTC_TIMESTAMP()
              WHERE id = ?
                AND guild_id = ?
                AND status = 'OPEN'
                AND is_open = 1
                AND is_active = 1
                AND auto_started_at IS NULL
              `,
              [event.id, guildId],
            );

            if (updateResult.affectedRows !== 1) {
              throw new Error(
                `Event ${event.id} został opublikowany, ale nie udało się oznaczyć auto-startu jako wykonanego.`,
              );
            }

            nieudanePodejscia.delete(event.id);

            logInfo("PickEm started automatically", {
              guildId,
              eventId: Number(event.id),
              eventName: event.name,
              phase: event.auto_start_phase,
              channelId: event.auto_start_channel_id,
            });
          } catch (err) {
            const kod = Number(err?.code);
            const powodKonfiguracji = BLEDY_KONFIGURACJI.get(kod);

            const podejscie = (nieudanePodejscia.get(event.id) || 0) + 1;

            nieudanePodejscia.set(event.id, podejscie);

            // Błąd konfiguracji nie naprawi się sam, więc nie ponawiamy go
            // wcale. Reszta dostaje kilka szans, bo Discord bywa chwilowo
            // niedostępny.
            const poddajemySie =
              Boolean(powodKonfiguracji) || podejscie >= MAX_PODEJSC;

            logError("PickEm automatic start failed", err, {
              guildId,
              eventId: event.id,
              phase: event.auto_start_phase,
              extra: {
                podejscie,
                powod: powodKonfiguracji || "błąd chwilowy lub nieznany",
                poddajemySie,
              },
            });

            if (!poddajemySie) continue;

            try {
              await porzucZlecenie(pool, guildId, event.id);

              logError(
                "PickEm automatic start abandoned",
                new Error(
                  powodKonfiguracji
                    ? `Auto-start eventu ${event.id} porzucony: ${powodKonfiguracji}. ` +
                      `Napraw uprawnienia lub kanał i zaplanuj start ponownie.`
                    : `Auto-start eventu ${event.id} porzucony po ${podejscie} próbach. ` +
                      `Zaplanuj start ponownie.`,
                ),
                { guildId, eventId: event.id, phase: event.auto_start_phase },
              );
            } catch (blad) {
              logError("PickEm auto-start abandon failed", blad, {
                guildId,
                eventId: event.id,
              });
            }
          }
        }
      });
    } catch (err) {
      logError("PickEm auto-start watcher tick failed", err, {
        guildId,
      });
    } finally {
      runningGuilds.delete(key);
    }
  };

  // pierwszy check 3 sekundy po starcie
  timery.push(setTimeout(tick, 3000));

  // potem co 30 sekund
  timery.push(setInterval(tick, 30000));
}

// Zatrzymuje watchery wszystkich guildow. Wolane przy zamykaniu bota, zanim
// zamkniemy pule polaczen.
function stopPickemAutoStartWatchers() {
  const ile = timery.length;

  for (const timer of timery) {
    // W Node clearTimeout i clearInterval przyjmuja ten sam obiekt Timeout,
    // wiec jedno wywolanie wystarcza na oba rodzaje.
    clearTimeout(timer);
  }

  timery.length = 0;
  startedGuilds.clear();

  return ile;
}

module.exports = {
  startPickemAutoStartWatcher,
  stopPickemAutoStartWatchers,
};
