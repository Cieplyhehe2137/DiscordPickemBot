// utils/matchScoring.js

function getWinner(a, b) {
  if (a === b) return null;
  return a > b ? 'A' : 'B';
}

/**
 * Punkty za SERIĘ (BO)
 * BO3:
 * - 3 PKT → dokładny wynik (2:0 / 2:1)
 * - 1 PKT → trafiony zwycięzca
 * - 0 PKT → pudło
 */
function computeSeriesPoints({ predA, predB, resA, resB }) {
  if (
    predA === null || predB === null ||
    resA === null || resB === null
  ) return 0;

  const pa = Number(predA);
  const pb = Number(predB);
  const ra = Number(resA);
  const rb = Number(resB);

  if (
    !Number.isFinite(pa) ||
    !Number.isFinite(pb) ||
    !Number.isFinite(ra) ||
    !Number.isFinite(rb)
  ) return 0;

  // dokładny wynik
  if (pa === ra && pb === rb) return 3;

  // trafiony winner
  const pw = getWinner(pa, pb);
  const rw = getWinner(ra, rb);

  return pw && rw && pw === rw ? 1 : 0;
}

/**
 * Punkty za MAPĘ (exact)
 * - 3 PKT → trafiony dokładny wynik
 * - 0 PKT → inaczej
 */
function computeMapPoints({ predExactA, predExactB, exactA, exactB }) {

  if (
    predExactA == null ||
    predExactB == null ||
    exactA == null ||
    exactB == null
  ) {
    return 0;
  }

  const pa = Number(predExactA);
  const pb = Number(predExactB);
  const ea = Number(exactA);
  const eb = Number(exactB);

  if (
    !Number.isFinite(pa) ||
    !Number.isFinite(pb) ||
    !Number.isFinite(ea) ||
    !Number.isFinite(eb)
  ) {
    return 0;
  }

  return (pa === ea && pb === eb) ? 3 : 0;
}


/**
 * Łączne punkty (compat / legacy)
 * Seria + Mapy
 */
function computeTotalPoints(data) {
  const series = computeSeriesPoints(data);
  const maps = computeMapPoints(data);

  return series + maps;
}

/**
 * Walidacja wyników
 */
function validateScore({ a, b, bestOf }) {
  const na = Number(a);
  const nb = Number(b);
  const bo = Number(bestOf);

  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    return { ok: false, reason: 'Wynik musi być liczbą.' };
  }

  if (na < 0 || nb < 0) {
    return { ok: false, reason: 'Wynik nie może być ujemny.' };
  }

  if (na === nb) {
    return { ok: false, reason: 'Remisy nie są dozwolone.' };
  }

  if (bo === 1) {
    const ok = (na === 1 && nb === 0) || (na === 0 && nb === 1);
    return ok
      ? { ok: true }
      : { ok: false, reason: 'BO1: tylko 1:0 lub 0:1.' };
  }

  if (bo === 3) {
    const ok =
      (na === 2 && (nb === 0 || nb === 1)) ||
      (nb === 2 && (na === 0 || na === 1));

    return ok
      ? { ok: true }
      : { ok: false, reason: 'BO3: 2:0 / 2:1 / 0:2 / 1:2.' };
  }

  if (bo === 5) {
    const ok =
      (na === 3 && (nb === 0 || nb === 1 || nb === 2)) ||
      (nb === 3 && (na === 0 || na === 1 || na === 2));

    return ok
      ? { ok: true }
      : { ok: false, reason: 'BO5: 3:0 / 3:1 / 3:2 itd.' };
  }

  return {
    ok: false,
    reason: `Nieobsługiwany best_of=${bo}`
  };
}

module.exports = {
  computeSeriesPoints,
  computeMapPoints,
  computeTotalPoints, // zostawiamy dla starych miejsc
  validateScore
};
