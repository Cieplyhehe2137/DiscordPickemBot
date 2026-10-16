// utils/matchLock.js

const { DateTime } = require("luxon");

const DEFAULT_ZONE = "Europe/Warsaw";

/**
 * Ile sekund PRZED startem zamyka sie typowanie meczu.
 *
 * DLACZEGO TO MA DOMYSLNA WARTOSC W KODZIE, A NIE ZERO.
 *
 * Ten modul czyta tylko process.env, a MATCH_LOCK_BEFORE_SEC stalo
 * WYLACZNIE w server/.env - czyli widzialo je API, a nie bot. Przy
 * domyslnym zerze dawalo to dwie rozne odpowiedzi na to samo pytanie:
 * strona zamykala typowanie piec minut przed startem, a bot dokladnie
 * o starcie. Przez te piec minut przycisk na Discordzie dzialal, a
 * formularz na stronie juz nie - i gracz, ktory to zglaszal, mial racje.
 *
 * Domyslna wartosc w kodzie sprawia, ze oba procesy licza tak samo takze
 * wtedy, gdy nikt nie ustawil zmiennej. 300 s, bo tyle mialo API - czyli
 * zachowanie, ktore gracze juz znaja ze strony.
 *
 * Pusta wartosc ("MATCH_LOCK_BEFORE_SEC=" w pliku env) znaczy "nie
 * ustawiono" i tez daje wartosc domyslna. Inaczej plik z pustym kluczem
 * zachowywalby sie inaczej niz plik bez klucza, co jest pulapka tego
 * samego rodzaju co ta wyzej.
 */
const DOMYSLNY_LOCK_BEFORE_SEC = 300;

function getLockBeforeSec() {
  const raw = process.env.MATCH_LOCK_BEFORE_SEC;

  const podane = raw === undefined || raw === null ? "" : String(raw).trim();

  if (!podane) return DOMYSLNY_LOCK_BEFORE_SEC;

  const n = Number(podane);

  if (!Number.isFinite(n)) return DOMYSLNY_LOCK_BEFORE_SEC;

  return Math.max(0, Math.floor(n));
}

function startUtcFromDb(start_time_utc) {
  if (!start_time_utc) return null;

  try {
    if (start_time_utc instanceof Date) {
      return DateTime.fromJSDate(start_time_utc).toUTC();
    }

    const dt = DateTime.fromISO(String(start_time_utc), { zone: "utc" });
    return dt.isValid ? dt.toUTC() : null;
  } catch {
    return null;
  }
}

function isMatchStarted(
  { start_time_utc },
  nowUtc = DateTime.utc(),
  lockBeforeSec = getLockBeforeSec(),
) {
  const startUtc = startUtcFromDb(start_time_utc);
  if (!startUtc) return false;
  const threshold = nowUtc.plus({ seconds: lockBeforeSec });
  return threshold >= startUtc;
}

function isMatchLocked(
  match,
  nowUtc = DateTime.utc(),
  lockBeforeSec = getLockBeforeSec(),
) {
  if (!match) return true;

  // ===============================
  // RĘCZNY OVERRIDE ADMINA
  // ===============================

  // wymuszone otwarcie
  if (match.lock_override !== null && Number(match.lock_override) === 0) {
    return false;
  }

  if (match.lock_override !== null && Number(match.lock_override) === 1) {
    return true;
  }

  // ===============================
  // TRYB AUTO
  // ===============================

  if (match.is_locked) {
    return true;
  }

  return isMatchStarted(match, nowUtc, lockBeforeSec);
}

function formatStartLocal(start_time_utc, zone = DEFAULT_ZONE) {
  const startUtc = startUtcFromDb(start_time_utc);
  if (!startUtc) return null;
  return startUtc.setZone(zone).toFormat("yyyy-LL-dd HH:mm");
}

function parseStartInputToUtc(input, zone = DEFAULT_ZONE) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: true, utc: null, cleared: true };
  if (/^(clear|null|none|usun|usuń)$/i.test(raw))
    return { ok: true, utc: null, cleared: true };

  const attempts = [
    DateTime.fromFormat(raw, "yyyy-LL-dd HH:mm", { zone }),
    DateTime.fromFormat(raw, "yyyy-LL-dd HH:mm:ss", { zone }),
    DateTime.fromFormat(raw, "dd.LL.yyyy HH:mm", { zone }),
    DateTime.fromFormat(raw, "dd-LL-yyyy HH:mm", { zone }),
    DateTime.fromISO(raw, { zone }),
  ];

  const dt = attempts.find((d) => d && d.isValid);
  if (!dt) {
    return {
      ok: false,
      reason:
        "Niepoprawny format. Użyj np. **2025-12-27 21:30** (czas PL) albo wpisz **clear**.",
    };
  }

  const utc = dt.toUTC();
  return { ok: true, utc, cleared: false };
}

module.exports = {
  DEFAULT_ZONE,
  DOMYSLNY_LOCK_BEFORE_SEC,
  getLockBeforeSec,
  startUtcFromDb,
  isMatchStarted,
  isMatchLocked,
  formatStartLocal,
  parseStartInputToUtc,
};
