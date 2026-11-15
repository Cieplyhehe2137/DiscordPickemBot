// Które drużyny obowiązują w TYM turnieju.
//
// PO CO OSOBNY PLIK NA TRZY LINIE. Ta reguła - "roster turnieju, a gdy go nie
// ma, aktywne drużyny serwera" - jest kontraktem serwera
// (utils/loadEventTeams.js) i front musi ją oddawać dokładnie. Potrzebują jej
// dwa miejsca: panel rostera (zaznaczenie startowe) i formularz meczu (lista
// do wyboru). Dwie kopie rozjechałyby się przy pierwszej zmianie, a rozjazd
// nie wywołałby żadnego błędu - tylko panel pokazywałby inną listę niż ta,
// którą serwer przyjmuje przy zapisie.
//
// `teams` przychodzi z GET /api/events/:slug/teams w kolejności słownika
// (sort_order, potem nazwa) i ta kolejność zostaje zachowana - zarówno panel,
// jak i rozwijane listy pokazywały ją dotąd właśnie tak.

/**
 * @param {{hasRoster?: boolean, teamIds?: Array<number|string>, teams?: Array<{id:number|string, name:string, active?:number|boolean}>}} dane
 *   Odpowiedź GET /api/events/:slug/teams.
 * @returns {Array<{id:number|string, name:string}>} drużyny obowiązujące w tym turnieju
 */
export function effectiveEventTeams(dane) {
  const lista = dane?.teams ?? [];

  // Bez własnego rostera obowiązuje zapas: aktywne drużyny serwera.
  if (!dane?.hasRoster) return lista.filter((team) => team.active);

  const wRosterze = new Set((dane.teamIds ?? []).map(Number));

  // Drużyna wyłączona na serwerze ZOSTAJE, jeśli jest w rosterze - to jest
  // cały powód, dla którego roster turnieju istnieje.
  return lista.filter((team) => wRosterze.has(Number(team.id)));
}

/**
 * Lista uzupełniona o podane nazwy, jeśli jeszcze na niej nie ma.
 *
 * PO CO. Formularz edycji meczu pokazuje drużyny tego meczu, a one nie muszą
 * być na liście obowiązującej - mecz z turnieju bez rostera, którego drużyny
 * dawno wyłączono, zawiera nazwy, których nie ma już w wyborze. Bez
 * doklejenia `select` dostaje wartość, której nie ma wśród opcji: przeglądarka
 * pokazuje pustą pozycję, a admin otwierający edycję po cichu zmienia drużynę
 * meczu.
 *
 * To ten sam wzorzec, co withPickedTeams na serwerze
 * (server/lib/phaseFormTeams.js): widok ma pokazywać to, co jest zapisane,
 * a o przyjęciu zapisu decyduje i tak trasa.
 *
 * @param {Array<{id:number|string, name:string}>} lista
 * @param {...string} nazwy
 */
export function withExtraTeams(lista, ...nazwy) {
  const znane = new Set((lista ?? []).map((team) => team.name));
  const doklejone = [];

  for (const nazwa of nazwy) {
    if (!nazwa || znane.has(nazwa)) continue;

    znane.add(nazwa);

    // Klucz z prefiksem, bo prawdziwe id są liczbami - nie ma jak się zderzyć.
    doklejone.push({ id: `poza-${nazwa}`, name: nazwa });
  }

  return doklejone.length ? [...(lista ?? []), ...doklejone] : (lista ?? []);
}
