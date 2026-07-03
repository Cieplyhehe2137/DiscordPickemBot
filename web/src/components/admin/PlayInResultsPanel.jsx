import { useEffect, useState } from 'react';
import { getTeams, getPlayinResults, savePlayinResults, describeActionError } from '../../lib/api';

const REQUIRED = 8;

export default function PlayInResultsPanel({ slug, guildId }) {
    const [teams, setTeams] = useState([]);
    const [selected, setSelected] = useState([]);
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
                const data = await getPlayinResults(slug);

                if (!cancelled) setSelected(data.teams || []);
            } catch (err) {
                if (!cancelled) setError(describeActionError(err, 'load Play-In results'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [slug]);

    function toggleTeam(team) {
        setSelected((prev) => {
            const has = prev.includes(team);

            if (!has && prev.length >= REQUIRED) return prev;

            return has ? prev.filter((t) => t !== team) : [...prev, team];
        });
    }

    async function handleSave() {
        setSaving(true);
        setError(null);

        try {
            await savePlayinResults(slug, selected);
        } catch (err) {
            setError(err?.status === 400 ? err.message : describeActionError(err, 'save Play-In results'));
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
                Play-In
            </h2>

            <p className="mt-2 text-sm text-white/40">
                Select exactly {REQUIRED} advancing teams ({selected.length}/{REQUIRED})
            </p>

            {loading ? (
                <p className="mt-6 text-white/40">Loading...</p>
            ) : (
                <div className="mt-4 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
                    {teams.length === 0 && (
                        <p className="px-2 py-1.5 text-sm text-white/30">No active teams</p>
                    )}

                    <div className="grid gap-1 md:grid-cols-2">
                        {teams.map((team) => {
                            const checked = selected.includes(team);
                            return (
                                <label
                                    key={team}
                                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/70 hover:bg-white/5"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleTeam(team)}
                                        className="accent-violet-500"
                                    />
                                    {team}
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                    {error}
                </div>
            )}

            <button
                onClick={handleSave}
                disabled={saving || loading || selected.length !== REQUIRED}
                className="mt-6 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save Play-In Results'}
            </button>
        </div>
    );
}
