// Czy i jaki roster wolno dopisać turniejowi, który już się odbył.
//
// PO CO. `event_teams` zaczęło przyjmować zapisy dopiero w etapie 4
// (server/routes/eventTeams.js), więc KAŻDY turniej sprzed tej zmiany nie ma
// własnego rostera i działa na zapasie - dzisiejszym rosterze serwera
// (`teams.active = 1`). Zapas jest wspólny dla całego serwera, nie dla
// turnieju, i po zakończeniu turnieju nie ma z nim nic wspólnego: zakończony
// IEM Cologne Major 2026 dostaje szesnaście dziś aktywnych drużyn, a zagrało
// w nim trzydzieści dwie. Prawdziwa lista uczestników leży cały czas w jego
// meczach.
//
// Ten moduł sam NICZEGO nie czyta i nie zapisuje. Dostaje gotowe dane
// i odpowiada na jedno pytanie: czy ten turniej wolno tknąć automatem,
// a jeśli tak - jaki dokładnie roster powstanie. Dzięki temu całą decyzję
// da się sprawdzić testami bez bazy; zapisem zajmuje się
// scripts/backfillEventTeams.mjs.
//
// ŹRÓDŁEM SĄ MECZE I OPUBLIKOWANE WYNIKI, A NIE TYPY. To rozróżnienie jest
// tu najważniejsze:
//
//   - MECZE to lista uczestników. Każdy uczestnik gra co najmniej jeden mecz,
//     więc mecze są jedyną kompletną odpowiedzią na "kto tu zagrał".
//
//   - OPUBLIKOWANE WYNIKI faz (`*_results`) dokładają się do meczów, bo roster
//     bramkuje także zapis WYNIKU, nie tylko typu: server/routes/phaseResults.js
//     odrzuca wynik zawierający drużynę spoza rostera ("Unknown or inactive
//     teams"). Gdyby wyniki nie weszły do rostera, backfill mógłby odebrać
//     administratorowi możliwość poprawienia oficjalnej odpowiedzi, którą ten
//     sam turniej już ma zapisaną.
//
//   - TYPY NIE są źródłem, choć to one mają najwięcej nazw. Zapis typu
//     sprawdzał nazwy względem rostera SERWERA, czyli gracz mógł wskazać
//     drużynę, która w tym turnieju nie zagrała. Roster zbudowany z typów
//     byłby listą "kogo dało się wybrać", a nie "kto zagrał".
//
// MECZE SĄ WARUNKIEM, A WYNIKI TYLKO DOKŁADKĄ. Turniej bez ani jednego meczu
// nie dostaje rostera z samych wyników: wyniki wymieniają tych, którzy
// awansowali albo wygrali, więc byłyby listą NIEPEŁNĄ podaną jako pełna.
// Na produkcji taki turniej istnieje - StarLadder Budapest Major 2025 ma
// 1055 zapisanych typów i zero meczów.

import { teamKey } from "./teamLogos.js";

/**
 * Powody odmowy. Kody, nie zdania, bo skrypt grupuje po nich podsumowanie
 * i testy porównują je bez tłumaczenia.
 */
export const POWODY = {
  MA_ROSTER: "maRoster",
  NIE_ZAKONCZONY: "nieZakonczony",
  OTWARTE_TYPOWANIE: "otwarteTypowanie",
  BRAK_MECZOW: "brakMeczow",
  NIEPELNY: "niepelny",
};

/**
 * Czy turniej jest tym, w którym właśnie wolno typować.
 *
 * Warunek przepisany z utils/protectionsGuards.js (getPredictionEventState):
 * typowanie wymaga zgodności WSZYSTKICH TRZECH pól lifecycle. Backfill musi
 * pytać o to samo, bo roster węższy od rzeczywistości blokuje zapis typu -
 * walidacja w czterech formularzach faz odrzuca nazwę spoza rostera.
 */
function otwarteTypowanie(event) {
  return (
    String(event.status) === "OPEN" &&
    Number(event.is_open) === 1 &&
    Number(event.is_active) === 1
  );
}

/** Czy turniej się skończył - jedyny stan, w którym mecze są kompletne. */
function zakonczony(event) {
  return Number(event.is_archived) === 1 || String(event.status) === "FINISHED";
}

/**
 * Nazwy przełożone na wiersze słownika przez `teamKey`.
 *
 * Porównanie napisów NIE wystarczy i to jest sprawdzone na żywej bazie:
 * mecze IEM Cologne mają "BetBoom" przy słownikowym "BETBOOM" i "NAVI" przy
 * "Natus Vincere". STRONA liczy je jako jedną drużynę, bo widoki grupują
 * właśnie po `teamKey` (server/lib/teamLogos.js).
 */
function mapaPoKluczu(slownik) {
  const poKluczu = new Map();

  for (const d of slownik || []) {
    const klucz = teamKey(d.name);

    // Pierwszy wiersz w kolejności słownika wygrywa - tak samo jak w trasie
    // panelu (server/routes/eventTeams.js).
    if (klucz && !poKluczu.has(klucz)) poKluczu.set(klucz, Number(d.id));
  }

  return poKluczu;
}

function przelozNazwy(nazwy, slownik) {
  const poKluczu = mapaPoKluczu(slownik);

  const identyfikatory = new Set();
  const nieznane = [];

  for (const nazwa of nazwy) {
    const id = poKluczu.get(teamKey(nazwa));

    if (id === undefined) {
      if (!nieznane.includes(nazwa)) nieznane.push(nazwa);
      continue;
    }

    identyfikatory.add(id);
  }

  return { identyfikatory, nieznane };
}

/**
 * Decyzja i treść rostera dla jednego turnieju.
 *
 * @param {object} opcje
 * @param {{id:number,status:string,is_archived:number,is_open:number,is_active:number}} opcje.event
 * @param {Array<{id:number,name:string,active:number}>} opcje.slownik
 *   Drużyny serwera W KOLEJNOŚCI SŁOWNIKA (sort_order, potem nazwa).
 * @param {string[]} opcje.nazwyZMeczow
 * @param {string[]} opcje.nazwyZWynikow
 * @param {number} opcje.wierszyRostera Ile wierszy turniej ma już w event_teams.
 * @param {boolean} [opcje.dopuscNiepelny]
 */
export function planEventRoster({
  event,
  slownik,
  nazwyZMeczow,
  nazwyZWynikow,
  wierszyRostera,
  dopuscNiepelny = false,
}) {
  const odmowa = (powod, dodatki = {}) => ({
    zapisac: false,
    powod,
    teamIds: [],
    nieznane: [],
    dodane: [],
    zabrane: [],
    ...dodatki,
  });

  // Roster wskazany w panelu jest decyzją człowieka i automat go nie rusza.
  // Dzięki temu skrypt wolno puścić ponownie - przebieg po przebiegu robi
  // coraz mniej, aż przestaje robić cokolwiek.
  if (Number(wierszyRostera) > 0) return odmowa(POWODY.MA_ROSTER);

  // Trwający turniej ma mecze NIEPEŁNE: wpisane są tylko te, które już się
  // odbyły. Roster z nich byłby węższy od rzeczywistości, a to blokuje zapis
  // typu na drużynę, która jeszcze nie zagrała. Panel zostaje właściwym
  // sposobem na roster turnieju, który trwa.
  if (!zakonczony(event)) return odmowa(POWODY.NIE_ZAKONCZONY);

  if (otwarteTypowanie(event)) return odmowa(POWODY.OTWARTE_TYPOWANIE);

  const zMeczow = (nazwyZMeczow || []).filter(Boolean);

  if (!zMeczow.length) return odmowa(POWODY.BRAK_MECZOW);

  const wszystkie = [...zMeczow, ...(nazwyZWynikow || []).filter(Boolean)];

  const { identyfikatory, nieznane } = przelozNazwy(wszystkie, slownik);

  // Nazwa bez wiersza w słowniku nie ma jak wejść do rostera - powiązanie
  // idzie po `team_id`. Niepełny roster jest jednak gorszy niż jego brak:
  // inne miejsca czytają tę tabelę jako "uczestnicy turnieju", więc
  // osiemnaście z trzydziestu dwóch drużyn to półprawda podana jako pewnik.
  // Odmowa jest domyślna, ale administrator może ją nadpisać świadomie.
  if (nieznane.length && !dopuscNiepelny) {
    return odmowa(POWODY.NIEPELNY, { nieznane });
  }

  // KOLEJNOŚĆ JEST ROZSTAWIENIEM. Skrypt musi złożyć listę dokładnie tak jak
  // panel - przez przefiltrowanie słownika - bo `sort_order` zapisuje się
  // jako pozycja w tej tablicy i czytają go cztery dropdowny wyników admina.
  // Zbiór `identyfikatory` trzyma kolejność NAPOTKANIA nazw w meczach, więc
  // przejście po nim zapisałoby rozstawienie wedle tego, kto zagrał pierwszy.
  const teamIds = slownik
    .filter((d) => identyfikatory.has(Number(d.id)))
    .map((d) => Number(d.id));

  if (!teamIds.length) return odmowa(POWODY.NIEPELNY, { nieznane });

  // Co się zmieni względem tego, co obowiązuje DZIŚ, czyli zapasu
  // (utils/loadEventTeams.js schodzi na `teams.active = 1`).
  const wRosterze = new Set(teamIds);
  const dodane = [];
  const zabrane = [];

  for (const d of slownik) {
    const aktywna = Number(d.active) === 1;
    const wybrana = wRosterze.has(Number(d.id));

    if (wybrana && !aktywna) dodane.push(d.name);
    if (!wybrana && aktywna) zabrane.push(d.name);
  }

  return { zapisac: true, powod: null, teamIds, nieznane, dodane, zabrane };
}

/**
 * Nazwy z typów, które po backfillu wypadną z listy wyboru.
 *
 * Osobno od decyzji, bo NIE jest powodem odmowy, a sprawdzić to trzeba.
 * Typy zamkniętego turnieju i tak nie dają się zapisać ponownie (blokada
 * fazy odpowiada przed walidacją nazw), a widok historyczny dokłada brakujące
 * nazwy z zapisanego typu osobno - server/lib/phaseFormTeams.js,
 * withPickedTeams. Gdyby jednak turniej został kiedyś otwarty ponownie, to ta
 * lista mówi, czyj typ przestanie się zapisywać.
 *
 * Nazwy bez wiersza w słowniku są pomijane: ich na liście wyboru nie ma już
 * dziś, więc backfill niczego im nie zabiera.
 */
export function typyPozaRosterem({ nazwyZTypow, slownik, teamIds }) {
  const wRosterze = new Set((teamIds || []).map(Number));
  const poKluczu = mapaPoKluczu(slownik);

  const poza = [];

  for (const nazwa of nazwyZTypow || []) {
    const id = poKluczu.get(teamKey(nazwa));

    if (id === undefined) continue;

    if (!wRosterze.has(id) && !poza.includes(nazwa)) poza.push(nazwa);
  }

  return poza;
}
