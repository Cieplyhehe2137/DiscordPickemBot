// Punktacja: stawki z serwera i opis tabeli dla strony.
//
// Liczb NIE MA w tym pliku. Wszystkie przychodzą z /api/public/scoring, czyli
// z rules/scoring.js - tego samego modułu, którym bot liczy ranking. Tutaj
// zostaje wyłącznie to, czego serwer nie wie: jak te stawki nazwać i w jakiej
// kolejności je pokazać. Nazwy to KLUCZE słownika, nie gotowe zdania - strona
// istnieje w pięciu językach, a stawki są w każdym te same.
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
    titleKey: "scoring.match.title",
    leadKey: "scoring.match.lead",

    rows: [
      {
        path: "MATCH.WINNER",
        labelKey: "scoring.matchWinner.label",
        hintKey: "scoring.matchWinner.hint",
      },
    ],
  },

  {
    key: "maps",
    titleKey: "scoring.maps.title",
    leadKey: "scoring.maps.lead",

    rows: [
      {
        path: "MAP.EXACT",
        labelKey: "scoring.mapExact.label",
        hintKey: "scoring.mapExact.hint",
      },

      {
        path: "MAP.DIFF_1",
        labelKey: "scoring.mapDiff1.label",
        hintKey: "scoring.mapDiff1.hint",
      },

      {
        path: "MAP.DIFF_2",
        labelKey: "scoring.mapDiff2.label",
        hintKey: null,
      },

      {
        path: "MAP.MISS",
        labelKey: "scoring.mapMiss.label",
        hintKey: null,
      },
    ],
  },

  {
    key: "swiss",
    titleKey: "phase.swiss",
    leadKey: "scoring.perTeam.lead",

    rows: [
      {
        path: "SWISS.PICK_3_0",
        labelKey: "scoring.swiss30.label",
        hintKey: null,
      },
      {
        path: "SWISS.PICK_0_3",
        labelKey: "scoring.swiss03.label",
        hintKey: null,
      },
      {
        path: "SWISS.ADVANCING",
        labelKey: "scoring.advancing.label",
        hintKey: null,
      },
    ],
  },

  {
    key: "playoffs",
    titleKey: "phase.playoffs",
    leadKey: "scoring.perTeam.lead",

    rows: [
      {
        path: "PLAYOFFS.SEMIFINALIST",
        labelKey: "scoring.semifinalist.label",
        hintKey: null,
      },
      {
        path: "PLAYOFFS.FINALIST",
        labelKey: "scoring.finalist.label",
        hintKey: null,
      },
      {
        path: "PLAYOFFS.WINNER",
        labelKey: "scoring.winner.label",
        hintKey: null,
      },

      {
        path: "PLAYOFFS.THIRD_PLACE",
        labelKey: "scoring.thirdPlace.label",
        hintKey: "scoring.thirdPlace.hint",
      },
    ],
  },

  {
    key: "playin",
    titleKey: "phase.playin",
    leadKey: "scoring.perTeam.lead",

    rows: [
      {
        path: "PLAY_IN.CORRECT_PICK",
        labelKey: "scoring.advancing.label",
        hintKey: null,
      },
    ],
  },

  {
    key: "doubleelim",
    titleKey: "phase.doubleElim",
    leadKey: "scoring.doubleElim.lead",

    rows: [
      {
        path: "DOUBLE_ELIM.CORRECT_PICK",
        labelKey: "scoring.anyCorrect.label",
        hintKey: null,
      },
    ],
  },

  {
    key: "mvp",
    titleKey: "scoring.mvp.title",
    leadKey: "scoring.mvp.lead",

    rows: [
      {
        path: "MVP.CORRECT",
        labelKey: "scoring.mvpCorrect.label",
        hintKey: null,
      },
    ],
  },
];
