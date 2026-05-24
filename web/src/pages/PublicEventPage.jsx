import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { getPublicOverview, getMatchStats } from '../lib/api';

export default function PublicEventPage() {
    const { slug } = useParams();

    const [data, setData] = useState(null);
    const [nowTick, setNowTick] = useState(Date.now());
    const [matchFilter, setMatchFilter] = useState('ALL');
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [matchModalTab, setMatchModalTab] = useState('overview');
    const [matchStats, setMatchStats] = useState({});
    const [matchStatsLoading, setMatchStatsLoading] = useState(false);

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

    async function loadMatchStats(matchId) {
        try {
            setMatchStatsLoading(true);

            const result = await getMatchStats(matchId);

            setMatchStats((prev) => ({
                ...prev,
                [matchId]: result.stats
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setMatchStatsLoading(false);
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

            setData((prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    event: {
                        ...prev.event,
                        status: payload.status
                    }
                };
            });
        }

        function handleMatchUpdated(payload) {
            if (payload?.slug !== slug) return;

            setData((prev) => {
                if (!prev) return prev;

                const updateMatch = (match) =>
                    String(match.id) === String(payload.matchId)
                        ? {
                            ...match,
                            is_locked: payload.locked ? 1 : 0,
                            ui_status: payload.locked ? 'LOCKED' : 'OPEN'
                        }
                        : match;

                return {
                    ...prev,
                    featured_match: prev.featured_match
                        ? updateMatch(prev.featured_match)
                        : prev.featured_match,
                    matches: (prev.matches || []).map(updateMatch)
                };
            });
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

    useEffect(() => {
        function handleEsc(e) {
            if (e.key === 'Escape') {
                closeMatchModal();
            }
        }

        window.addEventListener('keydown', handleEsc);

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, []);

    function closeMatchModal() {
        setSelectedMatch(null);
        setMatchModalTab('overview');
    }

    function openMatchModal(match) {
        setSelectedMatch(match);
        setMatchModalTab('overview');
        loadMatchStats(match.id);
    }

    function getPickPercent(matchId, teamKey) {
        const stats = matchStats[matchId];
        const total = Number(stats?.predictions || 0);

        if (!total) return 0;

        const picks =
            teamKey === 'team_a'
                ? Number(stats?.team_a_picks || 0)
                : Number(stats?.team_b_picks || 0);

        return Math.round((picks / total) * 100);
    }

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

    const heroMatch = data?.featured_match || null;

    const visiblePublicMatches = heroMatch
        ? publicMatches.filter((match) => match.id !== heroMatch.id)
        : publicMatches;

    const liveMatchesCount = (data?.matches || []).filter(
        (match) => match.ui_status === 'LIVE'
    ).length;

    if (!data) {
        return (
            <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
                <div className="mx-auto max-w-7xl">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />

                    <div className="mt-10 grid gap-6 md:grid-cols-3">
                        <PublicSkeletonCard />
                        <PublicSkeletonCard />
                        <PublicSkeletonCard />
                    </div>

                    <div className="mt-10 h-72 animate-pulse rounded-[2rem] bg-white/10" />

                    <div className="mt-10 grid gap-6 lg:grid-cols-2">
                        <div className="h-96 animate-pulse rounded-[2rem] bg-white/10" />
                        <div className="h-96 animate-pulse rounded-[2rem] bg-white/10" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Public Event
                </p>

                <h1 className="mt-3 text-4xl font-black md:text-6xl">
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
                    <PublicStat title="Players" value={data?.stats?.participants ?? 0} />
                    <PublicStat title="Predictions" value={data?.stats?.predictions ?? 0} />
                    <PublicStat title="Matches" value={data?.stats?.matches ?? 0} />
                </div>

                {heroMatch && (
                    <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8 shadow-[0_0_60px_rgba(139,92,246,0.15)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_45%)]" />

                        <div className="relative z-10">
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">
                                Featured Match
                            </p>

                            {heroMatch.ui_status === 'LIVE' && (
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />

                                    <span className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
                                        Live Now
                                    </span>
                                </div>
                            )}

                            <div className="mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                                <TeamLogoBlock team={heroMatch.team_a} />

                                <div className="text-center">
                                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                        Matchup
                                    </p>

                                    <h2 className="mt-2 text-5xl font-black text-violet-300">
                                        VS
                                    </h2>

                                    <p className="mt-3 text-white/50">
                                        {heroMatch.phase}
                                    </p>
                                </div>

                                <TeamLogoBlock team={heroMatch.team_b} />
                            </div>

                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white/70">
                                    {heroMatch.phase}
                                </span>

                                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white/70">
                                    BO{heroMatch.best_of || 3}
                                </span>

                                <span
                                    className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.15em] ${heroMatch.ui_status === 'LIVE'
                                        ? 'bg-green-500/20 text-green-300 animate-pulse'
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
                                    {heroMatch.formatted_time || 'Start time TBA'}
                                </span>

                                {heroMatch.start_time_utc && (
                                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-violet-200">
                                        {heroMatch.countdown ||
                                            getCountdown(heroMatch.start_time_utc, nowTick)}
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
                        <PublicStat title="Live Matches" value={liveMatchesCount} />
                        <PublicStat title="Total Picks" value={data?.stats?.predictions ?? 0} />
                        <PublicStat title="Event Phase" value={event?.phase || '-'} />
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
                        <PublicPhaseStep active={event?.phase === 'PLAY_IN'} label="Play-In" />
                        <PublicPhaseStep active={event?.phase === 'SWISS'} label="Swiss" />
                        <PublicPhaseStep active={event?.phase === 'PLAYOFFS'} label="Playoffs" />
                        <PublicPhaseStep active={event?.phase === 'FINISHED'} label="Finished" />
                    </div>
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <h2 className="text-3xl font-black">
                            Top Players
                        </h2>

                        <div className="mt-6 grid gap-4">
                            {(!data?.leaderboard || data.leaderboard.length === 0) && (
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
                                        className={`flex items-center justify-between rounded-2xl border p-5 transition-all duration-300 hover:scale-[1.01] ${isTop1
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
                                                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black ${isTop1
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
                                                <h3 className="text-xl font-black md:text-2xl">
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
                            {['ALL', 'OPEN', 'LOCKED', 'LIVE'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setMatchFilter(status)}
                                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${matchFilter === status
                                        ? 'bg-violet-500 text-white'
                                        : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        <p className="mt-4 text-sm font-bold text-white/40">
                            Showing {visiblePublicMatches.length} of {data?.matches?.length || 0} matches
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
                                    onClick={() => openMatchModal(match)}
                                    className={`cursor-pointer rounded-2xl border p-5 transition-all ${match.ui_status === 'LIVE'
                                        ? 'border-green-400/40 bg-green-500/10 shadow-[0_0_60px_rgba(34,197,94,0.18)] animate-pulse'
                                        : 'border-white/10 bg-black/30 hover:border-violet-400/30 hover:bg-violet-500/5'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                                {match.phase} • BO{match.best_of || 3}
                                            </p>

                                            <div className="mt-3 flex items-center gap-3">
                                                <MiniTeamLogo team={match.team_a} />

                                                <h3 className="text-2xl font-black">
                                                    {match.team_a} vs {match.team_b}
                                                </h3>

                                                <MiniTeamLogo team={match.team_b} />
                                            </div>

                                            <p className="mt-2 text-sm text-white/40">
                                                Match #{match.match_no || '-'}
                                            </p>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${match.ui_status === 'LOCKED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : match.ui_status === 'LIVE'
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-yellow-500/20 text-yellow-300'
                                                }`}
                                        >
                                            {match.ui_status}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/40">
                                        <span>
                                            {match.formatted_time || 'Start time TBA'}
                                        </span>

                                        {match.start_time_utc && (
                                            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-200">
                                                {match.countdown ||
                                                    getCountdown(match.start_time_utc, nowTick)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {selectedMatch && (
                    <MatchModal
                        selectedMatch={selectedMatch}
                        matchModalTab={matchModalTab}
                        setMatchModalTab={setMatchModalTab}
                        matchStats={matchStats}
                        matchStatsLoading={matchStatsLoading}
                        getPickPercent={getPickPercent}
                        closeMatchModal={closeMatchModal}
                    />
                )}
            </div>
        </div>
    );
}

function MatchModal({
    selectedMatch,
    matchModalTab,
    setMatchModalTab,
    matchStats,
    matchStatsLoading,
    getPickPercent,
    closeMatchModal
}) {
    const teamAPercent = getPickPercent(selectedMatch.id, 'team_a');
    const teamBPercent = getPickPercent(selectedMatch.id, 'team_b');

    const communityFavorite =
        teamAPercent > teamBPercent
            ? 'team_a'
            : teamBPercent > teamAPercent
                ? 'team_b'
                : null;

    return (
        <div
            onClick={closeMatchModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl animate-in zoom-in-95 duration-200 md:p-8"
            >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Match Details
                        </p>

                        <div className="mt-6 grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                            <TeamLogoBlock team={selectedMatch.team_a} />

                            <div className="text-center">
                                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                    Matchup
                                </p>

                                <h2 className="mt-2 text-5xl font-black text-violet-300">
                                    VS
                                </h2>

                                <p className="mt-3 text-white/50">
                                    {selectedMatch.phase}
                                </p>
                            </div>

                            <TeamLogoBlock team={selectedMatch.team_b} />
                        </div>
                    </div>

                    <button
                        onClick={closeMatchModal}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <PublicStat title="Phase" value={selectedMatch.phase || '-'} />
                    <PublicStat title="BO" value={`BO${selectedMatch.best_of || 3}`} />
                    <PublicStat title="Status" value={selectedMatch.ui_status || '-'} />
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    {['overview', 'predictions', 'stats'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setMatchModalTab(tab)}
                            className={`rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.15em] transition ${matchModalTab === tab
                                ? 'bg-violet-500 text-white'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {matchModalTab === 'overview' && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                        <p className="text-sm uppercase tracking-[0.2em] text-white/40">
                            Start time
                        </p>

                        <p className="mt-2 text-xl font-black">
                            {selectedMatch.formatted_time || 'Start time TBA'}
                        </p>

                        {selectedMatch.countdown && (
                            <p className="mt-2 font-black text-violet-300">
                                {selectedMatch.countdown}
                            </p>
                        )}
                    </div>
                )}

                {matchModalTab === 'predictions' && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Predictions
                        </p>

                        {matchStatsLoading && (
                            <p className="mt-3 text-white/50">
                                Loading prediction stats...
                            </p>
                        )}

                        {!matchStatsLoading && (
                            <>
                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <PublicStat
                                        title="Total Picks"
                                        value={matchStats[selectedMatch.id]?.predictions ?? 0}
                                    />

                                    <PublicStat
                                        title={selectedMatch.team_a}
                                        value={matchStats[selectedMatch.id]?.team_a_picks ?? 0}
                                    />

                                    <PublicStat
                                        title={selectedMatch.team_b}
                                        value={matchStats[selectedMatch.id]?.team_b_picks ?? 0}
                                    />
                                </div>

                                {(matchStats[selectedMatch.id]?.predictions ?? 0) > 0 && (
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between text-sm font-bold text-white/50">
                                            <span
                                                className={
                                                    communityFavorite === 'team_a'
                                                        ? 'text-violet-300'
                                                        : ''
                                                }
                                            >
                                                {selectedMatch.team_a} — {teamAPercent}%
                                            </span>

                                            <span
                                                className={
                                                    communityFavorite === 'team_b'
                                                        ? 'text-red-300'
                                                        : ''
                                                }
                                            >
                                                {selectedMatch.team_b} — {teamBPercent}%
                                            </span>
                                        </div>

                                        <div className="mt-3 flex h-5 overflow-hidden rounded-full border border-white/10 bg-white/5">
                                            <div
                                                className="relative bg-violet-500 transition-all duration-500"
                                                style={{ width: `${teamAPercent}%` }}
                                            />

                                            <div
                                                className="relative bg-red-500 transition-all duration-500"
                                                style={{ width: `${teamBPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {(matchStats[selectedMatch.id]?.predictions ?? 0) === 0 && (
                                    <p className="mt-4 text-white/50">
                                        No community predictions yet.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                )}

                {matchModalTab === 'stats' && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Stats
                        </p>

                        <p className="mt-3 text-white/50">
                            Match analytics will appear here soon.
                        </p>
                    </div>
                )}

                <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Want to make your pick?
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-white/60">
                            Join our Discord and submit your prediction before the match locks.
                        </p>

                        <a
                            href="https://discord.gg/TWOJ-LINK"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400"
                        >
                            Join Discord
                        </a>
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

    if (diff <= 0) return 'LIVE';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (hours <= 0) return `${minutes}m`;

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

function TeamLogoBlock({ team }) {
    return (
        <div className="min-w-0 text-center">
            <div
                className={`relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br ${getTeamColor(team)} text-3xl font-black`}
            >
                <span className="relative z-0">
                    {team?.charAt(0)}
                </span>

                <img
                    src={getTeamLogo(team)}
                    alt={team}
                    className="absolute z-10 h-16 w-16 object-contain"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            </div>

            <h2 className="mt-4 break-words text-xl font-black md:text-2xl">
                {team}
            </h2>
        </div>
    );
}

function MiniTeamLogo({ team }) {
    return (
        <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${getTeamColor(team)} text-sm font-black`}>
            <span className="relative z-0">
                {team?.charAt(0)}
            </span>

            <img
                src={getTeamLogo(team)}
                alt={team}
                className="absolute z-10 h-7 w-7 object-contain"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                }}
            />
        </div>
    );
}

function getTeamLogo(teamName) {
    if (!teamName) return null;

    return `/team-logos/${teamName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')}.png`;
}

function getTeamColor(teamName) {
    if (!teamName) {
        return 'from-violet-500/20 to-fuchsia-500/20';
    }

    const colors = [
        'from-red-500/20 to-orange-500/20',
        'from-blue-500/20 to-cyan-500/20',
        'from-green-500/20 to-emerald-500/20',
        'from-violet-500/20 to-fuchsia-500/20',
        'from-yellow-500/20 to-orange-500/20',
        'from-pink-500/20 to-rose-500/20'
    ];

    const hash = teamName
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    return colors[hash % colors.length];
}

function PublicSkeletonCard() {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-10 w-20 animate-pulse rounded-xl bg-white/10" />
        </div>
    );
}