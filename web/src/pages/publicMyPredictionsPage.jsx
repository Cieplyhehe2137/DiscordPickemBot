import { useEffect, useState } from 'react';
import { getMyPublicPredictions } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

export default function PublicMyPredictionsPage() {
    const { isLoggedIn, loading } = usePublicAuth();

    const [data, setData] = useState(null);
    const [filter, setFilter] = useState('ALL');

    useEffect(() => {
        async function loadPredictions() {
            if (!isLoggedIn || loading) return;

            try {
                const result = await getMyPublicPredictions();
                setData(result);
            } catch (err) {
                console.warn(err);
                setData({ predictions: [] });
            }
        }

        loadPredictions();
    }, [isLoggedIn, loading]);

    if (loading) {
        return (
            <PageShell>
                <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
            </PageShell>
        );
    }

    if (!isLoggedIn) {
        return (
            <PageShell>
                <h1 className="text-4xl font-black md:text-6xl">
                    Login required
                </h1>

                <p className="mt-4 max-w-2xl text-white/50">
                    Sign in with Discord to view your predictions.
                </p>

                <a
                    href="/api/auth/discord"
                    className="mt-6 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                >
                    Login Discord
                </a>
            </PageShell>
        );
    }

    if (!data) {
        return (
            <PageShell>
                <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-10 h-72 animate-pulse rounded-[2rem] bg-white/10" />
            </PageShell>
        );
    }

    const predictions = data.predictions || [];

    const filteredPredictions = predictions.filter((prediction) => {
        if (filter === 'ALL') return true;

        if (filter === 'OPEN') {
            return !prediction.is_locked;
        }

        if (filter === 'LOCKED') {
            return prediction.is_locked;
        }

        if (filter === 'CORRECT') {
            return prediction.is_correct_winner === true;
        }

        if (filter === 'EXACT') {
            return prediction.is_exact_score === true;
        }

        return true;
    });

    const sortedPredictions = [...filteredPredictions].sort((a, b) => {
        if (sort === 'EVENT') {
            return String(a.event_name).localeCompare(String(b.event_name));
        }

        if (sort === 'OPEN_FIRST') {
            return Number(a.is_locked) - Number(b.is_locked);
        }

        if (sort === 'LOCKED_FIRST') {
            return Number(b.is_locked) - Number(a.is_locked);
        }

        return 0;
    });

    const finishedPredictions = predictions.filter(
        (prediction) => prediction.match_status === 'FINAL'
    );

    const correctWinnerCount = finishedPredictions.filter(
        (prediction) => prediction.is_correct_winner === true
    ).length;

    const exactScoreCount = finishedPredictions.filter(
        (prediction) => prediction.is_exact_score === true
    ).length;

    const accuracy =
        finishedPredictions.length > 0
            ? Math.round((correctWinnerCount / finishedPredictions.length) * 100)
            : 0;

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                My Pick&apos;Em
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                My Predictions
            </h1>

            <p className="mt-4 max-w-2xl text-white/50">
                Review your saved predictions across public Pick&apos;Em events.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-5">
                <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <div>
                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                Prediction Performance
                            </p>

                            <h2 className="mt-3 text-3xl font-black">
                                {accuracy}% Accuracy
                            </h2>

                            <p className="mt-2 text-white/50">
                                {correctWinnerCount} correct winners • {exactScoreCount} exact scores
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-4">
                                <p className="text-sm text-green-300">
                                    Correct Picks
                                </p>

                                <p className="mt-1 text-3xl font-black text-green-200">
                                    {correctWinnerCount}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-5 py-4">
                                <p className="text-sm text-yellow-300">
                                    Exact Hits
                                </p>

                                <p className="mt-1 text-3xl font-black text-yellow-200">
                                    {exactScoreCount}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <StatCard title="Saved Picks" value={predictions.length} />
                <StatCard
                    title="Open Picks"
                    value={predictions.filter((p) => !p.is_locked).length}
                />
                <StatCard
                    title="Locked Picks"
                    value={predictions.filter((p) => p.is_locked).length}
                />
                <StatCard title="Accuracy" value={`${accuracy}%`} />
                <StatCard title="Exact Hits" value={exactScoreCount} />
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Predictions
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    {['ALL', 'OPEN', 'LOCKED', 'CORRECT', 'EXACT'].map((item) => (
                        <button
                            key={item}
                            onClick={() => setFilter(item)}
                            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${filter === item
                                ? 'bg-violet-500 text-white'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid gap-4">
                    {sortedPredictions.map((prediction) => (
                        <a
                            key={`${prediction.event_slug}-${prediction.match_id}`}
                            href={`/public/event/${prediction.event_slug}?match=${prediction.match_id}&predict=1`}
                            className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                        {prediction.event_name}
                                    </p>

                                    <h3 className="mt-2 text-2xl font-black">
                                        {prediction.team_a} vs {prediction.team_b}
                                    </h3>

                                    <p className="mt-2 text-white/50">
                                        Your pick: {prediction.score_a}:{prediction.score_b}
                                        {prediction.match_status === 'FINAL' && (
                                            <div
                                                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${prediction.is_correct_winner
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-red-500/20 text-red-300'
                                                    }`}
                                            >
                                                {prediction.is_correct_winner
                                                    ? 'Correct Winner'
                                                    : 'Wrong Pick'}
                                                {prediction.is_exact_score && (
                                                    <div className="mt-2 inline-flex rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-yellow-300">
                                                        Exact Score
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </p>
                                    {prediction.match_status === 'FINAL' && (
                                        <p className="mt-2 text-white/50">
                                            Result: {prediction.actual_score_a}:{prediction.actual_score_b}
                                        </p>
                                    )}
                                    <div className="mt-4 inline-flex rounded-xl bg-violet-500 px-4 py-2 text-sm font-black transition hover:bg-violet-400">
                                        Open Event
                                    </div>
                                </div>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${prediction.is_locked
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-green-500/20 text-green-300'
                                        }`}
                                >
                                    {prediction.is_locked ? 'Locked' : 'Editable'}
                                </span>
                            </div>
                        </a>
                    ))}

                    {sortedPredictions.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
                            <p className="text-xl font-black">
                                No predictions found
                            </p>

                            <p className="mt-2 text-white/50">
                                {predictions.length === 0
                                    ? 'You do not have any saved predictions yet.'
                                    : 'No predictions match the selected filters.'}
                            </p>

                            <a
                                href="/public"
                                className="mt-5 inline-flex rounded-xl bg-violet-500 px-4 py-2 text-sm font-black transition hover:bg-violet-400"
                            >
                                Browse Events
                            </a>
                        </div>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                        {[
                            ['NEWEST', 'Newest'],
                            ['EVENT', 'Event'],
                            ['OPEN_FIRST', 'Open First'],
                            ['LOCKED_FIRST', 'Locked First']
                        ].map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setSort(value)}
                                className={`rounded-2xl px-5 py-3 text-sm font-black transition ${sort === value
                                    ? 'bg-violet-500 text-white'
                                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <PublicFooter />
        </PageShell>
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

                    <div className="h-5 w-px bg-white/10" />

                    <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
                        My Predictions
                    </span>

                    <div className="ml-auto">
                        <PublicAuthButton />
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}

function StatCard({ title, value }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h2 className="mt-3 text-4xl font-black">
                {value}
            </h2>
        </div>
    );
}