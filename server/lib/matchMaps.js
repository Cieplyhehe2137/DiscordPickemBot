// Mapy rozegrane w serii: nazwy po veto i to, czyj byl pick.
//
// CZEGO BRAKOWALO. Tabela `match_maps` stoi w schemacie od poczatku i ma
// dokladnie wlasciwy ksztalt - map_no, map_name, picked_by - ale jest PUSTA,
// zero wierszy, nic do niej nie pisze. Dlatego serwis nigdy nie powiedzial
// ani slowa o Mirage czy Nuke; mowi "Mapa 2 / Pick MOUZ", bo tyle da sie
// wyliczyc z samego formatu serii. Ten modul jest regula, ktora te tabele
// zaczyna wypelniac.
//
// DWA ZRODLA, JEDNA REGULA. Mapy wpisuje administrator po veto albo dociaga
// skrypt z Liquipedii. Obie drogi przechodza przez `buildMatchMaps`, zeby
// nie powstaly dwa roznie walidujace wejscia - to ten sam wzorzec, co
// lib/startTime.js, gdzie osobna sciezka obok wspolnej reguly wpuscila blad
// na pol roku.
//
// CZYSTY, BEZ IMPORTOW I BEZ ZAPYTAN.

/*
 * NAZWY MAP NIE SA ZAMKNIETA LISTA i to jest decyzja, nie przeoczenie.
 *
 * Valve rotuje pule co kilka miesiecy. Twarda lista dozwolonych nazw
 * znaczylaby, ze pierwszy mecz na nowo dodanej mapie zostaje odrzucony -
 * i to w dniu, w ktorym nikt nie bedzie szukal przyczyny w kodzie sprzed
 * roku. Dlatego ponizsza tablica sluzy do UJEDNOLICANIA zapisu, a nie do
 * zabraniania: nazwa nieznana przechodzi dalej, tylko zostaje oznaczona
 * jako nierozpoznana, zeby panel mogl o tym powiedziec.
 *
 * Klucze sa znormalizowane (male litery, bez znakow innych niz litery
 * i cyfry), wiec "de_dust2", "Dust 2", "DUST II" i "dust-2" trafiaja w ten
 * sam wpis.
 */
const KANONICZNE = new Map(
  Object.entries({
    ancient: "Ancient",
    deancient: "Ancient",

    anubis: "Anubis",
    deanubis: "Anubis",

    dust2: "Dust II",
    dedust2: "Dust II",
    dustii: "Dust II",
    dust: "Dust II",

    inferno: "Inferno",
    deinferno: "Inferno",

    mirage: "Mirage",
    demirage: "Mirage",

    nuke: "Nuke",
    denuke: "Nuke",

    overpass: "Overpass",
    deoverpass: "Overpass",

    train: "Train",
    detrain: "Train",

    vertigo: "Vertigo",
    devertigo: "Vertigo",

    cache: "Cache",
    decache: "Cache",

    cobblestone: "Cobblestone",
    cbble: "Cobblestone",
    decbble: "Cobblestone",

    tuscan: "Tuscan",
    detuscan: "Tuscan",
  }),
);

/** Najdluzsza sensowna nazwa mapy - reszta to wklejony smiec. */
const MAKS_DLUGOSC = 64;

function klucz(nazwa) {
  return String(nazwa)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Ujednolica zapis nazwy mapy.
 *
 * Zwraca { name, known }. `known` mowi, czy nazwa jest z listy, ktora znamy -
 * nieznana NIE jest bledem, tylko informacja dla panelu.
 */
export function normalizeMapName(wejscie) {
  if (typeof wejscie !== "string") return null;

  const przyciete = wejscie.trim().replace(/\s+/g, " ");

  if (!przyciete || przyciete.length > MAKS_DLUGOSC) return null;

  const znane = KANONICZNE.get(klucz(przyciete));

  if (znane) return { name: znane, known: true };

  // Nieznana nazwa musi chociaz wygladac jak nazwa mapy, a nie jak wklejony
  // wiersz tabeli albo adres - inaczej do bazy trafi cokolwiek.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(przyciete)) return null;

  return { name: przyciete, known: false };
}

/** Ile map ma seria o tym formacie. Zgodne z utils/mapLabels.js. */
export function maxMapsFromBo(bestOf) {
  const bo = Number(bestOf);

  if (bo === 1) return 1;
  if (bo === 3) return 3;
  if (bo === 5) return 5;

  return 0;
}

/**
 * PRZYBLIZENIE: czyj BYLBY pick tej mapy, gdyby veto szlo po kolei.
 *
 *   BO3 -> A, B, decider
 *   BO5 -> A, B, A, B, decider
 *
 * TO NIE JEST PRAWDA O VETO i nie wolno tego zapisywac do bazy jako fakt.
 * Zmierzone na produkcji, 37 meczow ESL Pro League Season 24, 113 map
 * porownanych z prawdziwym przebiegiem veto:
 *
 *   zgodne    :  65
 *   NIEZGODNE :  48
 *   trafnosc  :  58%
 *
 * Decidery zgadzaja sie zawsze - ostatnia mapa jest deciderem niezaleznie
 * od wszystkiego. Cala pomylka siedzi w pickach: o tym, kto wybiera
 * pierwszy, decyduje procedura veto, a nie to, ktora druzyne wpisano jako
 * pierwsza.
 *
 *   #1 Falcons vs TYLOO  mapa 1 Mirage: wyliczenie mowi Falcons, pickowal TYLOO
 *   #3 Vitality vs 1win  mapa 1 Dust2:  wyliczenie mowi Vitality, pickowal 1win
 *
 * Zostaje WYLACZNIE jako etykieta na ekranie tam, gdzie prawdy nie mamy -
 * ta sama regula co w utils/mapLabels.js i web/src/lib/mapLabels.js.
 */
export function pickedByForMap(mapNo, bestOf) {
  const bo = Number(bestOf);
  const no = Number(mapNo);
  const ile = maxMapsFromBo(bo);

  if (!ile || !Number.isInteger(no) || no < 1 || no > ile) return null;

  // W BO1 nikt nie pickuje - zostaje mapa, ktorej nie zbanowano.
  if (bo === 1) return "DECIDER";

  if (no === ile) return "DECIDER";

  return no % 2 === 1 ? "TEAM_A" : "TEAM_B";
}

/**
 * Sklada komplet wierszy do zapisania w `match_maps`.
 *
 * @param bestOf  format serii
 * @param names   nazwy map w kolejnosci rozgrywania; krotsza lista jest
 *                dozwolona (veto bywa znane tylko czesciowo), dluzsza nie
 * @param pickers KTO wypickowal kazda mape - 'TEAM_A' | 'TEAM_B' |
 *                'DECIDER' | null, ta sama dlugosc co `names`. Pominiete
 *                znaczy NIE WIEMY i wtedy do bazy idzie NULL.
 * @param source  'manual' albo nazwa dostawcy
 *
 * Zwraca { ok: true, rows, unknown } albo { ok: false, reason, code }.
 *
 * Puste miejsce w srodku listy (null, "") jest DOZWOLONE i pomijane - przy
 * czesciowo znanym veto lepiej zapisac mape trzecia niz nie zapisac nic.
 *
 * PICKEROW NIE ZGADUJEMY. Wpis reczny podaje nazwy map, a nie przebieg
 * veto, wiec jego wiersze maja picked_by = NULL. Wyliczenie z formatu ma
 * 58% trafnosci (patrz pickedByForMap) i zostaje etykieta na ekranie,
 * zamiast udawac fakt w bazie.
 */
export function buildMatchMaps({
  bestOf,
  names,
  pickers = [],
  source = "manual",
} = {}) {
  const ile = maxMapsFromBo(bestOf);

  if (!ile) {
    return {
      ok: false,
      reason: "Nieznany format serii.",
      code: "server.badBestOf",
    };
  }

  if (!Array.isArray(names)) {
    return {
      ok: false,
      reason: "Lista map musi byc tablica.",
      code: "server.badMapList",
    };
  }

  if (names.length > ile) {
    return {
      ok: false,
      reason: `Seria BO${bestOf} ma najwyzej ${ile} map, podano ${names.length}.`,
      code: "server.tooManyMaps",
    };
  }

  const rows = [];
  const unknown = [];

  for (let i = 0; i < names.length; i += 1) {
    const surowa = names[i];

    // Puste miejsce - mapa jeszcze nieznana.
    if (surowa === null || surowa === undefined || String(surowa).trim() === "") {
      continue;
    }

    const znormalizowana = normalizeMapName(surowa);

    if (!znormalizowana) {
      return {
        ok: false,
        reason: `Mapa ${i + 1}: "${String(surowa).slice(0, 40)}" nie wyglada na nazwe mapy.`,
        code: "server.badMapName",
      };
    }

    if (!znormalizowana.known) unknown.push(znormalizowana.name);

    // Tylko trzy wartosci sa sensowne; cokolwiek innego znaczy "nie wiem".
    const picker = Array.isArray(pickers) ? pickers[i] : null;

    const znany =
      picker === "TEAM_A" || picker === "TEAM_B" || picker === "DECIDER"
        ? picker
        : null;

    rows.push({
      map_no: i + 1,
      map_name: znormalizowana.name,
      picked_by: znany,
      source,
    });
  }

  // Ta sama mapa dwa razy w jednej serii to pomylka przy przepisywaniu,
  // a nie stan gry - w CS kazda mapa pada w serii najwyzej raz.
  const nazwy = rows.map((r) => r.map_name.toLowerCase());
  const powtorzone = nazwy.filter((n, i) => nazwy.indexOf(n) !== i);

  if (powtorzone.length) {
    return {
      ok: false,
      reason: `Ta sama mapa podana dwa razy: ${[...new Set(powtorzone)].join(", ")}.`,
      code: "server.duplicateMap",
    };
  }

  return { ok: true, rows, unknown };
}
