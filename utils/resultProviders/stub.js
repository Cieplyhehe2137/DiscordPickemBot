// Dostawca-atrapa czytający wyniki z pliku JSON zamiast z sieci.
//
// Po co w kodzie produkcyjnym: pozwala przejść cały przepływ (synchronizacja
// -> kolejka propozycji -> zatwierdzenie) i zobaczyć, jak zachowa się
// dopasowywanie nazw drużyn, ZANIM wykupisz dostęp do prawdziwego API.
// Aktywuje się wyłącznie przy jawnym RESULT_PROVIDER=stub, więc nie ma szans
// włączyć się przypadkiem.
//
// Format pliku: tablica obiektów
// [{ "teamA": "...", "teamB": "...", "scoreA": 2, "scoreB": 1, "bestOf": 3 }]

const fs = require('fs');

function createStubProvider({ fixturePath } = {}) {
    if (!fixturePath) {
        throw new Error('stub: brak RESULT_PROVIDER_FIXTURE (ścieżka do pliku JSON z wynikami)');
    }

    return {
        name: 'stub',

        async fetchFinishedMatches() {
            if (!fs.existsSync(fixturePath)) {
                throw new Error(`stub: plik nie istnieje: ${fixturePath}`);
            }

            const dane = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

            if (!Array.isArray(dane)) {
                throw new Error('stub: plik musi zawierać tablicę meczów');
            }

            return dane.map((m, i) => ({
                externalId: String(m.externalId ?? `stub-${i + 1}`),
                teamA: m.teamA,
                teamB: m.teamB,
                scoreA: Number(m.scoreA),
                scoreB: Number(m.scoreB),
                bestOf: m.bestOf ? Number(m.bestOf) : null,
                finishedAt: m.finishedAt || null,
                raw: m,
            }));
        },
    };
}

module.exports = { createStubProvider };
