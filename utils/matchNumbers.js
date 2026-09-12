// Numer meczu w evencie.
//
// Numeracja jest CIĄGŁA w obrębie eventu, a nie liczona od nowa w każdej
// fazie. Wcześniej każde z trzech miejsc tworzących mecze liczyło numer samo,
// z filtrem `AND phase = ?`, więc Play-In, Double Elim i Playoffs zaczynały
// od jedynki i w jednym turnieju istniały trzy mecze "#1".
//
// To nie była tylko kosmetyka. Zapytania listujące sortują po match_no bez
// rozróżniania fazy (server/lib/matchQueries.js, server/routes/publicOverview.js),
// więc przy numeracji od nowa fazy PRZEPLATAŁY SIĘ: podgląd najbliższych
// meczów pokazywał #1 z Play-In, #1 z Double Elim, #1 z Playoffs, potem
// wszystkie #2. Przy numeracji ciągłej samo match_no wystarcza do poprawnej
// kolejności i nie trzeba nigdzie dokładać sortowania po fazie.
//
// Funkcja stoi tutaj, a nie w trzech miejscach naraz, właśnie dlatego, że
// trzy kopie tej samej reguły to powód, dla którego wszystkie trzy miały
// ten sam błąd.
//
// Moduł jest CommonJS, bo woła go bot (natywnie) i serwer (przez
// createRequire w server/app.js).

// Zwraca numer dla KOLEJNEGO meczu. Przy tworzeniu kilku naraz wołający
// zwiększa go sobie sam - transakcja trzyma je razem, a ponowne pytanie bazy
// w pętli i tak zwracałoby tę samą wartość, dopóki INSERT-y nie zostaną
// zatwierdzone.
async function nextMatchNumber(pool, guildId, eventId) {
  const [[next]] = await pool.query(
    `
    SELECT COALESCE(MAX(match_no), 0) + 1 AS nextNo
    FROM matches
    WHERE guild_id = ?
      AND event_id = ?
    `,
    [guildId, eventId],
  );

  return Number(next?.nextNo ?? 1);
}

module.exports = { nextMatchNumber };
