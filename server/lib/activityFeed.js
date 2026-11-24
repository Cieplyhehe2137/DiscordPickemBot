// Ostatnia aktywnosc na serwerze: kto, co i kiedy zapisal.
//
// DLACZEGO Z BAZY, A NIE PRZEZ SOCKET.IO. Typy powstaja w DWOCH niezaleznych
// procesach: bot pisze prosto do bazy (handlers/matches/matchScoreSelect.js,
// matchUserExactSubmit.js, handlers/swiss/submitSwissDropdown.js), a API ma
// wlasne trasy zapisu. Socket.io zyje tylko w procesie API, wiec zdarzenie
// wypychane przy zapisie pokazaloby wylacznie typy oddane na stronie,
// a przegapilo wszystko, co wpada z Discorda - czyli wiekszosc. Czytanie
// znacznikow czasu z bazy widzi oba zrodla, bo nie zalezy od tego, kto pisal.
//
// CZASY SA PRAWDZIWE TYLKO TAM, GDZIE NIKT NIE ROBIL IMPORTU. Zmierzone
// 2026-11-24: iem-cologne-major-2026 ma 6424 typy i 15 roznych znacznikow,
// wszystkie w 14 sekund 10 wrzesnia - to slad wgrania danych, nie typowania.
// pgl-major-singapore-2026 ma 1444 typy i 1418 roznych czasow, epl-season24
// 458 i 457. Lista dziala wiec dla turniejow granych na zywo, a dla wgranego
// pokaze jedno wielkie "wszystko naraz" - stad `importLooking`, zeby panel
// mogl to nazwac, zamiast udawac, ze o 15:41:44 typowalo 500 osob.

/** Rodzaje zdarzen, ktore trafiaja na liste. */
export const ACTIVITY_KINDS = [
  "matchPick",
  "swissPick",
  "playinPick",
  "playoffsPick",
  "doubleelimPick",
  "mvpPick",
  "matchResult",
];

const KNOWN = new Set(ACTIVITY_KINDS);

function toTime(value) {
  if (value === null || value === undefined || value === "") return null;

  const d = value instanceof Date ? value : new Date(value);

  const ms = d.getTime();

  return Number.isFinite(ms) ? ms : null;
}

/**
 * Ile roznych znacznikow czasu przypada na wiersz.
 *
 * Import zapisuje setki wierszy z tym samym czasem, wiec niski stosunek
 * zdradza dane wgrane, a nie wytypowane. Prog 0.2 bierze sie z pomiaru:
 * Cologne ma 15/6424 = 0.002, Singapore 1418/1444 = 0.98.
 */
export function looksImported(rows, prog = 0.2) {
  const czasy = (rows || [])
    .map((r) => toTime(r?.at))
    .filter((t) => t !== null);

  if (czasy.length < 20) return false;

  return new Set(czasy).size / czasy.length < prog;
}

/**
 * Jedna lista zdarzen, od najnowszego.
 *
 * @param sources tablice wierszy { kind, at, user_id, ... } z roznych tabel
 * @param names   Map user_id -> { displayname, username }
 * @param limit   ile wierszy oddac
 */
export function buildActivityFeed({ sources = [], names = null, limit = 50 } = {}) {
  const wszystkie = [];

  let bezCzasu = 0;
  let nieznanyRodzaj = 0;

  for (const zrodlo of sources) {
    for (const r of zrodlo || []) {
      if (!KNOWN.has(r?.kind)) {
        nieznanyRodzaj += 1;

        continue;
      }

      const ms = toTime(r?.at);

      // Wiersz bez czasu nie ma gdzie stanac na osi. Liczymy go, zeby
      // nie zniknal po cichu - brak czasu to sam w sobie objaw.
      if (ms === null) {
        bezCzasu += 1;

        continue;
      }

      wszystkie.push({ ...r, ms });
    }
  }

  wszystkie.sort((a, b) => b.ms - a.ms);

  const przyciete = wszystkie.slice(0, Math.max(0, limit));

  const mapaNazw = names instanceof Map ? names : new Map();

  const items = przyciete.map((r) => {
    const id = r.user_id === null || r.user_id === undefined ? null : String(r.user_id);

    const wpis = id ? mapaNazw.get(id) : null;

    return {
      kind: r.kind,
      at: new Date(r.ms).toISOString(),
      user_id: id,

      // Nick z profilu, a w zapasie ten zapisany przy samym typie: tabele
      // faz niosa wlasna kopie, a match_predictions nie niesie zadnej.
      displayname: wpis?.displayname ?? r.displayname ?? null,
      username: wpis?.username ?? r.username ?? null,

      event_slug: r.event_slug ?? null,
      event_name: r.event_name ?? null,

      phase: r.phase ?? null,
      stage: r.stage ?? null,

      match_id: r.match_id ?? null,
      match_no: r.match_no ?? null,
      team_a: r.team_a ?? null,
      team_b: r.team_b ?? null,
    };
  });

  return {
    items,

    // Ile wierszy w ogole rozpatrzono - KAZDE zrodlo ma wlasny limit, wiec
    // to nie jest liczba wszystkich zdarzen w historii, tylko tych, ktore
    // weszly do sortowania. Nazwa "total" sugerowalaby to pierwsze.
    considered: wszystkie.length,
    skippedWithoutTime: bezCzasu,
    skippedUnknownKind: nieznanyRodzaj,

    // Najnowsze i najstarsze zdarzenie NA LISCIE - panel pokazuje z tego
    // zakres, zeby bylo widac, jak daleko wstecz siega to, co widac.
    newest: items.length ? items[0].at : null,
    oldest: items.length ? items[items.length - 1].at : null,

    importLooking: looksImported(wszystkie),
  };
}
