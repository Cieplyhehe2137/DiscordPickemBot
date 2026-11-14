// Lista drużyn do wyboru w formularzu fazy.
//
// Dwie funkcje, które wołają wszystkie cztery formularze faz (Swiss, Play-In,
// Playoffs, Double Elimination). Stały jako domknięcia w jednym wielkim ciele
// publicPickem.js i razem z podziałem tego pliku na moduły musiały trafić
// w jedno miejsce - inaczej byłyby cztery kopie, a dokładnie z tego powodu
// powstał pierwszy etap tych porządków.
//
// loadPhaseTeams dostaje `pool` argumentem, bo nie jest już domknięciem.
// To jedyna zmiana w treści obu funkcji.

/**
 * Lista drużyn do formularza fazy uzupełniona o drużyny z zapisanego typu.
 *
 * Formularze faz budowały listę wyboru wyłącznie z loadActiveTeams()
 * (active = 1), a typy trzymane są jako nazwy tekstowe. Drużyna wyłączona
 * albo przemianowana PO turnieju znikała z listy, więc historyczny typ nie
 * podświetlał się jako wybrany - gracz oglądał własny typ jako pusty.
 *
 * Dokładamy brakujące nazwy na koniec, oznaczone active: false, żeby widok
 * historyczny pokazywał to, co faktycznie zostało zapisane.
 */
export function withPickedTeams(teams, ...nameLists) {
  const known = new Set((teams || []).map((team) => team.name));
  const missing = [];

  for (const list of nameLists) {
    for (const name of list || []) {
      if (name && !known.has(name)) {
        known.add(name);
        missing.push(name);
      }
    }
  }

  return [
    ...(teams || []).map((team) => ({ ...team, active: true })),
    // ujemne id, żeby nie kolidowały z prawdziwymi (front używa ich jako key)
    ...missing.map((name, index) => ({
      id: -(index + 1),
      name,
      active: false,
    })),
  ];
}

/**
 * Drużyny do formularza fazy.
 *
 * OTWARTA faza bierze roster TURNIEJU, a gdy turniej swojego nie ma - roster
 * serwera, tak jak przed wprowadzeniem `event_teams`. Zanim powstaną mecze,
 * nie ma innego źródła, z którego dałoby się ułożyć listę wyboru.
 *
 * ZAMKNIĘTA faza jest w odwrotnej sytuacji. Mecze już są, a roster zdążył
 * odjechać - jest wspólny dla całego serwera, nie dla turnieju, więc po
 * zakończeniu nie ma z tym turniejem nic wspólnego. Na produkcji wyszło to
 * wprost: zakończony IEM Kraków 2026 pokazywał wybieraczkę z dziesięcioma
 * nazwami w rodzaju "DFGDFGDFGS" i ani jedną z dwudziestu czterech drużyn,
 * które w nim zagrały. Prawdziwe nazwy leżały cały czas w jego meczach.
 *
 * Zapytanie o mecze idzie WYŁĄCZNIE przy zamkniętej fazie, więc otwarte
 * typowanie - jedyne, na którym komukolwiek zależy w trakcie turnieju -
 * kosztuje dokładnie tyle samo co wcześniej.
 *
 * Pusta lista przy turnieju bez meczów jest zamierzona. Oficjalny wynik
 * fazy i tak pokazuje się niżej, osobną sekcją; wybieraczka z nazwami
 * z innego turnieju byłaby informacją nieprawdziwą, a nie brakiem.
 */
export async function loadPhaseTeams({
  pool,
  eventId,
  guildId,
  allowed,
  loadEventTeamRows,
}) {
  if (allowed) {
    // Roster TURNIEJU, z zapasem w rosterze serwera - patrz
    // utils/loadEventTeams.js. Stalo tu wlasne zapytanie o `active = 1`,
    // czyli piata kopia tego samego SELECT-a; dopoki turniej nie ma wlasnej
    // listy druzyn, ta funkcja oddaje dokladnie to, co oddawalo tamto
    // zapytanie.
    return loadEventTeamRows(pool, { eventId, guildId, order: "name" });
  }

  const [wiersze] = await pool.query(
    `
    -- Bez sprawdzania NULL-a: obie kolumny sa NOT NULL w schemacie.
    -- Pusty napis NOT NULL przepuszcza, wiec odsiewamy tylko jego.
    -- UNION (a nie UNION ALL) sam usuwa powtorzenia - kazda druzyna gra
    -- w turnieju wiele razy i raz po jednej, raz po drugiej stronie.
    SELECT team_a AS name
    FROM matches
    WHERE event_id = ?
      AND team_a <> ''

    UNION

    SELECT team_b AS name
    FROM matches
    WHERE event_id = ?
      AND team_b <> ''

    ORDER BY name ASC
    `,
    [eventId, eventId],
  );

  // Identyfikatory syntetyczne i DODATNIE - tak samo jak w formularzu Swiss.
  // Front używa ich wyłącznie jako klucza React. Ujemne są już zajęte przez
  // withPickedTeams na nazwy dokładane z zapisanego typu, a dwa zestawy
  // liczone od tej samej strony dałyby powtórzone klucze.
  return wiersze.map((wiersz, index) => ({ id: index + 1, name: wiersz.name }));
}
