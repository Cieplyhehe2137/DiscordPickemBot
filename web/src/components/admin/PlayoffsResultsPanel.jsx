import { useEffect, useState } from 'react';
import { getTeams, getPlayoffsResults, savePlayoffsResults, describeActionError } from '../../lib/api';

const CATEGORIES = [
    { key: 'semifinalists', label: 'Semifinalists', cap: 4 },
    { key: 'finalists', label: 'Finalists', cap: 2 },
    { key: 'winner', label: 'Winner', cap: 1 },
    { key: 'third', label: '3rd Place', cap: 1 }
];

export default function PlayoffsResultsPanel({ slug, guildId }) {
    const [teams, setTeams] = useState([]);
    const [selection, setSelection] = useState({ semifinalists: [], finalists: [], winner: [], third: [] });
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
                const data = await getPlayoffsResults(slug);

                if (!cancelled) {
                    setSelection({
                        semifinalists: data.semifinalists || [],
                        finalists: data.finalists || [],
                        winner: data.winner ? [data.winner] : [],
                        third: data.third ? [data.third] : []
                    });
                }
            } catch (err) {
                if (!cancelled) setError(describeActionError(err, 'load Playoffs results'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [slug]);

    function toggleTeam(categoryKey, team) {
        setSelection((prev) => {
            const current = prev[categoryKey];
            const has = current.includes(team);
            const cap = CATEGORIES.find((c) => c.key === categoryKey).cap;

            if (has) {
                return { ...prev, [categoryKey]: current.filter((t) => t !== team) };
            }

            if (cap === 1) {
                return { ...prev, [categoryKey]: [team] };
            }

            if (current.length >= cap) return prev;

            return { ...prev, [categoryKey]: [...current, team] };
        });
    }

    async function handleSave() {
        setSaving(true);
        setError(null);

        try {
            await savePlayoffsResults(slug, {
                semifinalists: selection.semifinalists,
                finalists: selection.finalists,
                winner: selection.winner[0] || null,
                third: selection.third[0] || null
            });
        } catch (err) {
            setError(err?.status === 400 ? err.message : describeActionError(err, 'save Playoffs results'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Official Phase Results
            </p>

            <h2 className="mt-2 text-3xl font-black">
                Playoffs
            </h2>

            {loading ? (
                <p className="mt-6 text-white/40">Loading...</p>
            ) : (
                <div className="mt-6 grid gap-6 lg:grid-cols-4">
                    {CATEGORIES.map((cat) => (
                        <div key={cat.key}>
                            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                                {cat.label} ({selection[cat.key].length}/{cat.cap})
                            </p>

                            <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                                {teams.length === 0 && (
                                    <p className="px-2 py-1.5 text-sm text-white/30">No active teams</p>
                                )}

                                {teams.map((team) => {
                                    const checked = selection[cat.key].includes(team);
                                    return (
                                        <label
                                            key={team}
                                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleTeam(cat.key, team)}
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
                {saving ? 'Saving...' : 'Save Playoffs Results'}
            </button>
        </div>
    );
}
