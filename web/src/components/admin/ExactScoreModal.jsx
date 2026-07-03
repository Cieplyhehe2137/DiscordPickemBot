import { useEffect, useState } from 'react';
import { getMatchExactScores, saveMatchExactScores, describeActionError } from '../../lib/api';

function mapLabel(mapNo, bestOf) {
    if (Number(bestOf) === 1) return 'BO1';
    if (mapNo === 1) return 'Wybór drużyny A';
    if (mapNo === 2) return 'Wybór drużyny B';
    if (mapNo === 3) return 'Decydująca';
    return `Mapa #${mapNo}`;
}

export default function ExactScoreModal({ match, onClose, onSaved }) {
    const [maps, setMaps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const data = await getMatchExactScores(match.id);

                if (!cancelled) {
                    setMaps(
                        data.maps.map((m) => ({
                            mapNo: m.mapNo,
                            exactA: m.exactA ?? '',
                            exactB: m.exactB ?? ''
                        }))
                    );
                }
            } catch (err) {
                if (!cancelled) setError(describeActionError(err, 'wczytać dokładne wyniki'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [match.id]);

    function updateMap(mapNo, field, value) {
        setMaps((prev) => prev.map((m) => (m.mapNo === mapNo ? { ...m, [field]: value } : m)));
    }

    async function handleSave() {
        const filled = maps.filter((m) => m.exactA !== '' && m.exactB !== '');

        if (!filled.length) {
            setError('Wpisz wynik przynajmniej jednej mapy');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            await saveMatchExactScores(match.id, filled.map((m) => ({
                mapNo: m.mapNo,
                exactA: Number(m.exactA),
                exactB: Number(m.exactB)
            })));

            onSaved();
        } catch (err) {
            setError(err?.status === 400 ? err.message : describeActionError(err, 'zapisać dokładne wyniki'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Dokładne wyniki map
                </p>

                <h2 className="mt-2 text-3xl font-black">
                    {match.team_a} vs {match.team_b}
                </h2>

                {loading ? (
                    <p className="mt-6 text-white/40">Ładowanie...</p>
                ) : (
                    <div className="mt-8 grid gap-5">
                        {maps.map((m) => (
                            <div key={m.mapNo}>
                                <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                                    {mapLabel(m.mapNo, match.best_of)}
                                </p>

                                <div className="mt-2 grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-bold text-white/60">{match.team_a}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            value={m.exactA}
                                            onChange={(e) => updateMap(m.mapNo, 'exactA', e.target.value)}
                                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-bold text-white/60">{match.team_b}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            value={m.exactB}
                                            onChange={(e) => updateMap(m.mapNo, 'exactB', e.target.value)}
                                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p className="mt-4 text-sm text-white/40">
                    Wynik rundy dla każdej mapy (0-99). Zapis przelicza punkty dla wszystkich typów tego meczu.
                </p>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        {error}
                    </div>
                )}

                <div className="mt-8 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Anuluj
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie...' : 'Zapisz dokładne wyniki'}
                    </button>
                </div>
            </div>
        </div>
    );
}
