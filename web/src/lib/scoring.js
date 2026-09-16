// Punktacja: stawki z serwera i opis tabeli dla strony.
//
// Liczb NIE MA w tym pliku. Wszystkie przychodzą z /api/public/scoring, czyli
// z rules/scoring.js - tego samego modułu, którym bot liczy ranking. Tutaj
// zostaje wyłącznie to, czego serwer nie wie: jak te stawki nazwać po polsku
// i w jakiej kolejności je pokazać.
//
// Powód takiego podziału stoi w nagłówku rules/scoring.js. Ten sam komplet
// stawek stał już kiedyś w dwóch miejscach naraz i rozjechał się cicho -
// regulamin pokazywał 4/4/2 tam, gdzie bot liczył 3/3/1. Wpisanie liczb tutaj
// odtworzyłoby dokładnie ten układ, tylko z frontem w roli drugiej kopii.
//
// Moduł NIE IMPORTUJE niczego i tak ma zostać. Samo pobieranie siedzi w
// api.js, a ten używa import.meta.env, którego nie da się załadować poza
// Vite - jeden taki import i test przestaje móc zaimportować ten plik,
// czyli razem z nim pointsAt.

/**
 * Stawka spod ścieżki "KATEGORIA.KLUCZ" albo null.
 *
 * null, a NIE zero, gdy klucza nie ma. Zero jest w tej tabeli prawdziwą
 * stawką (MAP.MISS), więc "nie znalazłem" i "zero punktów" muszą dać się
 * odróżnić. Inaczej literówka w nazwie klucza pokazuje się na stronie jako
 * regulaminowe 0 pkt - czyli jako informacja, a nie jako brak.
 */
export function pointsAt(scoring, path) {
  const wartosc = String(path)
    .split(".")
    .reduce((biezacy, klucz) => {
      if (biezacy === null || biezacy === undefined) return undefined;

      return biezacy[klucz];
    }, scoring);

  return typeof wartosc === "number" && Number.isFinite(wartosc)
    ? wartosc
    : null;
}

// Tabela zasad w kolejności, w jakiej gracz je spotyka: najpierw mecze, które
// są w każdym turnieju, potem fazy, które zależą od formatu.
//
// `path` jest jedynym łącznikiem z serwerem. Test scoringContract sprawdza,
// że każda z tych ścieżek istnieje w rules/scoring.js - bo literówka nie daje
// tu błędu, tylko wiersz z kreską zamiast stawki.
export const SECTIONS = [
  {
    key: "match",
    title: "Mecze",
    lead:
      "Każdy mecz w turnieju. Punkty za serię i punkty za mapy sumują się - " +
      "to są dwie osobne rzeczy, nie alternatywa.",

    rows: [
      {
        path: "MATCH.WINNER",
        label: "Trafiony zwycięzca serii",
        hint:
          "Dokładny wynik serii nie daje nic ponad to. Typ 2:0 i typ 2:1 " +
          "są warte tyle samo, o ile wskazują tę samą drużynę.",
      },
    ],
  },

  {
    key: "maps",
    title: "Mapy",
    lead:
      "Liczone osobno dla KAŻDEJ mapy w serii. Warunek wstępny: trzeba " +
      "trafić zwycięzcę mapy - bez tego bliski wynik nie daje nic. " +
      "Potem liczy się łączne odchylenie od wyniku, czyli różnica rund po " +
      "jednej stronie plus różnica po drugiej.",

    rows: [
      {
        path: "MAP.EXACT",
        label: "Dokładny wynik mapy",
        hint: "Odchylenie 0 rund.",
      },

      {
        path: "MAP.DIFF_1",
        label: "Odchylenie o 1 rundę",
        hint: "Na przykład typ 13:10 przy wyniku 13:11.",
      },

      {
        path: "MAP.DIFF_2",
        label: "Odchylenie o 2 rundy",
        hint: null,
      },

      {
        path: "MAP.MISS",
        label: "Większe odchylenie albo zły zwycięzca mapy",
        hint: null,
      },
    ],
  },

  {
    key: "swiss",
    title: "Swiss",
    lead: "Punkty naliczają się za każdą trafioną drużynę osobno.",

    rows: [
      { path: "SWISS.PICK_3_0", label: "Drużyna z bilansem 3-0", hint: null },
      { path: "SWISS.PICK_0_3", label: "Drużyna z bilansem 0-3", hint: null },
      { path: "SWISS.ADVANCING", label: "Drużyna, która awansuje", hint: null },
    ],
  },

  {
    key: "playoffs",
    title: "Playoffs",
    lead: "Punkty naliczają się za każdą trafioną drużynę osobno.",

    rows: [
      { path: "PLAYOFFS.SEMIFINALIST", label: "Półfinalista", hint: null },
      { path: "PLAYOFFS.FINALIST", label: "Finalista", hint: null },
      { path: "PLAYOFFS.WINNER", label: "Zwycięzca turnieju", hint: null },

      {
        path: "PLAYOFFS.THIRD_PLACE",
        label: "Zwycięzca meczu o 3. miejsce",
        hint:
          "Tylko w turnieju, w którym organizator wpisał oficjalny wynik " +
          "tego meczu.",
      },
    ],
  },

  {
    key: "playin",
    title: "Play-In",
    lead: "Punkty naliczają się za każdą trafioną drużynę osobno.",

    rows: [
      { path: "PLAY_IN.CORRECT_PICK", label: "Drużyna, która awansuje", hint: null },
    ],
  },

  {
    key: "doubleelim",
    title: "Double Elimination",
    lead:
      "Cztery typy na fazę: Upper Final A, Lower Final A, Upper Final B " +
      "i Lower Final B.",

    rows: [
      { path: "DOUBLE_ELIM.CORRECT_PICK", label: "Każdy trafiony typ", hint: null },
    ],
  },

  {
    key: "mvp",
    title: "MVP",
    lead: "Jeden typ na cały turniej.",

    rows: [{ path: "MVP.CORRECT", label: "Trafiony MVP turnieju", hint: null }],
  },
];
