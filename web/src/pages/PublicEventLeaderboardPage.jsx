import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicEventLeaderboard } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

export default function PublicEventLeaderboardPage() {
    const { slug } = useParams();
    const { user } = usePublicAuth();

    const [data, setData] = useState(null);

    useEffect(() => {
        async function loadLeaderboard() {
            try {
                const result = await getPublicEventLeaderboard(slug);
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        loadLeaderboard();
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

    const leaderboard = data.leaderboard || [];
    const isMe = user?.id === player.user_id;

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Event Leaderboard
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                {data.event?.name}
            </h1>

            <p className="mt-4 max-w-2xl text-white/50">
                Ranking for this event based on Swiss, match and playoff points.
            </p>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                <div className="grid gap-4">
                    {leaderboard.map((player) => (
                        <a
                            key={player.user_id}
                            href={`/public/users/${player.user_id}`}
                            className={`rounded-2xl border p-5 transition ${isMe
                                ? 'border-violet-400 bg-violet-500/10'
                                : 'border-white/10 bg-black/30 hover:border-violet-400/30 hover:bg-violet-500/5'
                                }`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-xl font-black text-violet-200">
                                        {player.rank === 1
                                            ? '🥇'
                                            : player.rank === 2
                                                ? '🥈'
                                                : player.rank === 3
                                                    ? '🥉'
                                                    : `#${player.rank}`}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="break-all text-2xl font-black">
                                                {player.displayname || player.user_id}
                                            </h3>

                                            {isMe && (
                                                <span className="rounded-full bg-violet-500 px-2 py-1 text-xs font-black text-white">
                                                    YOU
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-1 text-sm text-white/40">
                                            Discord ID: {player.user_id}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                                    <MiniStat title="Total" value={player.total_points} />
                                    <MiniStat title="Swiss" value={player.swiss_points} />
                                    <MiniStat title="Matches" value={player.match_points} />
                                    <MiniStat title="Playoffs" value={player.playoffs_points} />
                                    <MiniStat title="Play-In" value={player.playin_points} />
                                    <MiniStat title="Double" value={player.doubleelim_points} />
                                </div>
                            </div>
                        </a>
                    ))}

                    {leaderboard.length === 0 && (
                        <p className="text-white/50">
                            No event leaderboard data yet.
                        </p>
                    )}
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

                    <a
                        href="/public/leaderboard"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Global Leaderboard
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

function MiniStat({ title, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">
                {title}
            </p>

            <p className="mt-1 text-xl font-black text-violet-300">
                {value}
            </p>
        </div>
    );
}