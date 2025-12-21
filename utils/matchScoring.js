// utils/matchScoring.js

function getWinner(a, b) {
    if (a === b) return null;
    return a > b ? 'A' : 'B'
}

/**
 * 3 PKT - dokładny wynik
 * 1 PKT - trafiony zwycięzca
 * 0 PKT - pudło
 */

function computePoints({ predA, predB, resA, resB }) {
    if (predA === resA && predB === resB) return 3;
    const pw = getWinner(predA, predB);
    const rw = getWinner(resA, resB);
    return pw && rw && pw === rw ? 1 : 0;
}

/**
 * - BO1: 1:0 / 0:1
 * - BO3: 2:x lub x:2, gdzie x={0 lub 1}
 * - BO5: 3:x lub x:3, gdzie x={0, 1 lub 2}
 */

function validateScore({ a, b, bestOf }) {
    const na = Number(a);
    const nb = Number(b);
    const bo = Number(bestOf);

    if (!Number.isFinite(na) || !Number.isFinite(nb)) return { ok: false, reason: 'Wynik musi być liczbą.' };
    if (na < 0 || nb < 0) return { ok: false, reason: 'Wynik nie może być ujemny' };
    if (na === nb) return { ok: false, reason: 'Remisy nie są dozwolone.' };

    if (bo === 1) {
        const ok = (na === 1 && nb === 0) || (na === 0 && nb === 1);
        return ok ? { ok: true } : { ok: false, reason: 'BO1 dopuszcza tylko 1:0 lub 0:1.' };
    }

    if (bo === 3) {
        const ok = (na === 2 && (nb === 0 || nb === 1)) || (nb === 2 && (na === 0 || na === 1));
        return ok ? { ok: true } : { ok: false, reason: 'BO3 dopuszcza tylko 2:0 / 2:1 / 0:2 / 1:2' };
    }

    if (bo === 5 ) {
        const ok = (na === 3 && (nb === 0 || nb === 1 || nb === 2)) || (nb === 3 && (na === 0 || na === 1 || na === 2));
        return ok ? { ok: true } : { ok: false, reason: 'BO5 dopuszcza tylko 3:0 / 3:1 / 3:2 / 0:3 / 1:3 / 2:3.' };
    }

return { ok: false, reason: `Nieobsługiwany format best_of=${bo}.` };
}

module.exports = {
    computePoints,
    validateScore
}