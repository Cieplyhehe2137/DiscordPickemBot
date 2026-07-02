import { useEffect, useState } from 'react';
import { getPublicServers, getPublicLeaderboard } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

export default function PublicServersPage() {
    const [data, setData] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    const { isLoggedIn, user } = usePublicAuth();

    useEffect(() => {
        async function loadServers() {
            try {
                const result = await getPublicServers();
                setData(result);
            } catch (err) {
                console.error(err);
            }

            try {
                const leaderboardResult = await getPublicLeaderboard();

                setLeaderboard(
                    (leaderboardResult.leaderboard || []).slice(0, 3)
                );
            } catch (err) {
                console.error(err);
            }
        }

        loadServers();
    }, []);

    if (!data) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

                <div className="relative z-10 mx-auto max-w-7xl">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />

                    <div className="mt-10 grid gap-6 md:grid-cols-2">
                        <div className="h-56 animate-pulse rounded-[2rem] bg-white/10" />
                        <div className="h-56 animate-pulse rounded-[2rem] bg-white/10" />
                    </div>
                </div>
            </div>
        );
    }

    const servers = data.servers || [];

    return (
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <a
                        href="/public"
                        className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300"
                    >
                        Pick&apos;Em Platform
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

                <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8 shadow-[0_0_60px_rgba(139,92,246,0.15)]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_45%)]" />

                    <div className="relative z-10">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Community Pick&apos;Em Platform
                        </p>

                        <h1 className="mt-4 text-5xl font-black md:text-7xl">
                            Predict esports.
                            <br />
                            Compete publicly.
                        </h1>

                        <p className="mt-6 max-w-3xl text-lg text-white/60">
                            Join community Pick&apos;Em events, track your prediction accuracy,
                            climb leaderboards and compete against other esports fans.
                        </p>

                        {isLoggedIn && user && (
                            <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-black/30 p-6">
                                <div className="flex flex-wrap items-center gap-4">
                                    {user.avatar && (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`}
                                            alt={user.global_name || user.username}
                                            className="h-16 w-16 rounded-2xl object-cover"
                                        />
                                    )}

                                    <div>
                                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                            Signed in as
                                        </p>

                                        <h2 className="mt-1 text-2xl font-black">
                                            {user.global_name || user.username}
                                        </h2>

                                        <p className="mt-1 text-white/40">
                                            Discord connected
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-8 flex flex-wrap gap-4">
                            <a
                                href="/public/leaderboard"
                                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                            >
                                View Leaderboard
                            </a>

                            <a
                                href="/public/me/predictions"
                                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                            >
                                My Predictions
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    <HomeFeatureCard
                        title="Live Events"
                        description="Follow active community Pick&apos;Em events with live matches and public standings."
                    />

                    <HomeFeatureCard
                        title="Player Profiles"
                        description="Track prediction history, accuracy, exact score hits and achievements."
                    />

                    <HomeFeatureCard
                        title="Leaderboards"
                        description="Compete with other players by points, accuracy and perfect score predictions."
                    />
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Platform Stats
                    </p>

                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        <PublicMiniStat
                            title="Communities"
                            value={servers.length}
                        />

                        <PublicMiniStat
                            title="Open Events"
                            value={servers.reduce(
                                (acc, server) => acc + (server.open_events || 0),
                                0
                            )}
                        />
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                Top Players
                            </p>

                            <h2 className="mt-3 text-4xl font-black">
                                Community Leaderboard
                            </h2>
                        </div>

                        <a
                            href="/public/leaderboard"
                            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                        >
                            Full Leaderboard
                        </a>
                    </div>

                    <div className="mt-8 grid gap-4">
                        {leaderboard.map((player, index) => (
                            <a
                                key={player.user_id}
                                href={`/public/users/${player.user_id}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-xl font-black text-violet-200">
                                            {index === 0
                                                ? '👑'
                                                : index === 1
                                                    ? '🥈'
                                                    : '🥉'}
                                        </div>

                                        <div>
                                            <h3 className="break-all text-2xl font-black">
                                                {player.user_id}
                                            </h3>

                                            <p className="mt-1 text-sm text-white/40">
                                                {player.total_predictions} predictions
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <PublicMiniStat
                                            title="Points"
                                            value={player.total_points}
                                        />

                                        <PublicMiniStat
                                            title="Accuracy"
                                            value={`${player.accuracy}%`}
                                        />
                                    </div>
                                </div>
                            </a>
                        ))}

                        {leaderboard.length === 0 && (
                            <p className="text-white/50">
                                No leaderboard data yet.
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-10">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Pick&apos;Em Platform
                    </p>

                    <h1 className="mt-3 text-4xl font-black md:text-6xl">
                        Choose your community
                    </h1>

                    <p className="mt-4 max-w-2xl text-white/50">
                        Browse active Pick&apos;Em communities, join Discord and follow live events.
                    </p>
                </div>

                <div className="mt-10 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Trending Events
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {(data.featured_events || []).map((event) => (
                            <a
                                key={event.id}
                                href={`/public/event/${event.slug}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                            >
                                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                    {event.phase}
                                </p>

                                <h3 className="mt-2 text-2xl font-black">
                                    {event.name}
                                </h3>

                                <span
                                    className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${
                                        event.status === 'OPEN'
                                            ? 'bg-green-500/20 text-green-300'
                                            : event.status === 'CLOSED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-zinc-500/20 text-zinc-300'
                                    }`}
                                >
                                    {event.status}
                                </span>
                            </a>
                        ))}

                        {(data.featured_events || []).length === 0 && (
                            <p className="text-white/50">
                                No trending events yet.
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-2">
                    {servers.map((server) => (
                        <div
                            key={server.guild_id}
                            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                        >
                            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                Community
                            </p>

                            <h2 className="mt-3 text-4xl font-black">
                                {server.name}
                            </h2>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <PublicMiniStat title="Events" value={server.events_count} />
                                <PublicMiniStat title="Open Events" value={server.open_events} />
                            </div>

                            <div className="mt-6 flex flex-wrap gap-4">
                                <a
                                    href={`/public/${server.slug}`}
                                    className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                                >
                                    Open Hub
                                </a>

                                {server.discord_url && (
                                    <a
                                        href={server.discord_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                                    >
                                        Join Discord
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}

                    {servers.length === 0 && (
                        <p className="text-white/50">
                            No public communities yet.
                        </p>
                    )}
                </div>

                <PublicFooter />
            </div>
        </div>
    );
}

function PublicMiniStat({ title, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                {title}
            </p>

            <p className="mt-2 text-3xl font-black text-violet-300">
                {value}
            </p>
        </div>
    );
}

function HomeFeatureCard({ title, description }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xl font-black">
                {title}
            </p>

            <p className="mt-3 text-white/50">
                {description}
            </p>
        </div>
    );
}