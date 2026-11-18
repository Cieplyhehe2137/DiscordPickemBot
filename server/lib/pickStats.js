// Liczenie oddanych typow - sama arytmetyka, bez bazy.
//
// Trasa dostarcza wiersze, ten plik je zlicza. Dzieki temu da sie to
// przetestowac bez MySQL-a, a regul nie trzeba zgadywac z zapytan.
//
// DWIE RZECZY, KTORE LATWO ZROBIC ZLE
//
// 1. NAZWY DRUZYN SA TEKSTEM. swiss_predictions, playin_predictions,
//    playoffs_predictions i doubleelim_predictions trzymaja druzyny jako
//    nazwy rozdzielone przecinkiem ("PARIVISION, 100 Thieves"), wpisane
//    przez czlowieka. Grupowanie po surowej nazwie rozjechaloby NAVI
//    i Natus Vincere na dwie druzyny, a FaZe i FaZe Clan na kolejne dwie.
//    Dlatego kazda nazwa idzie przez teamKey, ktory scala warianty, a do
//    pokazania zostaje pierwsza napotkana pisownia.
//
// 2. "ILE TYPOW" TO NIE "ILU GRACZY". Jeden gracz ma w match_predictions
//    tyle wierszy, ile meczow obstawil, wiec suma wierszy mowi o aktywnosci,
//    a nie o frekwencji. Liczymy osobno jedno i drugie, bo admin pyta
//    o oba naraz ("ile typow" i "ilu ludzi").

/**
 * Nazwy druzyn z kolumny tekstowej.
 *
 * Puste wpisy wypadaja, bo "A, , B" i "A,B" to ten sam typ.
 */
export function rozbijNazwy(tekst) {
  return String(tekst ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Liczba albo null - BEZ cichej zamiany pustki na zero.
 *
 * Number(null) to 0, a nie NaN, wiec typ z pusta kolumna przeszedlby jako
 * wynik 0 i przyznal zwyciestwo przeciwnikowi. pred_a/pred_b sa dzis NOT
 * NULL, ale pred_exact_a/pred_exact_b juz nie, a pomylka wyglada w tabeli
 * jak zwykly glos.
 */
function liczbaAlboNull(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null;

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : null;
}

/**
 * Licznik druzyn scalajacy warianty pisowni.
 */
function licznikDruzyn(teamKey) {
  const poKluczu = new Map();

  function dodaj(nazwa, pole, ile = 1) {
    const klucz = teamKey(nazwa);

    if (!klucz) return;

    if (!poKluczu.has(klucz)) {
      poKluczu.set(klucz, {
        klucz,
        nazwa: String(nazwa).trim(),
        zwyciezcaMeczu: 0,
        pick30: 0,
        pick03: 0,
        awans: 0,
        playin: 0,
        polfinal: 0,
        final: 0,
        mistrz: 0,
        trzecieMiejsce: 0,
        razem: 0,
      });
    }

    const wpis = poKluczu.get(klucz);

    wpis[pole] += ile;
    wpis.razem += ile;
  }

  return { poKluczu, dodaj };
}

/**
 * Ilu roznych graczy wystepuje w podanych zbiorach wierszy.
 */
function roznychGraczy(...zbiory) {
  const ids = new Set();

  for (const wiersze of zbiory) {
    for (const w of wiersze ?? []) {
      if (w?.user_id !== null && w?.user_id !== undefined) {
        ids.add(String(w.user_id));
      }
    }
  }

  return ids.size;
}

function podsumuj(wiersze) {
  return {
    typow: (wiersze ?? []).length,
    graczy: roznychGraczy(wiersze),
  };
}

/**
 * Rozklad "ilu graczy obstawilo ile meczow".
 *
 * Mowi to, czego nie powie suma: czy 100 typow zlozylo 13 osob, ktore
 * przeszly caly turniej, czy 50 osob, ktore kliknely jeden mecz i znikly.
 */
function kompletnoscMeczow(typyMeczow, liczbaMeczow) {
  const poGraczu = new Map();

  for (const t of typyMeczow ?? []) {
    const gracz = String(t.user_id);

    if (!poGraczu.has(gracz)) poGraczu.set(gracz, new Set());

    poGraczu.get(gracz).add(String(t.match_id));
  }

  const zliczone = new Map();

  for (const mecze of poGraczu.values()) {
    const ile = mecze.size;

    zliczone.set(ile, (zliczone.get(ile) || 0) + 1);
  }

  const pelne = liczbaMeczow > 0 ? zliczone.get(liczbaMeczow) || 0 : 0;

  // KOSZYKI, NIE SUROWY ROZKLAD. Turniej na 106 meczow daje 68 roznych
  // wartosci, czyli 68 wierszy w panelu - sciana, z ktorej nic nie wynika.
  // Pieciu przedzialow da sie przeczytac jednym spojrzeniem.
  const NAZWY_KOSZYKOW = ["komplet", "duzo", "polowa", "malo", "ledwo"];

  // Komplet ma wlasny koszyk, zeby 99% nie wpadlo razem z 100% - dla admina
  // to rozne rzeczy.
  function koszykDla(ile) {
    if (ile >= liczbaMeczow) return "komplet";

    const udzial = ile / liczbaMeczow;

    if (udzial >= 0.75) return "duzo";
    if (udzial >= 0.5) return "polowa";
    if (udzial >= 0.25) return "malo";

    return "ledwo";
  }

  const koszyki = NAZWY_KOSZYKOW.map((nazwa) => ({ nazwa, graczy: 0 }));

  if (liczbaMeczow > 0) {
    for (const [ile, graczy] of zliczone) {
      const nazwa = koszykDla(ile);

      koszyki.find((k) => k.nazwa === nazwa).graczy += graczy;
    }
  }

  // Najczestsza wartosc zostaje wprost - to ona pokazuje, gdzie ludzie
  // przestawali typowac (w Cologne 68 graczy stanelo dokladnie na 8 meczach,
  // czyli na koncu pierwszego etapu Swiss). Koszyk by to zatarl.
  let najczestszy = null;

  for (const [ile, graczy] of zliczone) {
    if (!najczestszy || graczy > najczestszy.graczy) {
      najczestszy = { ile, graczy };
    }
  }

  return {
    meczow: liczbaMeczow,
    pelne,
    obstawiajacych: poGraczu.size,
    koszyki,
    najczestszy,
  };
}

/**
 * Typy na poszczegolne mapy serii.
 *
 * UWAGA: to numer mapy w serii (1, 2, 3), a NIE nazwa mapy. Nazw map system
 * nie przechowuje w ogole - match_map_results zna wylacznie map_no, a tabeli
 * ze slownikiem map nie ma. Gdyby kiedys mialy byc "Mirage / Inferno",
 * trzeba je najpierw zaczac zapisywac przy wyniku.
 */
function naMapy(typyMap) {
  const poNumerze = new Map();

  for (const t of typyMap ?? []) {
    const nr = Number(t.map_no);

    if (!Number.isInteger(nr) || nr < 1) continue;

    if (!poNumerze.has(nr)) {
      poNumerze.set(nr, { mapNo: nr, typow: 0, gracze: new Set() });
    }

    const wpis = poNumerze.get(nr);

    wpis.typow += 1;

    if (t.user_id !== null && t.user_id !== undefined) {
      wpis.gracze.add(String(t.user_id));
    }
  }

  return [...poNumerze.values()]
    .map((w) => ({ mapNo: w.mapNo, typow: w.typow, graczy: w.gracze.size }))
    .sort((a, b) => a.mapNo - b.mapNo);
}

/**
 * Pelne statystyki typow jednego turnieju.
 *
 * `mecze` to lista meczow turnieju (id, team_a, team_b) - potrzebna, bo
 * match_predictions nie trzyma nazw druzyn, tylko wynik pred_a:pred_b,
 * a kto zostal wytypowany na zwyciezce wynika z porownania tych dwoch
 * liczb z ustawieniem druzyn w meczu.
 */
export function policzStatystykiTypow({
  mecze = [],
  typyMeczow = [],
  typyMap = [],
  typySwiss = [],
  typyPlayin = [],
  typyPlayoffs = [],
  typyDoubleElim = [],
  typyMvp = [],
  teamKey,
}) {
  if (typeof teamKey !== "function") {
    throw new TypeError("policzStatystykiTypow wymaga teamKey");
  }

  const { poKluczu, dodaj } = licznikDruzyn(teamKey);

  /* --- mecze: zwyciezca wynika z pred_a vs pred_b --------------------- */

  const meczPoId = new Map(
    (mecze ?? []).map((m) => [String(m.id), m]),
  );

  for (const t of typyMeczow) {
    const mecz = meczPoId.get(String(t.match_id));

    if (!mecz) continue;

    const a = liczbaAlboNull(t.pred_a);
    const b = liczbaAlboNull(t.pred_b);

    if (a === null || b === null || a === b) continue;

    dodaj(a > b ? mecz.team_a : mecz.team_b, "zwyciezcaMeczu");
  }

  /* --- swiss: 3-0, 0-3, awans ---------------------------------------- */

  for (const t of typySwiss) {
    for (const n of rozbijNazwy(t.pick_3_0)) dodaj(n, "pick30");
    for (const n of rozbijNazwy(t.pick_0_3)) dodaj(n, "pick03");
    for (const n of rozbijNazwy(t.advancing)) dodaj(n, "awans");
  }

  /* --- play-in, playoffs, double elim -------------------------------- */

  for (const t of typyPlayin) {
    for (const n of rozbijNazwy(t.teams)) dodaj(n, "playin");
  }

  for (const t of typyPlayoffs) {
    for (const n of rozbijNazwy(t.semifinalists)) dodaj(n, "polfinal");
    for (const n of rozbijNazwy(t.finalists)) dodaj(n, "final");
    for (const n of rozbijNazwy(t.winner)) dodaj(n, "mistrz");
    for (const n of rozbijNazwy(t.third_place_winner)) {
      dodaj(n, "trzecieMiejsce");
    }
  }

  for (const t of typyDoubleElim) {
    for (const n of rozbijNazwy(t.upper_final_a)) dodaj(n, "final");
    for (const n of rozbijNazwy(t.upper_final_b)) dodaj(n, "final");
    for (const n of rozbijNazwy(t.lower_final_a)) dodaj(n, "final");
    for (const n of rozbijNazwy(t.lower_final_b)) dodaj(n, "final");
  }

  /* --- podsumowania --------------------------------------------------- */

  const fazy = {
    mecze: {
      ...podsumuj(typyMeczow),
      meczowObstawionych: new Set(
        typyMeczow.map((t) => String(t.match_id)),
      ).size,
    },
    mapy: podsumuj(typyMap),
    swiss: podsumuj(typySwiss),
    playin: podsumuj(typyPlayin),
    playoffs: podsumuj(typyPlayoffs),
    doubleelim: podsumuj(typyDoubleElim),
    mvp: podsumuj(typyMvp),
  };

  const typowRazem = Object.values(fazy).reduce((s, f) => s + f.typow, 0);

  return {
    ogolem: {
      typow: typowRazem,
      graczy: roznychGraczy(
        typyMeczow,
        typyMap,
        typySwiss,
        typyPlayin,
        typyPlayoffs,
        typyDoubleElim,
        typyMvp,
      ),
      meczow: (mecze ?? []).length,
    },
    fazy,
    kompletnosc: kompletnoscMeczow(typyMeczow, (mecze ?? []).length),
    naDruzyny: [...poKluczu.values()].sort(
      (a, b) => b.razem - a.razem || a.nazwa.localeCompare(b.nazwa),
    ),
    naMapy: naMapy(typyMap),
  };
}
