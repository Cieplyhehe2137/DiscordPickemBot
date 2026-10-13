// Watcher map po veto: dociaga je sam, w trakcie turnieju.
//
// PO CO. Mapy umial dotad dociagnac wylacznie skrypt uruchamiany recznie.
// Przy kolejnym turnieju nikt by o nim nie pamietal i strona pokazywalaby
// "Mapa 1 / Mapa 2" zamiast "Mirage / Nuke" - czyli dokladnie stan sprzed
// calej tej roboty.
//
// BUDZET JEST TU GLOWNYM OGRANICZENIEM, nie wydajnosc. Darmowy plan
// dostawcy to 500 zapytan na MIESIAC. Dlatego watcher:
//
//   1. pyta bazy, czy JEST o co pytac - mecz, ktory sie zaczal, nie ma
//      kompletu map i nie ma wpisu recznego. Poza turniejem to zero
//      zapytan do dostawcy, tylko jedno lekkie do wlasnej bazy;
//   2. odpuszcza mecze starsze niz trzy dni, zeby jeden mecz, ktorego
//      dostawca nigdy nie pozna, nie trzymal turnieju w stanie
//      "do zrobienia" na zawsze;
//   3. ma TWARDY dzienny limit zapytan - bezpiecznik na wypadek, gdyby
//      dwa pierwsze zawiodly.
//
// Przy domyslnych ustawieniach (co 30 minut, najwyzej 16 zapytan na dobe)
// najgorszy miesiac to 480 zapytan, czyli ponizej limitu - a typowy
// o wiele mniej, bo turniej trwa kilkanascie dni, a nie trzydziesci.
//
// WSPOLNA DROGA ZE SKRYPTEM. Parowanie i zapis siedza w server/lib/mapSync.js,
// z ktorego korzysta takze scripts/fetchMatchMaps.mjs. Dwie kopie tej samej
// logiki rozjechalyby sie o jeden warunek - ten projekt zaplacil juz za taka
// pomylke pol roku bledu (patrz server/lib/startTime.js).

const { withGuild } = require("../../utils/guildContext");
const { logInfo, logWarn, logError } = require("../../utils/logger");

const startedGuilds = new Set();
const runningGuilds = new Set();

// Uchwyty timerow - bez nich nie da sie ich zatrzymac przy zamykaniu bota
// i tick potrafi wystartowac zapytanie do puli, ktora wlasnie sie zamyka.
const timery = [];

/** Domyslnie co 30 minut; nie czesciej niz co 5, zeby nie przepalic budzetu. */
function odstepMs() {
  const sekundy = Number(process.env.MAP_SYNC_INTERVAL_SEC || 1800);

  return Math.max(300_000, (Number.isFinite(sekundy) ? sekundy : 1800) * 1000);
}

/** Twardy bezpiecznik: ile zapytan do dostawcy wolno na dobe. */
function dziennyLimit() {
  const n = Number(process.env.MAP_SYNC_MAX_PER_DAY || 16);

  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 16;
}

/* ------------------------------------------------------------------ *
 * Licznik zapytan w oknie doby. Trzymany w procesie, wiec restart bota
 * go zeruje - i tak ma byc: to bezpiecznik przed petla, a nie ksiegowosc.
 * ------------------------------------------------------------------ */
let zuzyteDzis = 0;
let oknoOd = Date.now();

function budzetNaDzis() {
  const teraz = Date.now();

  if (teraz - oknoOd >= 24 * 60 * 60 * 1000) {
    zuzyteDzis = 0;
    oknoOd = teraz;
  }

  return dziennyLimit() - zuzyteDzis;
}

/** Wolanie sieci wstrzykiwane do mapSync - tutaj prawdziwy fetch. */
async function wolaj(url, headers) {
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const tresc = await res.text().catch(() => "");

    // Tresc bledu bywa echem zapytania - przycinamy, zeby do logu nie
    // trafilo nic z naglowkow.
    throw new Error(`cito: HTTP ${res.status} ${tresc.slice(0, 120)}`);
  }

  return res.json();
}

/**
 * Turnieje tego guilda, w ktorych COKOLWIEK moze wymagac map.
 *
 * Jedno lekkie zapytanie do wlasnej bazy. Puste znaczy "nie ruszamy
 * dostawcy" - i tak jest przez wiekszosc czasu.
 */
async function turniejeDoSprawdzenia(pool, guildId, oknoDni, minutPoStarcie) {
  const [wiersze] = await pool.query(
    `
    SELECT DISTINCT e.id, e.name
    FROM events e
    JOIN matches m ON m.event_id = e.id
    WHERE e.guild_id = ?
      AND m.start_time_utc IS NOT NULL
      AND m.start_time_utc <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
      AND m.start_time_utc >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
      AND (SELECT COUNT(*) FROM match_maps mm WHERE mm.match_id = m.id) < m.best_of
      AND NOT EXISTS (
        SELECT 1 FROM match_maps mm
         WHERE mm.match_id = m.id AND mm.source = 'manual'
      )
    `,
    [guildId, minutPoStarcie, oknoDni],
  );

  return wiersze;
}

function startMatchMapsWatcher(client, guildId) {
  const klucz = String(guildId || "");

  if (!klucz) {
    logError("matches", "startMatchMapsWatcher wywolany bez guildId");

    return;
  }

  if (startedGuilds.has(klucz)) return;

  // Bez klucza do dostawcy watcher nie ma co robic. Mowimy o tym RAZ,
  // przy starcie, zamiast co trzydziesci minut.
  //
  // KOMUNIKAT MUSI PODAC, GDZIE SZUKALISMY. Klucz naturalnie laduje
  // w server/.env - tam stoja DB_*, SESSION_SECRET i reszta sekretow, i to
  // ten plik czyta skrypt dociagajacy mapy. Tylko ze bot to osobny proces
  // i laduje WYLACZNIE swoj .env z korzenia (patrz index.js: ENV_FILE ||
  // ".env"). Klucz w samym server/.env wyglada na ustawiony, skrypt go
  // widzi, a watcher nie - i jedyny objaw to brak map, czyli stan
  // nieodroznialny od sprzed calej tej roboty.
  //
  // DLACZEGO logWarn, A NIE logInfo. Na poziomie info ten wiersz ginie
  // w bot.log, ktory rosnie do 5 MB i rotuje. Jako ostrzezenie trafia takze
  // do warnings.log - pliku, ktory przez cztery miesiace uzbieral 54 linie
  // i czyta sie go wlasnie wtedy, gdy czegos brakuje. Instalacja bez klucza
  // placi za to czterema wierszami na restart (po jednym na serwer), a my
  // widzimy niewystartowany watcher od razu, a nie po dniu.
  //
  // W produkcji konsola loggera przepuszcza wlasnie od "warn" w gore, wiec
  // ten komunikat wychodzi dodatkowo na stdout procesu.
  if (!process.env.CITO_API_KEY) {
    logWarn(
      "matches",
      "Watcher map nie startuje: brak CITO_API_KEY w pliku env bota (" +
        (process.env.ENV_FILE || ".env") +
        "). server/.env to NIE ten plik - czyta go API i skrypt map. " +
        "Mapy mozna na razie wpisywac recznie w panelu.",
      { guildId: klucz },
    );

    return;
  }

  startedGuilds.add(klucz);

  const tick = async () => {
    if (runningGuilds.has(klucz)) return;

    runningGuilds.add(klucz);

    try {
      const { syncEventMaps, OKNO_DNI, MINUT_PO_STARCIE } = await import(
        "../../server/lib/mapSync.js"
      );

      await withGuild(klucz, async ({ pool }) => {
        const turnieje = await turniejeDoSprawdzenia(
          pool,
          klucz,
          OKNO_DNI,
          MINUT_PO_STARCIE,
        );

        // Najczestszy przypadek: poza turniejem nie ma czego robic
        // i do dostawcy nie idzie nic.
        if (!turnieje.length) return;

        for (const event of turnieje) {
          if (budzetNaDzis() <= 0) {
            logWarn(
              "matches",
              "Watcher map wstrzymany: wyczerpany dzienny limit zapytan",
              { guildId: klucz, limit: dziennyLimit() },
            );

            return;
          }

          const raport = await syncEventMaps({
            pool,
            event,
            key: process.env.CITO_API_KEY,
            wolaj,
            apply: true,
          });

          zuzyteDzis += raport.zapytania || 0;

          if (raport.zapisanych) {
            logInfo("matches", "Watcher map uzupelnil mapy", {
              guildId: klucz,
              event: event.name,
              map: raport.zapisanych,
              meczow: raport.plan.length,
              zapytan: raport.zapytania,
            });
          } else if (!raport.ok) {
            // Nie blad - dostawca po prostu jeszcze nie ma tych danych
            // albo nie zna turnieju. Bufor w mapSync pilnuje, zeby nie
            // pytac o to samo w kolko.
            logInfo("matches", "Watcher map: nic do zapisania", {
              guildId: klucz,
              event: event.name,
              powod: raport.powod,
            });
          }
        }
      });
    } catch (err) {
      logWarn("matches", "Watcher map: tick nieudany", {
        guildId: klucz,
        error: err.message,
      });
    } finally {
      runningGuilds.delete(klucz);
    }
  };

  // Pierwsze sprawdzenie minute po starcie - nie od razu, zeby nie
  // konkurowac z reszta roboty przy wstawaniu bota.
  timery.push(setTimeout(() => void tick(), 60_000));

  timery.push(setInterval(() => void tick(), odstepMs()));

  logInfo("matches", "Watcher map wystartowal", {
    guildId: klucz,
    coMinut: Math.round(odstepMs() / 60000),
    limitNaDobe: dziennyLimit(),
  });
}

/** Zatrzymuje watchery wszystkich guildow. Wolane przy zamykaniu bota. */
function stopMatchMapsWatchers() {
  const ile = timery.length;

  for (const timer of timery) {
    // clearTimeout i clearInterval przyjmuja ten sam obiekt Timeout.
    clearTimeout(timer);
  }

  timery.length = 0;
  startedGuilds.clear();

  return ile;
}

module.exports = { startMatchMapsWatcher, stopMatchMapsWatchers };
