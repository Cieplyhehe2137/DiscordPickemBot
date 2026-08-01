// utils/matchScoring.js

const SCORING = require('../rules/scoring');

function getWinner(a, b) {
  if (a === b) return null;
  return a > b ? 'A' : 'B';
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Punkty za SERIĘ (BO)
 * - 2 PKT → trafiony zwycięzca serii
 * - 0 PKT → pudło
 *
 * Dokładny wynik serii 2:0 / 2:1 nie daje już osobnych punktów.
 */
function computeSeriesPoints({ predA, predB, resA, resB }) {
  const pa = toFiniteNumber(predA);
  const pb = toFiniteNumber(predB);
  const ra = toFiniteNumber(resA);
  const rb = toFiniteNumber(resB);

  if ([pa, pb, ra, rb].some(v => v === null)) {
    return 0;
  }

  const predictedWinner = getWinner(pa, pb);
  const realWinner = getWinner(ra, rb);

  return predictedWinner && realWinner && predictedWinner === realWinner
    ? SCORING.MATCH.WINNER
    : 0;
}

/**
 * Punkty za dokładny wynik MAPY — wariant B
 * Warunek wstępny: trzeba trafić ZWYCIĘZCĘ mapy. Bez tego sama bliskość
 * wyniku dawała punkty za mapę wytypowaną na złą drużynę - typ 13:12 przy
 * wyniku 12:13 to suma odchyleń 2, czyli 1 pkt mimo pomyłki co do zwycięzcy.
 *
 * Potem liczy się łączna różnica rund:
 *
 * totalDiff = |predA - exactA| + |predB - exactB|
 *
 * - 3 PKT → totalDiff 0
 * - 2 PKT → totalDiff 1
 * - 1 PKT → totalDiff 2
 * - 0 PKT → totalDiff 3+
 */
function computeMapPoints({ predExactA, predExactB, exactA, exactB }) {
  const pa = toFiniteNumber(predExactA);
  const pb = toFiniteNumber(predExactB);
  const ea = toFiniteNumber(exactA);
  const eb = toFiniteNumber(exactB);

  if ([pa, pb, ea, eb].some(v => v === null)) {
    return SCORING.MAP.MISS;
  }

  // getWinner zwraca null przy remisie, więc porównanie obejmuje też przypadek
  // "obie strony to remis" (wtedy zgodne) oraz "typ remis, wynik rozstrzygnięty"
  // (wtedy niezgodne).
  if (getWinner(pa, pb) !== getWinner(ea, eb)) {
    return SCORING.MAP.MISS;
  }

  const totalDiff = Math.abs(pa - ea) + Math.abs(pb - eb);

  if (totalDiff === 0) return SCORING.MAP.EXACT;
  if (totalDiff === 1) return SCORING.MAP.DIFF_1;
  if (totalDiff === 2) return SCORING.MAP.DIFF_2;

  return SCORING.MAP.MISS;
}

/**
 * Łączne punkty:
 * Seria + Mapy
 */
function computeTotalPoints(data) {
  const series = computeSeriesPoints(data);
  const maps = computeMapPoints(data);

  return series + maps;
}

/**
 * Walidacja wyników serii BO
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
    reason: `Nieobsługiwany best_of=${bo}`,
  };
}

module.exports = {
  computeSeriesPoints,
  computeMapPoints,
  computeTotalPoints,
  validateScore,
};