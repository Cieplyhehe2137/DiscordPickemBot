// utils/loadEventTeams.js
//
// DRUZYNY KONKRETNEGO TURNIEJU - z zapasem w rosterze serwera.
//
// PO CO. Dotad kazde pytanie "ktore druzyny mozna tu wybrac" szlo do rostera
// SERWERA (utils/loadActiveTeams.js), a rola "bierze udzial w biezacym
// turnieju" byla pelniona przez kolumne `active`. Jedna flaga na serwer nie
// moze obsluzyc dwoch turniejow, wiec przygotowanie nastepnego wymagalo
// zmiany biezacego, a wylaczenie druzyny w trakcie psulo ponowny zapis typu,
// ktory ja zawieral.
//
// ZAPAS JEST CALYM SENSEM TEGO MODULU. Gdy turniej nie ma ani jednego wiersza
// w `event_teams`, funkcje schodza na dzisiejszy roster `active = 1` - czyli
// zachowuja sie DOKLADNIE jak przed ta zmiana. Dzieki temu:
//
//   - kazdy istniejacy turniej dziala bez migracji danych;
//   - wywolania moga przechodzic na te funkcje pojedynczo, a kazde z nich do
//     chwili wskazania rostera zwraca to samo, co zwracalo;
//   - kolejnosc wdrozenia migracji i kodu jest dowolna, bo BRAK TABELI
//     (ER_NO_SUCH_TABLE) schodzi na ten sam zapas.
//
// Ten sam wzorzec ma event_pickem_phases: brak zapisanej konfiguracji znaczy
// wartosci domyslne, a nie blad.
//
// KOLEJNOSC przekazuje sie argumentem i NIE ma tu wartosci "lepszej".
// Wywolania maja rozna i tak ma zostac do czasu, gdy ktos to rozstrzygnie:
// Playoffs sortuje po rozstawieniu, Double Elim alfabetycznie. Przejscie na
// roster turnieju jest po to, zeby nic sie nie zmienilo - a nie zeby przy
// okazji przestawic ludziom listy.

const { logWarn } = require("./logger");
const { loadActiveTeamRows } = require("./loadActiveTeams");

const KOLEJNOSC = {
  name: "ORDER BY t.name ASC",

  // Rozstawienie z TEGO turnieju, nie z konfiguracji serwera.
  sort_order: "ORDER BY et.sort_order ASC, t.name ASC",
};

// Ostrzezenie o braku tabeli leci raz na proces. Przy watcherach, ktore
// chodza w petli, log co wywolanie zalalby kanal logow.
let zglaszanoBrakTabeli = false;

async function czytajRosterTurnieju(pool, { eventId, guildId, orderBy }) {
  try {
    const [rows] = await pool.query(
      `
      SELECT t.id, t.name
      FROM event_teams et
      JOIN teams t
        ON t.id = et.team_id
      WHERE et.event_id = ?
        AND t.guild_id = ?
      ${orderBy}
      `,
      [eventId, guildId],
    );

    return rows.filter((r) => r && r.name);
  } catch (err) {
    // Tabeli jeszcze nie ma - migracja 0014 nie poszla. To jest poprawny
    // stan, nie awaria: schodzimy na roster serwera.
    if (err?.code === "ER_NO_SUCH_TABLE") {
      if (!zglaszanoBrakTabeli) {
        zglaszanoBrakTabeli = true;

        logWarn("teams", "Brak tabeli event_teams - uzywam rostera serwera", {
          migracja: "migrations/0014_event_teams.sql",
        });
      }

      return null;
    }

    // Kazdy inny blad idzie w gore. Potraktowanie go jako "turniej nie ma
    // rostera" dawaloby po cichu inna liste druzyn przy awarii bazy.
    throw err;
  }
}

/**
 * Druzyny turnieju jako WIERSZE { id, name }.
 *
 * `guildId` jest w zapytaniu mimo tego, ze turniej nalezy do jednego serwera:
 * zle zasiany wiersz w event_teams nie moze przez to wciagnac na liste
 * druzyny z innego serwera.
 *
 * @param {{eventId:number|string, guildId:string, order?:"name"|"sort_order"}} opcje
 */
async function loadEventTeamRows(pool, { eventId, guildId, order = "name" }) {
  const orderBy = KOLEJNOSC[order];

  if (!orderBy) {
    throw new Error(`loadEventTeamRows: nieznana kolejnosc "${order}"`);
  }

  if (!guildId) {
    throw new Error("loadEventTeamRows: guildId jest wymagane");
  }

  // Bez turnieju nie ma czego pytac - od razu roster serwera. Zdarza sie
  // przy panelach otwieranych, gdy zaden turniej nie jest otwarty.
  if (eventId) {
    const wlasny = await czytajRosterTurnieju(pool, {
      eventId,
      guildId,
      orderBy,
    });

    if (wlasny && wlasny.length) return wlasny;
  }

  return loadActiveTeamRows(pool, guildId, { order });
}

/** To samo, ale same nazwy - tego oczekuje wiekszosc dropdownow. */
async function loadEventTeamNames(pool, opcje) {
  const rows = await loadEventTeamRows(pool, opcje);

  return rows.map((r) => r.name);
}

module.exports = { loadEventTeamRows, loadEventTeamNames };
