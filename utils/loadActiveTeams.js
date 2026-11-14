// utils/loadActiveTeams.js
//
// JEDNO MIEJSCE, W KTORYM CZYTA SIE ROSTER SERWERA.
//
// Wczesniej te same dwanascie linii SQL-a stalo w czterech kopiach: tutaj,
// w utils/loadTeamsFromDB.js (ktorego nikt nie wolal) oraz jako prywatne
// funkcje w openDoubleElimDropdown.js i openPlayoffsDropdown.js. Kopie
// zdazyly sie rozjechac - jedna sortowala po nazwie, druga po sort_order -
// wiec ta sama lista druzyn wychodzila w innej kolejnosci w zaleznosci od
// tego, ktory dropdown ja otwieral.
//
// ROSTER SERWERA, A NIE TURNIEJU. Kolumna `active` pelni dzis role "bierze
// udzial w biezacym turnieju", do ktorej nie byla zrobiona - i dlatego
// powstalo utils/loadEventTeams.js, ktore pyta o roster KONKRETNEGO turnieju
// i schodzi na te funkcje jako na zapas. Tutaj zostaje to, czym ta tabela
// jest naprawde: slownikiem druzyn serwera.
//
// Trzy warianty, jedno zapytanie. Roznica miedzy nimi to WYLACZNIE ORDER BY
// i kolejnosc ma zostac rozna: kto wola ktory, widac po nazwie.

const KOLEJNOSC = {
  // Alfabetycznie - tak dziala wiekszosc dropdownow.
  name: "ORDER BY name ASC",

  // Rozstawienie z konfiguracji serwera, potem nazwa. Uzywaja tego panele
  // wpisywania oficjalnych wynikow fazy i dropdown Playoffs.
  sort_order: "ORDER BY sort_order ASC, name ASC",
};

/**
 * Druzyny rostera jako WIERSZE - z identyfikatorem.
 *
 * Istnieje osobno od wariantow nizej, bo formularze faz na stronie potrzebuja
 * `id` (front uzywa go jako klucza Reacta), a dropdowny Discorda - samych
 * nazw. Bez tego zapytanie o roster stalo w dwoch kopiach: tutaj i w
 * server/lib/phaseFormTeams.js.
 */
async function loadActiveTeamRows(pool, guildId, { order = "name" } = {}) {
  const orderBy = KOLEJNOSC[order];

  if (!orderBy) {
    throw new Error(`loadActiveTeamRows: nieznana kolejnosc "${order}"`);
  }

  const [rows] = await pool.query(
    `
    SELECT id, name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ${orderBy}
    `,
    [guildId],
  );

  // filter(Boolean) stalo w obu prywatnych kopiach i w wariancie nizej.
  // Przy `name` NOT NULL nie odcina dzis niczego, ale zdejmuje z wolajacego
  // pytanie, czy na liscie moze stanac pusty wpis.
  return rows.filter((r) => r && r.name);
}

async function loadActiveTeams(pool, guildId) {
  const rows = await loadActiveTeamRows(pool, guildId, { order: "name" });

  return rows.map((r) => r.name);
}

// Same as loadActiveTeams but ordered by sort_order first - used by the
// admin "enter official results" dropdowns, where team order in the
// select menu should follow the configured bracket/seed order rather
// than alphabetical.
async function loadActiveTeamsBySortOrder(pool, guildId) {
  const rows = await loadActiveTeamRows(pool, guildId, {
    order: "sort_order",
  });

  return rows.map((r) => r.name);
}

module.exports = {
  loadActiveTeamRows,
  loadActiveTeams,
  loadActiveTeamsBySortOrder,
};
