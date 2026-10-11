// Synchronizacja map po veto: jedna droga dla skryptu i dla watchera bota.
//
// DLACZEGO WSPOLNY MODUL. Mapy dociaga dzis skrypt uruchamiany recznie
// (scripts/fetchMatchMaps.mjs) i watcher chodzacy w bocie
// (handlers/matches/matchMapsWatcher.js). Gdyby kazde z nich mialo wlasna
// kopie parowania i zapisu, predzej czy pozniej rozjechalyby sie o jeden
// warunek - a ten projekt zaplacil juz za taka pomylke pol roku bledu
// (patrz server/lib/startTime.js).
//
// SIEC JEST WSTRZYKIWANA. `wolaj` podaje sie z zewnatrz, wiec cala logika -
// kiedy w ogole pytac, jak sparowac, co zapisac - ma testy bez dotykania
// API i bez bazy.
//
// BUDZET. Darmowy plan dostawcy to 500 zapytan na MIESIAC. Dlatego:
//
//   - pytamy TYLKO wtedy, gdy jest o co: istnieje mecz, ktory sie zaczal,
//     nie ma kompletu map i nie ma wpisu recznego;
//   - mecze starsze niz OKNO_DNI odpuszczamy. Bez tego jeden mecz, ktorego
//     dostawca nigdy nie pozna (pokazowy, przelozony, custom), trzymalby
//     turniej w stanie "do zrobienia" na zawsze i kazdy tick kosztowalby
//     zapytanie;
//   - identyfikator turnieju u dostawcy jest buforowany, takze gdy go NIE
//     znalezlismy - inaczej nieznany turniej kosztowalby wyszukiwanie przy
//     kazdym tyknieciu.

import {
  ZRODLO,
  buildEventMatchesRequest,
  extractMatches,
  findRecordForMatch,
  mapsForOurMatch,
} from "./mapProviders/cito.js";

import { buildMatchMaps } from "./matchMaps.js";

const API = "https://api.citoapi.com/api/v1";

/** Po ilu dniach od startu przestajemy probowac. */
export const OKNO_DNI = 3;

/**
 * Ile minut po starcie ma sens pytac.
 *
 * Veto konczy sie tuz przed seria, ale dostawca potrzebuje chwili, zeby to
 * zindeksowac. Pytanie w sekundzie startu to zapytanie wyrzucone w bloto.
 */
export const MINUT_PO_STARCIE = 5;

/* ------------------------------------------------------------------ *
 * Bufor identyfikatorow turnieju u dostawcy.
 *
 * Klucz to NASZ event.id. Wartosc { id, do } - `id` moze byc null, co
 * znaczy "szukalismy i nie znalezli". Negatywny wynik tez trzeba pamietac,
 * i to dluzej: turniej, ktorego u nich nie ma, nie pojawi sie przez
 * najblizsze pol godziny.
 * ------------------------------------------------------------------ */
const bufor = new Map();

const BUFOR_TRAFIONY_MS = 12 * 60 * 60 * 1000;
const BUFOR_PUDLO_MS = 6 * 60 * 60 * 1000;

/** Czysci bufor - wylacznie dla testow. */
export function resetMapSyncCache() {
  bufor.clear();
}

/**
 * Mecze, dla ktorych w ogole warto pytac dostawce.
 *
 * Zwraca [] gdy nie ma czego robic - i to jest najwazniejsza odpowiedz tej
 * funkcji, bo wtedy nie idzie ANI JEDNO zapytanie.
 */
export async function znajdzMeczeDoUzupelnienia({
  pool,
  eventId,
  oknoDni = OKNO_DNI,
  minutPoStarcie = MINUT_PO_STARCIE,
}) {
  const [wiersze] = await pool.query(
    `
    SELECT
      m.id, m.guild_id, m.event_id, m.match_no, m.best_of,
      m.team_a, m.team_b, m.start_time_utc,
      (SELECT COUNT(*) FROM match_maps mm WHERE mm.match_id = m.id) AS map_rows,
      (SELECT COUNT(*) FROM match_maps mm
        WHERE mm.match_id = m.id AND mm.source = 'manual') AS manual_rows
    FROM matches m
    WHERE m.event_id = ?
      AND m.start_time_utc IS NOT NULL

      -- Mecz juz sie zaczal (z zapasem na indeksowanie u dostawcy)...
      AND m.start_time_utc <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? MINUTE)

      -- ...ale nie tak dawno, zeby bylo jasne, ze dostawca go nie pozna.
      AND m.start_time_utc >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)

    ORDER BY m.match_no
    `,
    [eventId, minutPoStarcie, oknoDni],
  );

  return wiersze.filter(
    (m) => Number(m.manual_rows) === 0 && Number(m.map_rows) < m.best_of,
  );
}

/** Odnajduje turniej u dostawcy, z buforem w obie strony. */
async function idTurnieju({ wolaj, key, event, teraz }) {
  const wpis = bufor.get(event.id);

  if (wpis && wpis.do > teraz) {
    return { id: wpis.id, zapytania: 0, zBufora: true };
  }

  const url = new URL(`${API}/cs2/search`);

  url.searchParams.set("q", event.name);

  const odpowiedz = await wolaj(url.toString(), {
    "x-api-key": key,
    Accept: "application/json",
  });

  const kandydaci = odpowiedz?.data?.events || [];

  const dokladny = kandydaci.find(
    (k) =>
      String(k.name || "").trim().toLowerCase() ===
      String(event.name || "").trim().toLowerCase(),
  );

  // TYLKO dokladna nazwa. Skrypt uruchamiany recznie moze wziac pierwszego
  // z brzegu i pokazac to czlowiekowi do oceny; watcher nie ma komu tego
  // pokazac, a zapisanie map z cudzego turnieju byloby gorsze niz brak map.
  const id = dokladny?.id || null;

  bufor.set(event.id, {
    id,
    do: teraz + (id ? BUFOR_TRAFIONY_MS : BUFOR_PUDLO_MS),
  });

  return { id, zapytania: 1, zBufora: false };
}

/**
 * Dociaga i (opcjonalnie) zapisuje mapy jednego turnieju.
 *
 * @param pool   pula bazy
 * @param event  { id, name } nasz turniej
 * @param key    klucz do API dostawcy
 * @param wolaj  async (url, headers) => dane - wstrzykiwana siec
 * @param apply  false = tylko policz, nic nie zapisuj
 * @param eventId identyfikator turnieju U DOSTAWCY, gdy znamy go wprost -
 *                wtedy odpada wyszukiwanie i jedno zapytanie z budzetu
 * @param teraz  znacznik czasu w ms (dla testow)
 *
 * Zwraca raport; `zapytania` mowi, ile kosztowal z budzetu.
 */
export async function syncEventMaps({
  pool,
  event,
  key,
  wolaj,
  apply = false,
  eventId = null,
  teraz = Date.now(),
  oknoDni = OKNO_DNI,
  minutPoStarcie = MINUT_PO_STARCIE,
}) {
  if (!key) return { ok: false, powod: "brak klucza", zapytania: 0 };

  const doZrobienia = await znajdzMeczeDoUzupelnienia({
    pool,
    eventId: event.id,
    oknoDni,
    minutPoStarcie,
  });

  // NAJWAZNIEJSZE WYJSCIE: nie ma o co pytac, wiec nie pytamy.
  if (!doZrobienia.length) {
    return { ok: true, powod: "nie ma czego uzupelniac", zapytania: 0, plan: [] };
  }

  let zapytania = 0;

  // Podany wprost identyfikator oszczedza zapytanie wyszukiwania.
  const turniej = eventId
    ? { id: eventId, zapytania: 0, zBufora: false }
    : await idTurnieju({ wolaj, key, event, teraz });

  zapytania += turniej.zapytania;

  if (!turniej.id) {
    return {
      ok: false,
      powod: "dostawca nie zna tego turnieju",
      zapytania,
      plan: [],
    };
  }

  const zadanie = buildEventMatchesRequest({ key, eventId: turniej.id });

  if (!zadanie.ok) {
    return { ok: false, powod: zadanie.reason, zapytania, plan: [] };
  }

  const odpowiedz = await wolaj(zadanie.url, zadanie.headers);

  zapytania += 1;

  const ichMecze = extractMatches(odpowiedz);

  const plan = [];
  const bezPary = [];

  for (const nasz of doZrobienia) {
    const znalezione = findRecordForMatch({ nasz, rekordy: ichMecze });

    if (!znalezione.ok) {
      bezPary.push({ ...nasz, powod: znalezione.reason });
      continue;
    }

    const { names, pickers } = mapsForOurMatch({
      nasz,
      rekord: znalezione.rekord,
    });

    if (!names.some((n) => n)) {
      bezPary.push({ ...nasz, powod: "sparowany, ale bez nazw map" });
      continue;
    }

    const zbudowane = buildMatchMaps({
      bestOf: nasz.best_of,
      names: names.slice(0, nasz.best_of),
      pickers: pickers.slice(0, nasz.best_of),
      source: ZRODLO,
    });

    if (!zbudowane.ok) {
      bezPary.push({ ...nasz, powod: zbudowane.reason });
      continue;
    }

    plan.push({ nasz, rows: zbudowane.rows, unknown: zbudowane.unknown });
  }

  if (!apply) {
    return { ok: true, zapytania, plan, bezPary, zapisanych: 0, podglad: true };
  }

  let zapisanych = 0;

  for (const p of plan) {
    for (const r of p.rows) {
      // `manual` chronimy warunkiem W SAMYM ZAPYTANIU, a nie tylko filtrem
      // wyzej - miedzy odczytem a zapisem administrator mogl zdazyc cos
      // wpisac.
      const [wynik] = await pool.query(
        `
        INSERT INTO match_maps
          (guild_id, event_id, match_id, map_no, map_name, picked_by, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          map_name  = IF(match_maps.source = 'manual', match_maps.map_name, VALUES(map_name)),
          picked_by = IF(match_maps.source = 'manual', match_maps.picked_by, VALUES(picked_by)),
          source    = IF(match_maps.source = 'manual', match_maps.source, VALUES(source))
        `,
        [
          p.nasz.guild_id,
          p.nasz.event_id,
          p.nasz.id,
          r.map_no,
          r.map_name,
          r.picked_by,
          r.source,
        ],
      );

      if (wynik.affectedRows) zapisanych += 1;
    }
  }

  return { ok: true, zapytania, plan, bezPary, zapisanych, podglad: false };
}
