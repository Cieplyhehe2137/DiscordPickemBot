import { useEffect, useState } from 'react';
import { updateMatch, getMatchDeletePreview, deleteMatch, getTeams, describeActionError } from '../../lib/api';

// Edycja i usuwanie pojedynczego meczu. Dotąd jedyną drogą do poprawienia
// literówki było "Wyczyść fazę", które kasuje wszystkie mecze fazy razem z
// typami graczy - nieproporcjonalne do pomyłki.
export default function MatchEditModal({ guildId, match, onClose, onSaved, onDeleted }) {
    const [teamA, setTeamA] = useState(match.team_a || '');
    const [teamB, setTeamB] = useState(match.team_b || '');
    const [bestOf, setBestOf] = useState(match.best_of || 3);
    const [teams, setTeams] = useState([]);

    const [podgladUsuniecia, setPodgladUsuniecia] = useState(null);
    const [potwierdzenie, setPotwierdzenie] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const data = await getTeams(guildId);
                if (!cancelled) setTeams(data.teams || []);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError(describeActionError(err, 'wczytać drużyn'));
            }
        }

        load();

        return () => { cancelled = true; };
    }, [guildId]);

    const zmienione =
        teamA !== match.team_a || teamB !== match.team_b || Number(bestOf) !== Number(match.best_of);

    async function zapisz() {
        try {
            setBusy(true);
            setError(null);

            const wynik = await updateMatch(match.id, {
                teamA, teamB, bestOf: Number(bestOf)
            });

            onSaved?.(wynik);
            onClose();
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'zapisać zmian'));
        } finally {
            setBusy(false);
        }
    }

    async function pokazPodgladUsuniecia() {
        try {
            setBusy(true);
            setError(null);
            setPodgladUsuniecia(await getMatchDeletePreview(match.id));
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'sprawdzić, co zniknie z meczem'));
        } finally {
            setBusy(false);
        }
    }

    async function usun() {
        try {
            setBusy(true);
            setError(null);

            await deleteMatch(match.id);

            onDeleted?.();
            onClose();
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'usunąć meczu'));
        } finally {
            setBusy(false);
        }
    }

    const u = podgladUsuniecia?.usunie;
    const cokolwiekZniknie = u && (u.typy || u.typyMap || u.wyniki || u.wynikiMap || u.punkty);
    const oczekiwanePotwierdzenie = `${match.team_a} vs ${match.team_b}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-8">
                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    Mecz #{match.match_no} · {match.phase}
                </p>

                <h2 className="mt-2 text-3xl font-black">Edytuj mecz</h2>

                <div className="mt-6 grid gap-4">
                    <label>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">Drużyna A</span>

                        <select
                            value={teamA}
                            onChange={(e) => setTeamA(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                            {!teams.some((t) => t.name === teamA) && (
                                <option value={teamA}>{teamA} (spoza listy drużyn)</option>
                            )}
                            {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </label>

                    <label>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">Drużyna B</span>

                        <select
                            value={teamB}
                            onChange={(e) => setTeamB(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                            {!teams.some((t) => t.name === teamB) && (
                                <option value={teamB}>{teamB} (spoza listy drużyn)</option>
                            )}
                            {teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    </label>

                    <label>
                        <span className="text-xs uppercase tracking-[0.2em] text-white/40">Format</span>

                        <select
                            value={bestOf}
                            onChange={(e) => setBestOf(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                            {[1, 3, 5].map((b) => <option key={b} value={b}>BO{b}</option>)}
                        </select>
                    </label>
                </div>

                {zmienione && (
                    <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200">
                        Zmiana drużyn albo formatu unieważnia dotychczasowe punkty tego meczu —
                        zostaną przeliczone od razu po zapisie. Typy graczy zostają nietknięte.
                    </p>
                )}

                {error && (
                    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Anuluj
                    </button>

                    <button
                        onClick={zapisz}
                        disabled={busy || !zmienione}
                        className="rounded-xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400 disabled:opacity-40"
                    >
                        {busy ? 'Zapisuję...' : 'Zapisz zmiany'}
                    </button>
                </div>

                <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
                    <h3 className="text-lg font-black text-red-300">Usuń ten mecz</h3>

                    <p className="mt-1 text-sm text-white/50">
                        Usuwa wyłącznie ten jeden mecz — reszta fazy zostaje nietknięta.
                    </p>

                    {!podgladUsuniecia && (
                        <button
                            onClick={pokazPodgladUsuniecia}
                            disabled={busy}
                            className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-3 font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                        >
                            Sprawdź, co zniknie
                        </button>
                    )}

                    {podgladUsuniecia && (
                        <>
                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
                                {[
                                    ['Typy', u.typy], ['Typy map', u.typyMap],
                                    ['Wyniki', u.wyniki], ['Wyniki map', u.wynikiMap],
                                    ['Punkty', u.punkty]
                                ].map(([etykieta, ile]) => (
                                    <div key={etykieta} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
                                        <p className="text-xs uppercase tracking-[0.15em] text-white/40">{etykieta}</p>
                                        <p className="mt-1 text-xl font-black">{ile}</p>
                                    </div>
                                ))}
                            </div>

                            {cokolwiekZniknie ? (
                                <>
                                    <p className="mt-4 text-sm font-bold text-red-200">
                                        Ten mecz ma już dane graczy. Aby potwierdzić, wpisz:{' '}
                                        <code className="text-white">{oczekiwanePotwierdzenie}</code>
                                    </p>

                                    <input
                                        value={potwierdzenie}
                                        onChange={(e) => setPotwierdzenie(e.target.value)}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm"
                                    />
                                </>
                            ) : (
                                <p className="mt-4 text-sm text-white/50">
                                    Brak typów i wyników — usunięcie nikomu nic nie zabierze.
                                </p>
                            )}

                            <button
                                onClick={usun}
                                disabled={busy || (cokolwiekZniknie && potwierdzenie.trim() !== oczekiwanePotwierdzenie)}
                                className="mt-4 rounded-xl bg-red-500 px-5 py-3 font-black text-black transition hover:bg-red-400 disabled:opacity-40"
                            >
                                {busy ? 'Usuwam...' : 'Usuń mecz'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
