// Audyt gracza: KOMPLET jego typów w jednym turnieju.
//
// PO CO OSOBNO OD PROFILU. Publiczny profil gracza pokazuje wszystko, czego
// potrzeba do czytania - punkty, miejsce, skuteczność, serie, typy na fazy -
// ale historia meczów jest tam ucięta do DZIESIĘCIU ostatnich. Zmierzone:
// czołowy gracz Kolonii ma 106 typów, więc widać 9% jego wyborów. Do audytu
// („dlaczego ten człowiek ma tyle punktów") to za mało, a alternatywą było
// ręczne grzebanie w bazie.
//
// NIC TU NIE LICZY PUNKTÓW OD NOWA. Punkty przychodzą z match_points, czyli
// z tej samej tabeli, którą sumuje ranking. Gdyby ten moduł je przeliczał,
// audyt pokazywałby inną prawdę niż tabela obok - a to jest dokładnie ten
// rodzaj rozjazdu, który w tym projekcie już raz wyszedł przy stawkach
// punktowych (patrz nagłówek rules/scoring.js).
//
// CZYSTY, BEZ IMPORTÓW - regułę da się sprawdzić bez bazy.

function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

function zwyciezca(a, b) {
  if (a === null || b === null) return null;

  if (a === b) return null;

  return a > b ? "a" : "b";
}

/**
 * Wiersze audytu: jeden na mecz, w kolejności rozgrywania.
 *
 * @param matches     mecze turnieju: id, match_no, phase, team_a, team_b, best_of
 * @param predictions typy gracza na serie: match_id, pred_a, pred_b
 * @param results     wyniki: match_id, res_a, res_b
 * @param mapPicks    typy mapowe: match_id, map_no, pred_exact_a, pred_exact_b
 * @param mapResults  wyniki map: match_id, map_no, exact_a, exact_b
 * @param points      punkty: match_id, source, points
 */
export function buildUserAudit({
  matches = [],
  predictions = [],
  results = [],
  mapPicks = [],
  mapResults = [],
  points = [],
} = {}) {
  const typPoMeczu = new Map();

  for (const p of predictions || []) typPoMeczu.set(Number(p?.match_id), p);

  const wynikPoMeczu = new Map();

  for (const r of results || []) wynikPoMeczu.set(Number(r?.match_id), r);

  // Punkty leżą po JEDNYM WIERSZU NA ŹRÓDŁO (series + map), więc trzeba je
  // zsumować. Pominięcie tego pokazywałoby w audycie połowę dorobku i
  // wyglądałoby na błąd w naliczaniu.
  const punktyPoMeczu = new Map();

  for (const p of points || []) {
    const id = Number(p?.match_id);

    const biezace = punktyPoMeczu.get(id) ?? { series: 0, map: 0, razem: 0 };

    const ile = liczbaAlbo(p?.points, 0);

    if (p?.source === "map") biezace.map += ile;
    else biezace.series += ile;

    biezace.razem += ile;

    punktyPoMeczu.set(id, biezace);
  }

  const mapyTypy = new Map();

  for (const m of mapPicks || []) {
    const id = Number(m?.match_id);

    if (!mapyTypy.has(id)) mapyTypy.set(id, new Map());

    mapyTypy.get(id).set(Number(m?.map_no), m);
  }

  const mapyWyniki = new Map();

  for (const m of mapResults || []) {
    const id = Number(m?.match_id);

    if (!mapyWyniki.has(id)) mapyWyniki.set(id, new Map());

    mapyWyniki.get(id).set(Number(m?.map_no), m);
  }

  const wiersze = [];

  for (const m of matches || []) {
    const id = Number(m?.id);

    const typ = typPoMeczu.get(id) ?? null;
    const wynik = wynikPoMeczu.get(id) ?? null;

    const predA = typ ? liczbaAlbo(typ.pred_a) : null;
    const predB = typ ? liczbaAlbo(typ.pred_b) : null;

    const resA = wynik ? liczbaAlbo(wynik.res_a) : null;
    const resB = wynik ? liczbaAlbo(wynik.res_b) : null;

    const obstawiony = zwyciezca(predA, predB);
    const faktyczny = zwyciezca(resA, resB);

    // Numery map bierzemy z OBU stron. Gracz mógł wpisać typ na mapę, której
    // potem nie rozegrano, a mecz mógł mieć mapę, której nie typował -
    // audyt ma pokazać jedno i drugie, bo to są dwa różne pytania.
    const numery = new Set([
      ...(mapyTypy.get(id)?.keys() ?? []),
      ...(mapyWyniki.get(id)?.keys() ?? []),
    ]);

    const mapy = [...numery]
      .sort((a, b) => a - b)
      .map((nr) => {
        const t = mapyTypy.get(id)?.get(nr) ?? null;
        const w = mapyWyniki.get(id)?.get(nr) ?? null;

        const ta = t ? liczbaAlbo(t.pred_exact_a) : null;
        const tb = t ? liczbaAlbo(t.pred_exact_b) : null;
        const wa = w ? liczbaAlbo(w.exact_a) : null;
        const wb = w ? liczbaAlbo(w.exact_b) : null;

        return {
          map_no: nr,
          pred_a: ta,
          pred_b: tb,
          res_a: wa,
          res_b: wb,

          // null, a nie false: „nie rozegrano" i „nie trafił" to dwie różne
          // rzeczy, a w audycie mylenie ich jest zarzutem pod adresem gracza.
          correct_winner:
            ta === null || wa === null ? null : zwyciezca(ta, tb) === zwyciezca(wa, wb),

          exact: ta === null || wa === null ? null : ta === wa && tb === wb,
        };
      });

    const pkt = punktyPoMeczu.get(id) ?? null;

    wiersze.push({
      match_id: id,
      match_no: liczbaAlbo(m?.match_no),
      phase: m?.phase ?? null,
      team_a: m?.team_a ?? null,
      team_b: m?.team_b ?? null,
      best_of: liczbaAlbo(m?.best_of, 1),

      pred_a: predA,
      pred_b: predB,
      res_a: resA,
      res_b: resB,

      // Czy w ogóle typował. Mecz bez typu to inny wiersz niż mecz
      // wytypowany źle, a w audycie to jest najczęstsze pytanie.
      picked: typ !== null,
      settled: faktyczny !== null,

      correct_winner:
        obstawiony === null || faktyczny === null ? null : obstawiony === faktyczny,

      points: pkt ? pkt.razem : 0,
      series_points: pkt ? pkt.series : 0,
      map_points: pkt ? pkt.map : 0,

      maps: mapy,
    });
  }

  const wytypowane = wiersze.filter((w) => w.picked);
  const rozstrzygniete = wytypowane.filter((w) => w.settled);
  const trafione = rozstrzygniete.filter((w) => w.correct_winner === true);

  return {
    rows: wiersze,

    summary: {
      matches: wiersze.length,
      picked: wytypowane.length,
      settled: rozstrzygniete.length,
      correct: trafione.length,

      // null, a nie zero: „nic nie rozstrzygnięto" i „nic nie trafił" to
      // dwie różne rzeczy.
      accuracy:
        rozstrzygniete.length > 0
          ? Math.round((100 * trafione.length) / rozstrzygniete.length)
          : null,

      points: wiersze.reduce((s, w) => s + w.points, 0),
    },
  };
}
