// Adapter PandaScore dla wyników serii Counter-Strike.
//
// Uwaga o ścieżce: CS2 siedzi u nich nadal pod prefiksem /csgo/ (nazwa
// zaszła historycznie i nie zmienili jej przy przejściu z CS:GO). Wpisanie
// /cs2/ zwraca 404, więc to nie jest literówka.
//
// Autoryzacja idzie parametrem ?token=, nie nagłówkiem Bearer - tak działa
// ich API.

const BASE_URL = 'https://api.pandascore.co';
const PER_PAGE = 100;
const MAX_STRON = 10; // 1000 meczów - z zapasem ponad największy turniej

// Jeden nasz event odpowiada zwykle całej SERII u dostawcy, nie pojedynczemu
// turniejowi: IEM Cologne 2026 to u nich cztery turnieje (Stage 1-3 plus
// Playoffs) w serii "Cologne Major 2026". Filtr po turnieju zwrócił dla niego
// 7 meczów zamiast 106, więc domyślnie chcemy poziom serii.
//
// Pole przyjmuje: "serie:10488", "turniej:20710" albo samą liczbę
// (interpretowaną jako turniej, dla zgodności wstecz).
function parseExternalRef(ref) {
    const s = String(ref).trim();
    const m = /^(serie|seria|series|turniej|tournament)\s*:\s*(\d+)$/i.exec(s);

    if (m) {
        const rodzaj = m[1].toLowerCase();
        const czySeria = rodzaj.startsWith('seri');

        return {
            filtr: czySeria ? 'filter[serie_id]' : 'filter[tournament_id]',
            wartosc: m[2],
        };
    }

    return { filtr: 'filter[tournament_id]', wartosc: s };
}

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

            const { filtr, wartosc } = parseExternalRef(tournamentId);
            const zebrane = [];

            // Stronicowanie jest konieczne, nie ozdobne: IEM Cologne 2026 to
            // 106 meczów, a strona ma maksymalnie 100. Bez tego sześć meczów
            // wypadałoby po cichu.
            for (let strona = 1; strona <= MAX_STRON; strona++) {
                // Zawężamy FILTREM, a nie ścieżką zagnieżdżoną:
                // /csgo/tournaments/{id}/matches zwraca 404 (sprawdzone na
                // żywym API). Działa /tournaments/{id}/matches, ale bez
                // prefiksu gry, co gubi zawężenie do Counter-Strike'a.
                const url = new URL(`${BASE_URL}/csgo/matches`);

                url.searchParams.set(filtr, wartosc);
                url.searchParams.set('filter[status]', 'finished');
                url.searchParams.set('per_page', String(PER_PAGE));
                url.searchParams.set('page', String(strona));
                url.searchParams.set('token', token);

                const res = await fetchImpl(url.toString());

                if (!res.ok) {
                    // Treść błędu bywa jedynym sygnałem, że np. skończył się
                    // limit zapytań albo turniej jest poza darmowym planem.
                    const tresc = await res.text().catch(() => '');
                    throw new Error(
                        `pandascore: HTTP ${res.status} ${tresc.slice(0, 200)}`
                    );
                }

                const dane = await res.json();
                const paczka = Array.isArray(dane) ? dane : [];

                zebrane.push(...paczka);

                if (paczka.length < PER_PAGE) break;
            }

            return zebrane.map(normalizePandascoreMatch).filter(Boolean);
        },
    };
}

module.exports = { createPandascoreProvider, normalizePandascoreMatch, BASE_URL };
