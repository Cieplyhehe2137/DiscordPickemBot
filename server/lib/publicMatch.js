// Przygotowanie danych meczu dla publicznych widokow: odliczanie do startu,
// data, status i pelny ksztalt obiektu wysylanego na front.
//
// Czysta logika - zadnej bazy, zadnego Expressa. Wyciagniete z app.js, zeby
// dalo sie ja sprawdzic testem: to jest kod, ktory decyduje, czy mecz pokazuje
// sie jako LIVE, LOCKED czy OPEN, a takie pomylki widzi kazdy odwiedzajacy.
//
// Funkcje czytaja Date.now() bezposrednio. Nie wstrzykuje tu zegara, bo to
// zmienialoby ich sygnatury, a testy radza sobie, podajac czasy wyraznie w
// przeszlosci albo przyszlosci.

export function getPublicCountdown(startTimeUtc) {
  if (!startTimeUtc) return "TBA";

  const target = new Date(startTimeUtc).getTime();
  const diff = target - Date.now();

  if (diff <= 0) return "LIVE";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours <= 0) return `${minutes}m`;

  return `${hours}h ${minutes}m`;
}

export function formatPublicDate(startTimeUtc) {
  if (!startTimeUtc) return "Start time TBA";

  return new Date(startTimeUtc).toISOString();
}

export function getPublicMatchStatus(match) {
  if (Number(match.is_locked) === 1) {
    return "LOCKED";
  }

  const startTime = match.start_time_utc
    ? new Date(match.start_time_utc).getTime()
    : null;

  if (startTime && startTime <= Date.now()) {
    return "LIVE";
  }

  return "OPEN";
}

export function buildPublicMatch(match) {
  let uiStatus = getPublicMatchStatus(match);

  if (match.live_status === "FINAL") {
    uiStatus = "FINAL";
  } else if (Number(match.score_a || 0) > 0 || Number(match.score_b || 0) > 0) {
    uiStatus = "LIVE";
  }

  return {
    id: match.id,
    phase: match.phase,
    match_no: match.match_no,
    team_a: match.team_a,
    team_b: match.team_b,
    best_of: match.best_of,

    score_a: Number(match.score_a || 0),
    score_b: Number(match.score_b || 0),

    current_map: match.current_map || 1,
    live_status: match.live_status || null,

    start_time_utc: match.start_time_utc,
    formatted_time: formatPublicDate(match.start_time_utc),
    countdown: getPublicCountdown(match.start_time_utc),

    is_locked: Number(match.is_locked) === 1,
    ui_status: uiStatus,
  };
}
