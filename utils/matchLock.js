// utils/matchLock.js


const { DateTime } = require('luxon');

const DEFAULT_ZONE = 'Europe/Warsaw';

function getLockBeforeSec() {
    const raw = process.env.MATCH_LOCK_BEFORE_SEC;
    const n = raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
}

function startUtcFromDb(start_time_utc) {
    if (!start_time_utc) return null;
   
    try {
        if (start_time_utc instanceof Date) {
            return DateTime.fromJSDate(start_time_utc).toUTC();
        }
        
        const dt = DateTime.fromISO(String(start_time_utc), { zone: 'utc' });
        return dt.isValid ? dt.toUTC() : null;
    } catch {
        return null;
    }
}

function isMatchStarted({ start_time_utc }, nowUtc = DateTime.utc(), lockBeforeSec = getLockBeforeSec()) {
    const startUtc = startUtcFromDb(start_time_utc);
    if (!startUtc) return false;
    const threshold = nowUtc.plus({ seconds: lockBeforeSec });
    return threshold >= startUtc;
}

function isMatchLocked(match, nowUtc = DateTime.utc(), lockBeforeSec = getLockBeforeSec()) {
    if (!match) return true;
    if (match.is_locked) return true;
    return isMatchStarted(match, nowUtc, lockBeforeSec);
}

function formatStartLocal(start_time_utc, zone = DEFAULT_ZONE) {
    const startUtc = startUtcFromDb(start_time_utc);
    if (!startUtc) return null;
    return startUtc.setZone(zone).toFormat('yyyy-LL-dd HH:mm');
}

function parseStartInputToUtc(input, zone = DEFAULT_ZONE) {
    const raw = String(input ?? '').trim();
    if (!raw) return { ok: true, utc: null, cleared: true };
    if (/^(clear|null|none|usun|usuń)$/i.test(raw)) return { ok: true, utc: null, cleared: true };

    const attempts = [
        DateTime.fromFormat(raw, 'yyyy-LL-dd HH:mm', { zone }),
        DateTime.fromFormat(raw, 'yyyy-LL-dd HH:mm:ss', { zone }),
        DateTime.fromFormat(raw, 'dd.LL.yyyy HH:mm', { zone }),
        DateTime.fromFormat(raw, 'dd-LL-yyyy HH:mm', { zone }),
        DateTime.fromISO(raw, { zone }),
    ];

    const dt = attempts.find((d) => d && d.isValid);
    if (!dt) {
        return {
            ok: false,
            reason: 'Niepoprawny format. Użyj np. **2025-12-27 21:30** (czas PL) albo wpisz **clear**.',
        };
    }

    const utc = dt.toUTC();
    return { ok: true, utc, cleared: false };
}

module.exports = {
    DEFAULT_ZONE,
    getLockBeforeSec,
    startUtcFromDb,
    isMatchStarted,
    isMatchLocked,
    formatStartLocal,
    parseStartInputToUtc,
};
