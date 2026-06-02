import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDoubleElimPickem, saveDoubleElimPickem } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

const SECTIONS = [
    ['upper_final_a', 'Upper Final A'],
    ['lower_final_a', 'Lower Final A'],
    ['upper_final_b', 'Upper Final B'],
    ['lower_final_b', 'Lower Final B']
];

export default function PublicDoubleElimPickemPage() {
    const { slug } = useParams();
    const { isLoggedIn, user, loading } = usePublicAuth();

    const [data, setData] = useState(null);
    const [picks, setPicks] = useState({
        upper_final_a: [],
        lower_final_a: [],
        upper_final_b: [],
        lower_final_b: []
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function loadPickem() {
            try {
                const result = await getDoubleElimPickem(slug);
                setData(result);

                if (result.prediction) {
                    setPicks({
                        upper_final_a: result.prediction.upper_final_a || [],
                        lower_final_a: result.prediction.lower_final_a || [],
                        upper_final_b: result.prediction.upper_final_b || [],
                        lower_final_b: result.prediction.lower_final_b || []
                    });
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load Double Elim Pick'Em.");
            }
        }

        loadPickem();
    }, [slug]);

    if (!data) {
        return (
            <PageShell>
                <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-10 h-96 animate-pulse rounded-[2rem] bg-white/10" />
            </PageShell>
        );
    }

    const teams = data.teams || [];

    const canSave =
        !loading &&
        isLoggedIn &&
        SECTIONS.every(([key]) => picks[key].length === 2);

    function togglePick(sectionKey, teamName) {
        setError(null);
        setSuccess(false);

        const current = picks[sectionKey] || [];

        if (current.includes(teamName)) {
            setPicks({
                ...picks,
                [sectionKey]: current.filter((team) => team !== teamName)
            });
            return;
        }

        if (current.length >= 2) {
            setError('You can only select 2 teams in this bracket.');
            return;
        }

        setPicks({
            ...picks,
            [sectionKey]: [...current, teamName]
        });
    }

    async function handleSave() {
        if (!canSave) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            await saveDoubleElimPickem(slug, picks);

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError(err?.message || "Failed to save Double Elim Pick'Em.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Double Elimination Pick&apos;Em
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                {data.event?.name}
            </h1>

            <p className="mt-4 max-w-3xl text-white/50">
                Pick exactly 2 teams for each Double Elimination bracket.
            </p>

            {isLoggedIn && user && (
                <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Signed in as
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                        {user.global_name || user.username}
                    </h2>
                </div>
            )}

            {!loading && !isLoggedIn && (
                <div className="mt-6 rounded-[2rem] border border-yellow-400/20 bg-yellow-500/10 p-6">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                        Login Required
                    </p>

                    <p className="mt-2 text-white/60">
                        Sign in with Discord to save your Double Elim Pick&apos;Em.
                    </p>

                    <a
                        href={`/api/auth/discord?returnTo=${encodeURIComponent(
                            window.location.pathname + window.location.search
                        )}`}
                        className="mt-4 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Login Discord
                    </a>
                </div>
            )}

            <div className="mt-10 grid gap-6 xl:grid-cols-4">
                {SECTIONS.map(([key, label]) => (
                    <PickColumn
                        key={key}
                        title={label}
                        teams={teams}
                        selected={picks[key]}
                        onToggle={(team) => togglePick(key, team)}
                    />
                ))}
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Progress
                        </p>

                        <p className="mt-2 text-white/50">
                            {SECTIONS.map(([key, label]) => `${label}: ${picks[key].length}/2`).join(' • ')}
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className={`rounded-2xl px-6 py-4 font-black transition ${
                            canSave && !saving
                                ? 'bg-violet-500 hover:bg-violet-400'
                                : 'cursor-not-allowed bg-white/10 text-white/30'
                        }`}
                    >
                        {saving ? 'Saving...' : "Save Double Elim Pick'Em"}
                    </button>
                </div>

                {success && (
                    <p className="mt-4 font-black text-green-300">
                        Double Elim Pick&apos;Em saved!
                    </p>
                )}

                {error && (
                    <p className="mt-4 font-black text-red-300">
                        {error}
                    </p>
                )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
                {SECTIONS.map(([key, label]) => (
                    <SummaryCard
                        key={key}
                        title={label}
                        teams={picks[key]}
                    />
                ))}
            </div>

            <PublicFooter />
        </PageShell>
    );
}

function PickColumn({ title, teams, selected, onToggle }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        {title}
                    </p>

                    <p className="mt-2 text-white/50">
                        Pick exactly 2 teams.
                    </p>
                </div>

                <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-300">
                    {selected.length}/2
                </span>
            </div>

            <div className="mt-6 grid gap-3">
                {teams.map((team) => {
                    const isSelected = selected.includes(team.name);

                    return (
                        <button
                            key={team.id || team.name}
                            onClick={() => onToggle(team.name)}
                            className={`rounded-2xl border px-4 py-3 text-left font-black transition ${
                                isSelected
                                    ? 'border-violet-400 bg-violet-500/20 text-white'
                                    : 'border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5'
                            }`}
                        >
                            {team.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function SummaryCard({ title, teams }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
                {teams.length ? (
                    teams.map((team) => (
                        <span
                            key={team}
                            className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-300"
                        >
                            {team}
                        </span>
                    ))
                ) : (
                    <span className="text-white/40">
                        No teams selected
                    </span>
                )}
            </div>
        </div>
    );
}

function PageShell({ children }) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <a
                        href="/public"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Communities
                    </a>

                    <a
                        href="/public/leaderboard"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Leaderboard
                    </a>

                    <div className="ml-auto">
                        <PublicAuthButton />
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}