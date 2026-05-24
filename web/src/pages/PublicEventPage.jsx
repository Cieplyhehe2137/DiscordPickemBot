import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { getPublicOverview } from '../lib/api';

export default function PublicEventPage() {
    const { slug } = useParams();

    const [data, setData] = useState(null);
    const [nowTick, setNowTick] = useState(Date.now());
    const [matchFilter, setMatchFilter] = useState('ALL');

    const publicUrl = `${window.location.origin}/public/${slug}`;

    useEffect(() => {
        const interval = setInterval(() => {
            setNowTick(Date.now());
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    async function copyPublicUrl() {
        try {
            await navigator.clipboard.writeText(publicUrl);
            alert('Public link copied!');
        } catch (err) {
            console.error(err);
        }
    }

    async function loadPublicData() {
        try {
            const result = await getPublicOverview(slug);
            setData(result);
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        loadPublicData();
    }, [slug]);

    useEffect(() => {
        function handleDashboardRefresh(payload) {
            if (payload?.slug !== slug) return;

            loadPublicData();
        }

        function handleEventStatusUpdated(payload) {
            if (payload?.slug !== slug) return;

            setData((prev) => ({
                ...prev,
                event: {
                    ...prev.event,
                    status: payload.status
                }
            }));
        }

        function handleMatchUpdated(payload) {
            if (payload?.slug !== slug) return;

            setData((prev) => ({
                ...prev,
                matches: prev.matches.map((match) =>
                    String(match.id) === String(payload.matchId)
                        ? {
                            ...match,
                            is_locked: payload.locked ? 1 : 0,
                            ui_status: payload.locked ? 'LOCKED' : 'OPEN'
                        }
                        : match
                )
            }));
        }

        socket.on('dashboard:refresh', handleDashboardRefresh);
        socket.on('event:status_updated', handleEventStatusUpdated);
        socket.on('match:updated', handleMatchUpdated);

        return () => {
            socket.off('dashboard:refresh', handleDashboardRefresh);
            socket.off('event:status_updated', handleEventStatusUpdated);
            socket.off('match:updated', handleMatchUpdated);
        };
    }, [slug]);

    const event = data?.event;

    const publicMatches = [...(data?.matches || [])]
        .filter((match) => {
            if (matchFilter === 'ALL') return true;
            return match.ui_status === matchFilter;
        })
        .sort((a, b) => {
            const order = {
                LIVE: 0,
                OPEN: 1,
                LOCKED: 2
            };

            return (order[a.ui_status] ?? 99) - (order[b.ui_status] ?? 99);
        });

    const heroMatch =
        publicMatches.find((m) => m.ui_status === 'LIVE') ||
        publicMatches.find((m) => m.ui_status === 'OPEN') ||
        publicMatches[0];

    const visiblePublicMatches = heroMatch
        ? publicMatches.filter((match) => match.id !== heroMatch.id)
        : publicMatches;

    const liveMatchesCount = (data?.matches || []).filter(
        (match) => match.ui_status === 'LIVE'
    ).length;

    return (
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Public Event
                </p>

                <h1 className="mt-3 text-6xl font-black">
                    {event?.name || slug}
                </h1>

                <div className="mt-4 flex flex-wrap gap-3">
                    <div className="inline-flex rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-green-300">
                        Live Updates Enabled
                    </div>

                    <span
                        className={`inline-flex rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.2em] ${event?.status === 'OPEN'
                            ? 'bg-green-500/15 text-green-300'
                            : event?.status === 'CLOSED'
                                ? 'bg-red-500/15 text-red-300'
                                : 'bg-zinc-500/15 text-zinc-300'
                            }`}
                    >
                        {event?.status || 'UNKNOWN'}
                    </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-4">
                    <button
                        onClick={copyPublicUrl}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Copy Public Link
                    </button>

                    <a
                        href="https://discord.gg/TWOJ-LINK"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Join Discord
                    </a>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white/60">
                        {publicUrl}
                    </div>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    <PublicStat
                        title="Players"
                        value={data?.stats?.participants ?? 0}
                    />

                    <PublicStat
                        title="Predictions"
                        value={data?.stats?.predictions ?? 0}
                    />

                    <PublicStat
                        title="Matches"
                        value={data?.stats?.matches ?? 0}
                    />
                </div>

                {heroMatch && (
                    <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8 shadow-[0_0_60px_rgba(139,92,246,0.15)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_45%)]" />

                        <div className="relative z-10">
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">
                                Featured Match
                            </p>

                            <h2 className="mt-4 text-5xl font-black">
                                {heroMatch.team_a} vs {heroMatch.team_b}
                            </h2>

                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white/70">
                                    {heroMatch.phase}
                                </span>

                                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white/70">
                                    BO{heroMatch.best_of || 3}
                                </span>

                                <span
                                    className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.15em] ${heroMatch.ui_status === 'LIVE'
                                        ? 'bg-green-500/20 text-green-300'
                                        : heroMatch.ui_status === 'LOCKED'
                                            ? 'bg-red-500/20 text-red-300'
                                            : 'bg-yellow-500/20 text-yellow-300'
                                        }`}
                                >
                                    {heroMatch.ui_status}
                                </span>
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-4 text-white/60">
                                <span>
                                    {heroMatch.start_time_utc
                                        ? new Date(
                                            heroMatch.start_time_utc
                                        ).toLocaleString()
                                        : 'Start time TBA'}
                                </span>

                                {heroMatch.start_time_utc && (
                                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-violet-200">
                                        {getCountdown(
                                            heroMatch.start_time_utc,
                                            nowTick
                                        )}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                Join the Pick&apos;Em
                            </p>

                            <h2 className="mt-2 text-2xl font-black">
                                Think you can predict better than the community?
                            </h2>
                        </div>

                        <a
                            href="https://discord.gg/TWOJ-LINK"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                        >
                            Join Discord
                        </a>
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Community Pulse
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <PublicStat
                            title="Live Matches"
                            value={liveMatchesCount}
                        />

                        <PublicStat
                            title="Total Picks"
                            value={data?.stats?.predictions ?? 0}
                        />

                        <PublicStat
                            title="Event Phase"
                            value={event?.phase || '-'}
                        />
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Tournament Progress
                    </p>

                    <h2 className="mt-3 text-4xl font-black">
                        {event?.phase || 'UNKNOWN'}
                    </h2>

                    <p className="mt-2 text-white/50">
                        Current public tournament stage.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-4">
                        <PublicPhaseStep
                            active={event?.phase === 'PLAY_IN'}
                            label="Play-In"
                        />

                        <PublicPhaseStep
                            active={event?.phase === 'SWISS'}
                            label="Swiss"
                        />

                        <PublicPhaseStep
                            active={event?.phase === 'PLAYOFFS'}
                            label="Playoffs"
                        />

                        <PublicPhaseStep
                            active={event?.phase === 'FINISHED'}
                            label="Finished"
                        />
                    </div>
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <h2 className="text-3xl font-black">
                            Top Players
                        </h2>

                        <div className="mt-6 grid gap-4">
                            {(!data?.leaderboard ||
                                data.leaderboard.length === 0) && (
                                    <p className="text-white/50">
                                        No leaderboard data yet.
                                    </p>
                                )}

                            {data?.leaderboard?.map((player, index) => {
                                const isTop1 = index === 0;
                                const isTop2 = index === 1;
                                const isTop3 = index === 2;

                                return (
                                    <div
                                        key={player.user_id}
                                        className={`flex items-center justify-between rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.01]
                                        ${isTop1
                                                ? 'border-yellow-400/30 bg-yellow-500/10 shadow-[0_0_40px_rgba(250,204,21,0.15)]'
                                                : isTop2
                                                    ? 'border-zinc-300/20 bg-zinc-400/10'
                                                    : isTop3
                                                        ? 'border-orange-400/20 bg-orange-500/10'
                                                        : 'border-white/10 bg-black/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black
                                                ${isTop1
                                                        ? 'bg-yellow-400/20 text-yellow-200'
                                                        : isTop2
                                                            ? 'bg-zinc-300/20 text-zinc-100'
                                                            : isTop3
                                                                ? 'bg-orange-400/20 text-orange-200'
                                                                : 'bg-violet-500/20'
                                                    }`}
                                            >
                                                #{index + 1}
                                            </div>

                                            <div>
                                                <h3 className="text-2xl font-black">
                                                    {player.user_id}
                                                </h3>

                                                <p className="text-sm text-white/40">
                                                    Pick&apos;Em Player
                                                </p>
                                                {player.rank_change > 0 && (
                                                    <p className="mt-2 text-sm font-black text-green-300">
                                                        ↑ +{player.rank_change}
                                                    </p>
                                                )}

                                                {player.rank_change < 0 && (
                                                    <p className="mt-2 text-sm font-black text-red-300">
                                                        ↓ {player.rank_change}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-3xl font-black text-green-300">
                                                {player.total_points}
                                            </p>

                                            <p className="text-sm text-white/40">
                                                points
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <h2 className="text-3xl font-black">
                            Matches
                        </h2>

                        <div className="mt-6 flex flex-wrap gap-3">
                            {['ALL', 'OPEN', 'LOCKED', 'LIVE'].map(
                                (status) => (
                                    <button
                                        key={status}
                                        onClick={() =>
                                            setMatchFilter(status)
                                        }
                                        className={`rounded-2xl px-5 py-3 text-sm font-black transition ${matchFilter === status
                                            ? 'bg-violet-500 text-white'
                                            : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                )
                            )}
                        </div>

                        <p className="mt-4 text-sm font-bold text-white/40">
                            Showing {publicMatches.length} of{' '}
                            {data?.matches?.length || 0} matches
                        </p>

                        <div className="mt-6 grid gap-4">
                            {visiblePublicMatches.length === 0 && !heroMatch && (
                                <p className="text-white/50">
                                    {(data?.matches?.length || 0) === 0
                                        ? 'No matches published yet.'
                                        : 'No matches match this filter.'}
                                </p>
                            )}

                            {visiblePublicMatches.map((match) => (
                                <div
                                    key={match.id}
                                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                                {match.phase} • BO
                                                {match.best_of || 3}
                                            </p>

                                            <h3 className="mt-2 text-2xl font-black">
                                                {match.team_a} vs{' '}
                                                {match.team_b}
                                            </h3>

                                            <p className="mt-2 text-sm text-white/40">
                                                Match #
                                                {match.match_no || '-'}
                                            </p>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${match.ui_status === 'LOCKED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-green-500/20 text-green-300'
                                                }`}
                                        >
                                            {match.ui_status}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/40">
                                        <span>
                                            {match.start_time_utc
                                                ? new Date(
                                                    match.start_time_utc
                                                ).toLocaleString()
                                                : 'Start time TBA'}
                                        </span>

                                        {match.start_time_utc && (
                                            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-200">
                                                {getCountdown(
                                                    match.start_time_utc,
                                                    nowTick
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PublicStat({ title, value }) {
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

function getCountdown(date, nowTick) {
    const target = new Date(date).getTime();
    const diff = target - nowTick;

    if (diff <= 0) {
        return 'LIVE';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (hours <= 0) {
        return `${minutes}m`;
    }

    return `${hours}h ${minutes}m`;
}

function PublicPhaseStep({ label, active }) {
    return (
        <div
            className={`rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-[0.2em] transition ${active
                ? 'border-violet-400 bg-violet-500/20 text-violet-200'
                : 'border-white/10 bg-black/20 text-white/40'
                }`}
        >
            {label}
        </div>
    );
}