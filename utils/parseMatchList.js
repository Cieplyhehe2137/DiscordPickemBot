// Parsowanie listy meczów wklejonej przez admina.
//
// Tworzenie 106 meczów Majora pojedynczo przez modal to najdroższa czynność
// przy stawianiu turnieju, stąd wklejanie listy. Parser jest czysty i bez
// dostępu do bazy, żeby dało się go przetestować na wymyślonych danych.
//
// Obsługiwane zapisy jednej linii:
//   NAVI vs G2
//   FaZe - MOUZ
//   Spirit | Vitality
//   Astralis; Liquid
//   NAVI vs G2 BO3          (best_of dla tej konkretnej linii)
// Puste linie i te zaczynające się od # są pomijane.

// Separatory par. "vs" i "v" tylko jako osobne słowo, żeby nie rozjechać
// nazw je zawierających - inaczej "Virtus.pro" albo "Vitality" pękłyby w
// środku.
const SEPARATORY = [
    /\s+vs\.?\s+/i,
    /\s+v\s+/i,
    /\s*\|\s*/,
    /\s*;\s*/,
    /\s+-\s+/,      // ze spacjami po obu stronach: "FaZe - MOUZ",
    //                 ale NIE "THUNDER dOWNUNDER" ani "G2-Esports"
];

// "BO3" / "bo 3" / "(BO5)" na końcu linii
const WZORZEC_BO = /[\s(]*\bbo\s*([135])\)?\s*$/i;

function parseMatchList(tekst, { domyslneBo = 3 } = {}) {
    const linie = String(tekst || '').split(/\r?\n/);

    const mecze = [];
    const bledy = [];

    linie.forEach((surowa, index) => {
        const numer = index + 1;
        let linia = surowa.trim();

        if (!linia || linia.startsWith('#')) return;

        // best_of z końca linii, jeśli podany
        let bestOf = domyslneBo;
        const dopasowanieBo = WZORZEC_BO.exec(linia);

        if (dopasowanieBo) {
            bestOf = Number(dopasowanieBo[1]);
            linia = linia.slice(0, dopasowanieBo.index).trim();
        }

        const separator = SEPARATORY.find((re) => re.test(linia));

        if (!separator) {
            bledy.push({
                linia: numer,
                tresc: surowa.trim(),
                powod: 'Nie rozpoznano dwóch drużyn — użyj "A vs B", "A - B", "A | B" albo "A; B".',
            });
            return;
        }

        const czesci = linia.split(separator).map((s) => s.trim()).filter(Boolean);

        if (czesci.length !== 2) {
            bledy.push({
                linia: numer,
                tresc: surowa.trim(),
                powod: czesci.length < 2
                    ? 'Brakuje drugiej drużyny.'
                    : `Rozpoznano ${czesci.length} nazw zamiast dwóch — separator występuje w linii więcej niż raz.`,
            });
            return;
        }

        const [teamA, teamB] = czesci;

        if (teamA.toLowerCase() === teamB.toLowerCase()) {
            bledy.push({
                linia: numer,
                tresc: surowa.trim(),
                powod: 'Obie drużyny są takie same.',
            });
            return;
        }

        mecze.push({ linia: numer, teamA, teamB, bestOf });
    });

    // Duplikaty w obrębie wklejonej listy. Nie odrzucamy ich - ta sama para
    // potrafi zagrać ze sobą dwa razy (Swiss i playoffy) - ale admin powinien
    // zobaczyć, że wkleił to dwa razy, zanim zatwierdzi.
    const widziane = new Map();
    const duplikaty = [];

    for (const m of mecze) {
        const klucz = [m.teamA.toLowerCase(), m.teamB.toLowerCase()].sort().join('|');

        if (widziane.has(klucz)) {
            duplikaty.push({ linia: m.linia, tresc: `${m.teamA} vs ${m.teamB}`, pierwsza: widziane.get(klucz) });
        } else {
            widziane.set(klucz, m.linia);
        }
    }

    return { mecze, bledy, duplikaty };
}

module.exports = { parseMatchList };
