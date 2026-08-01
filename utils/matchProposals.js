// Dopasowanie meczów dostawcy do meczów w naszej bazie.
//
// To jest miejsce, w którym takie integracje się wykładają: matches.team_a i
// team_b to zwykły varchar, a dostawca ma własne nazewnictwo ("NAVI" kontra
// "Natus Vincere"). Cała logika jest tu czysta i bez dostępu do bazy, żeby
// dało się ją przetestować na wymyślonych danych, bez klucza API.

// Sprowadza nazwę do postaci porównywalnej: bez znaków diakrytycznych,
// interpunkcji i wielkości liter. "Na'Vi" i "NAVI" zejdą się do "navi",
// ale "Natus Vincere" NIE - na to trzeba aliasu (teams.external_name).
// Litery, kt\u00f3rych NFD nie rozk\u0142ada, bo to osobne znaki, a nie litera bazowa
// ze znakiem \u0142\u0105cz\u0105cym. Bez tego "\u0142" wypad\u0142oby ca\u0142kiem i "Wis\u0142a" zesz\u0142oby do
// "wisa" zamiast "wisla".
const NIEROZKLADALNE = { \u0142: 'l', \u0111: 'd', \u00f8: 'o', \u00df: 'ss', \u00e6: 'ae', \u0153: 'oe' };

function normalizeTeamName(nazwa) {
    return String(nazwa || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\u0142\u0111\u00f8\u00df\u00e6\u0153]/g, (c) => NIEROZKLADALNE[c])
        .replace(/[^a-z0-9]/g, '');
}

// Buduje mapę: znormalizowana nazwa u dostawcy -> nazwa drużyny u nas.
// Każda drużyna wnosi swoją nazwę własną oraz opcjonalny alias.
function buildTeamResolver(teams = []) {
    const mapa = new Map();

    for (const team of teams) {
        const lokalna = team.name;

        for (const wariant of [team.name, team.short_name, team.external_name]) {
            const klucz = normalizeTeamName(wariant);
            if (klucz) mapa.set(klucz, lokalna);
        }
    }

    return (nazwaUDostawcy) => mapa.get(normalizeTeamName(nazwaUDostawcy)) || null;
}

// Klucz pary drużyn niezależny od kolejności - mecz "A vs B" u dostawcy może
// być zapisany jako "B vs A" u nas.
function paraKluczy(x, y) {
    return [normalizeTeamName(x), normalizeTeamName(y)].sort().join('|');
}

function matchProviderResults({ localMatches = [], providerMatches = [], teams = [] }) {
    const resolve = buildTeamResolver(teams);

    // Indeks lokalnych meczów po parze drużyn. Gdy ta sama para gra ze sobą
    // więcej niż raz w evencie (np. Swiss i playoffy), trzymamy wszystkie i
    // nie zgadujemy - patrz "niejednoznaczne" niżej.
    const wgPary = new Map();

    for (const m of localMatches) {
        const klucz = paraKluczy(m.team_a, m.team_b);
        if (!wgPary.has(klucz)) wgPary.set(klucz, []);
        wgPary.get(klucz).push(m);
    }

    const dopasowane = [];
    const nierozpoznaneDruzyny = [];
    const brakMeczu = [];
    const niejednoznaczne = [];

    for (const pm of providerMatches) {
        const lokalnaA = resolve(pm.teamA);
        const lokalnaB = resolve(pm.teamB);

        if (!lokalnaA || !lokalnaB) {
            nierozpoznaneDruzyny.push({
                provider: pm,
                nierozpoznane: [
                    !lokalnaA ? pm.teamA : null,
                    !lokalnaB ? pm.teamB : null,
                ].filter(Boolean),
            });
            continue;
        }

        const kandydaci = wgPary.get(paraKluczy(lokalnaA, lokalnaB)) || [];

        if (kandydaci.length === 0) {
            brakMeczu.push({ provider: pm, lokalnaA, lokalnaB });
            continue;
        }

        if (kandydaci.length > 1) {
            // Ta sama para drużyn w kilku meczach eventu - bez dodatkowego
            // sygnału (data, faza) nie da się rozstrzygnąć. Lepiej pominąć
            // niż wpisać wynik do niewłaściwego meczu.
            niejednoznaczne.push({ provider: pm, kandydaci: kandydaci.map((m) => m.id) });
            continue;
        }

        const mecz = kandydaci[0];

        // Orientacja: dostawca mógł zapisać drużyny w odwrotnej kolejności niż
        // my. Odwrócenie wyniku byłoby cichym błędem, więc przypisujemy wynik
        // po nazwie drużyny, a nie po pozycji w tablicy.
        const odwrocone = normalizeTeamName(mecz.team_a) !== normalizeTeamName(lokalnaA);

        dopasowane.push({
            match: mecz,
            provider: pm,
            resA: odwrocone ? pm.scoreB : pm.scoreA,
            resB: odwrocone ? pm.scoreA : pm.scoreB,
            odwrocone,
        });
    }

    return { dopasowane, nierozpoznaneDruzyny, brakMeczu, niejednoznaczne };
}

module.exports = {
    normalizeTeamName,
    buildTeamResolver,
    matchProviderResults,
};
