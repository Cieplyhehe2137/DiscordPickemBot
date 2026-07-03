import { useEffect, useState } from 'react';
import { getTeams, getDoubleElimResults, saveDoubleElimResults, describeActionError } from '../../lib/api';

const SLOTS = [
    { key: 'upperFinalA', label: 'Upper Final A' },
    { key: 'lowerFinalA', label: 'Lower Final A' },
    { key: 'upperFinalB', label: 'Upper Final B' },
    { key: 'lowerFinalB', label: 'Lower Final B' }
];

const CAP = 2;

export default function DoubleElimResultsPanel({ slug, guildId }) {
    const [teams, setTeams] = useState([]);
    const [selection, setSelection] = useState({ upperFinalA: [], lowerFinalA: [], upperFinalB: [], lowerFinalB: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        getTeams(guildId, { includeInactive: false })
            .then((result) => {
                if (!cancelled) setTeams((result.teams || []).map((t) => t.name));
            })
            .catch(() => {
                if (!cancelled) setTeams([]);
            });

        return () => { cancelled = true; };
    }, [guildId]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const data = await getDoubleElimResults(slug);

                if (!cancelled) {
                    setSelection({
                        upperFinalA: data.upperFinalA || [],
                        lowerFinalA: data.lowerFinalA || [],
                        upperFinalB: data.upperFinalB || [],
                        lowerFinalB: data.lowerFinalB || []
                    });
                }
            } catch (err) {
                if (!cancelled) setError(describeActionError(err, 'wczytać wyniki Double Elimination'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [slug]);

    function toggleTeam(slotKey, team) {
        setSelection((prev) => {
            const current = prev[slotKey];
            const has = current.includes(team);

            if (!has && current.length >= CAP) return prev;

            return {
                ...prev,
                [slotKey]: has ? current.filter((t) => t !== team) : [...current, team]
            };
        });
    }

    async function handleSave() {
        setSaving(true);
        setError(null);

        try {
            await saveDoubleElimResults(slug, selection);
        } catch (err) {
            setError(err?.status === 400 ? err.message : describeActionError(err, 'zapisać wyniki Double Elimination'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Oficjalne wyniki fazy
            </p>

            <h2 className="mt-2 text-3xl font-black">
                Double Elimination
            </h2>

            {loading ? (
                <p className="mt-6 text-white/40">Ładowanie...</p>
            ) : (
                <div className="mt-6 grid gap-6 lg:grid-cols-4">
                    {SLOTS.map((slot) => (
                        <div key={slot.key}>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                                {slot.label} ({selection[slot.key].length}/{CAP})
                            </p>

                            <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                                {teams.length === 0 && (
                                    <p className="px-2 py-1.5 text-sm text-white/30">Brak aktywnych drużyn</p>
                                )}

                                {teams.map((team) => {
                                    const checked = selection[slot.key].includes(team);
                                    return (
                                        <label
                                            key={team}
                                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleTeam(slot.key, team)}
                                                className="accent-violet-500"
                                            />
                                            {team}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={saving || loading}
                className="mt-6 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
            >
                {saving ? 'Zapisywanie...' : 'Zapisz wyniki Double Elimination'}
            </button>
        </div>
    );
}
