// Adapter PandaScore dla wyników serii Counter-Strike.
//
// Uwaga o ścieżce: CS2 siedzi u nich nadal pod prefiksem /csgo/ (nazwa
// zaszła historycznie i nie zmienili jej przy przejściu z CS:GO). Wpisanie
// /cs2/ zwraca 404, więc to nie jest literówka.
//
// Autoryzacja idzie parametrem ?token=, nie nagłówkiem Bearer - tak działa
// ich API.

const BASE_URL = 'https://api.pandascore.co';

// Rozbite na czystą funkcję, bo to jedyne miejsce, gdzie da się pomylić
// kolejność drużyn albo zgubić wynik - a testować to trzeba bez klucza API.
function normalizePandascoreMatch(raw) {
    if (!raw || raw.status !== 'finished') return null;

    const opponents = (raw.opponents || [])
        .map((o) => o?.opponent)
        .filter(Boolean);

    // Mecze z nieobsadzonym slotem (TBD w drabince) nie niosą wyniku.
    if (opponents.length !== 2) return null;

    const [a, b] = opponents;
    const wynikDla = (teamId) => {
        const r = (raw.results || []).find((x) => x?.team_id === teamId);
        return r ? Number(r.score) : null;
    };

    const scoreA = wynikDla(a.id);
    const scoreB = wynikDla(b.id);

    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return null;

    return {
        externalId: String(raw.id),
        teamA: a.name || a.acronym || null,
        teamB: b.name || b.acronym || null,
        scoreA,
        scoreB,
        bestOf: Number(raw.number_of_games) || null,
        finishedAt: raw.end_at || null,
        raw,
    };
}

function createPandascoreProvider({ token, fetchImpl = fetch } = {}) {
    if (!token) throw new Error('pandascore: brak tokenu (PANDASCORE_TOKEN)');

    return {
        name: 'pandascore',

        async fetchFinishedMatches({ tournamentId }) {
            if (!tournamentId) {
                throw new Error('pandascore: brak external_tournament_id dla eventu');
            }

            const url = new URL(
                `${BASE_URL}/csgo/tournaments/${encodeURIComponent(tournamentId)}/matches`
            );

            url.searchParams.set('filter[status]', 'finished');
            url.searchParams.set('per_page', '100');
            url.searchParams.set('sort', '-end_at');
            url.searchParams.set('token', token);

            const res = await fetchImpl(url.toString());

            if (!res.ok) {
                // Treść błędu bywa jedynym sygnałem, że np. skończył się limit
                // zapytań albo turniej jest poza darmowym planem.
                const tresc = await res.text().catch(() => '');
                throw new Error(
                    `pandascore: HTTP ${res.status} ${tresc.slice(0, 200)}`
                );
            }

            const dane = await res.json();

            return (Array.isArray(dane) ? dane : [])
                .map(normalizePandascoreMatch)
                .filter(Boolean);
        },
    };
}

module.exports = { createPandascoreProvider, normalizePandascoreMatch, BASE_URL };
