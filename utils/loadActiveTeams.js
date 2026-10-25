// utils/loadActiveTeams.js
//
// JEDNO MIEJSCE, W KTORYM CZYTA SIE LISTE DRUZYN DO WYBORU.
//
// Wczesniej te same dwanascie linii SQL-a stalo w czterech kopiach: tutaj,
// w utils/loadTeamsFromDB.js (ktorego nikt nie wolal) oraz jako prywatne
// funkcje w openDoubleElimDropdown.js i openPlayoffsDropdown.js. Kopie
// zdazyly sie rozjechac - jedna sortowala po nazwie, druga po sort_order -
// wiec ta sama lista druzyn wychodzila w innej kolejnosci w zaleznosci od
// tego, ktory dropdown ja otwieral.
//
// Oba warianty zostaja, bo oba sa uzywane. Roznica miedzy nimi to WYLACZNIE
// ORDER BY i tak ma zostac: kto wola ktory, widac teraz po nazwie.

async function loadActiveTeams(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY name ASC
    `,
    [guildId],
  );

  // filter(Boolean) stalo w obu prywatnych kopiach i w wariancie nizej.
  // Przy `name` NOT NULL nie odcina dzis niczego, ale zdejmuje z wolajacego
  // pytanie, czy na liscie moze stanac pusty wpis.
  return rows.map((r) => r.name).filter(Boolean);
}

// Same as loadActiveTeams but ordered by sort_order first - used by the
// admin "enter official results" dropdowns, where team order in the
// select menu should follow the configured bracket/seed order rather
// than alphabetical.
async function loadActiveTeamsBySortOrder(pool, guildId) {
  const [rows] = await pool.query(
    `
    SELECT name
    FROM teams
    WHERE guild_id = ?
      AND active = 1
    ORDER BY sort_order ASC, name ASC
    `,
    [guildId],
  );

  return rows.map((r) => r.name).filter(Boolean);
}

module.exports = { loadActiveTeams, loadActiveTeamsBySortOrder };
