import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { socket } from '../lib/socket';
import { getPublicOverview, getMatchStats, savePublicPrediction, getPublicPrediction, getPublicEventPredictions, getPublicEventLeaderboard, getSwissStats, getPublicEventMatchStats } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import { usePublicAuth } from '../context/PublicAuthContext';
import CommunityMatchPredictions from '../components/public/CommunityMatchPredictions';
import CommunityPulse from '../components/public/CommunityPulse';
import SwissPickemTrends from '../components/public/SwissPickemTrends';
import EventLeaderboardPreview from '../components/public/EventLeaderboardPreview';
import TournamentProgress from '../components/public/TournamentProgress';
import MyPickemProgress from '../components/public/MyPickemProgress';
import StickyPickemProgress from '../components/public/StickyPickemProgress';
import SwissPickemHistory from '../components/public/SwissPickemHistory';
import PublicNavbar from '../components/public/PublicNavbar';
import PublicEventStatsGrid from '../components/public/PublicEventStatsGrid';
import PublicLatestPredictionCard from '../components/public/PublicLatestPredictionCard';
import TeamLogoBlock, { MiniTeamLogo } from '../components/public/TeamLogoBlock';
import PublicFeaturedMatch from '../components/public/PublicFeaturedMatch';
import PublicMatchCard from '../components/public/PublicMatchCard';
import PublicMatchesSection from '../components/public/PublicMatchesSection';

export default function PublicEventPage() {
    const [eventMatchStats, setEventMatchStats] = useState([]);
    const [eventLeaderboard, setEventLeaderboard] = useState([]);
    const [swissStats, setSwissStats] = useState(null);
    const { slug } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [nowTick, setNowTick] = useState(Date.now());
    const [matchFilter, setMatchFilter] = useState('ALL');
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [predictionMatch, setPredictionMatch] = useState(null);
    const [matchModalTab, setMatchModalTab] = useState('overview');
    const [matchStats, setMatchStats] = useState({});
    const [matchStatsLoading, setMatchStatsLoading] = useState(false);
    const [myPredictions, setMyPredictions] = useState({});
    const { isLoggedIn, user } = usePublicAuth();
    const [showOnlyMyPicks, setShowOnlyMyPicks] = useState(false);

    const publicUrl = `${window.location.origin}/public/event/${slug}`;

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

            try {
                const leaderboardResult =
                    await getPublicEventLeaderboard(slug);

                setEventLeaderboard(
                    (leaderboardResult.leaderboard || []).slice(0, 5)
                );
            } catch (err) {
                console.error(err);
            }

            try {
                const statsResult =
                    await getSwissStats(slug, 'stage1');

                setSwissStats(statsResult);
            } catch (err) {
                console.error(err);
            }

            try {
                const matchStatsResult = await getPublicEventMatchStats(slug);

                setEventMatchStats(matchStatsResult.matches || []);
            } catch (err) {
                console.error(err);
            }

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
        if (!data?.matches?.length) return;

        const matchId = searchParams.get('match');
        const shouldPredict = searchParams.get('predict');

        if (!matchId || shouldPredict !== '1') {
            return;
        }

        const match = data.matches.find(
            (m) => String(m.id) === String(matchId)
        );

        if (!match) return;

        openPredictionModal(match);
        navigate(`/public/event/${slug}`, { replace: true });
    }, [data, searchParams, navigate, slug]);

    useEffect(() => {
        async function loadMyPredictions() {
            if (!isLoggedIn || !user?.id || !data?.event?.id) return;

            try {
                const result = await getPublicEventPredictions(data.event.id, user.id);

                const mapped = {};

                for (const prediction of result.predictions || []) {
                    mapped[prediction.match_id] = prediction;
                }

                setMyPredictions(mapped);
            } catch (err) {
                console.error(err);
            }
        }

        loadMyPredictions();
    }, [isLoggedIn, user?.id, data?.event?.id]);

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

        function handleScoreUpdated(payload) {
            setData((prev) => {
                if (!prev) return prev;

                setSelectedMatch((prev) => {
                    if (!prev) return prev;

                    if (String(prev.id) !== String(payload.matchId)) {
                        return prev;
                    }

                    return {
                        ...prev,
                        score_a: payload.score_a ?? prev.score_a ?? 0,
                        score_b: payload.score_b ?? prev.score_b ?? 0,
                        current_map: payload.current_map || prev.current_map || 1,
                        live_status: payload.live_status || prev.live_status || 'LIVE',
                        ui_status:
                            payload.ui_status ||
                            (payload.live_status === 'FINAL' ? 'FINAL' : 'LIVE'),
                        just_updated: true
                    };
                });

                const updateMatch = (match) => {
                    if (String(match.id) !== String(payload.matchId)) {
                        return match;
                    }

                    return {
                        ...match,
                        score_a: payload.score_a ?? match.score_a ?? 0,
                        score_b: payload.score_b ?? match.score_b ?? 0,
                        current_map: payload.current_map || match.current_map || 1,
                        live_status: payload.live_status || match.live_status || 'LIVE',
                        ui_status:
                            payload.ui_status ||
                            (payload.live_status === 'FINAL' ? 'FINAL' : 'LIVE'),
                        just_updated: true
                    };
                };

                const updatedMatches = (prev.matches || []).map(updateMatch);

                const featuredMatch =
                    updatedMatches.find((m) => m.ui_status === 'LIVE') ||
                    updatedMatches.find((m) => m.ui_status === 'OPEN') ||
                    updatedMatches[0] ||
                    null;

                return {
                    ...prev,
                    featured_match: featuredMatch,
                    matches: updatedMatches
                };
            });

            setTimeout(() => {
                setData((prev) => {
                    if (!prev) return prev;

                    setSelectedMatch((prev) => {
                        if (!prev) return prev;

                        return {
                            ...prev,
                            just_updated: false
                        };
                    });

                    const clearUpdate = (match) => ({
                        ...match,
                        just_updated: false
                    });

                    return {
                        ...prev,
                        featured_match: prev.featured_match
                            ? clearUpdate(prev.featured_match)
                            : prev.featured_match,
                        matches: (prev.matches || []).map(clearUpdate)
                    };
                });
            }, 2500);
        }

        socket.on('dashboard:refresh', handleDashboardRefresh);
        socket.on('event:status_updated', handleEventStatusUpdated);
        socket.on('match:updated', handleMatchUpdated);
        socket.on('match:score_updated', handleScoreUpdated);

        return () => {
            socket.off('dashboard:refresh', handleDashboardRefresh);
            socket.off('event:status_updated', handleEventStatusUpdated);
            socket.off('match:updated', handleMatchUpdated);
            socket.off('match:score_updated', handleScoreUpdated);
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

    function openPredictionModal(match) {
        setPredictionMatch(match);
    }

    function closePredictionModal() {
        setPredictionMatch(null);
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
            if (showOnlyMyPicks && !myPredictions[match.id]) {
                return false;
            }

            if (matchFilter === 'ALL') return true;

            return match.ui_status === matchFilter;
        })

        .sort((a, b) => {
            const order = {
                LIVE: 0,
                OPEN: 1,
                LOCKED: 2,
                FINAL: 3
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

    const myPredictionsCount = Object.keys(myPredictions).length;

    const totalMatchesCount = data?.matches?.length || 0;

    const myPredictionsProgress =
        totalMatchesCount > 0
            ? Math.round((myPredictionsCount / totalMatchesCount) * 100)
            : 0;

    const missingPredictionsCount = Math.max(
        totalMatchesCount - myPredictionsCount,
        0
    );

    const nextUnpredictedMatch = publicMatches.find(
        (match) =>
            !myPredictions[match.id] &&
            match.ui_status !== 'LOCKED' &&
            match.ui_status !== 'FINAL'
    );

    const latestPrediction = Object.values(myPredictions)[0] || null;

    const finishedMatches = eventMatchStats.filter(
        (match) => match.community_was_right !== null
    );

    const communityCorrect = finishedMatches.filter(
        (match) => match.community_was_right
    ).length;

    const communityAccuracy =
        finishedMatches.length > 0
            ? Math.round(
                (communityCorrect / finishedMatches.length) * 100
            )
            : 0;

    const biggestUpset = finishedMatches
        .filter((match) => match.community_was_right === false)
        .sort((a, b) => {
            const aConfidence = Math.max(
                a.team_a_percentage,
                a.team_b_percentage
            );

            const bConfidence = Math.max(
                b.team_a_percentage,
                b.team_b_percentage
            );

            return bConfidence - aConfidence;
        })[0];

    const mostTrustedPick = finishedMatches
        .filter((match) => match.community_was_right === true)
        .sort((a, b) => {
            const aConfidence = Math.max(
                a.team_a_percentage,
                a.team_b_percentage
            );

            const bConfidence = Math.max(
                b.team_a_percentage,
                b.team_b_percentage
            );

            return bConfidence - aConfidence;
        })[0];

    if (!data) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />
                <div className="relative z-10 mx-auto max-w-7xl">
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
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />
            <div className="relative z-10 mx-auto max-w-7xl">
                <PublicNavbar
                    active="guild"
                    guildSlug={event?.guild_id}
                    eventName={event?.name || slug}
                />
                <PublicEventHero
                    event={event}
                    slug={slug}
                    publicUrl={publicUrl}
                    isLoggedIn={isLoggedIn}
                    totalMatchesCount={totalMatchesCount}
                    missingPredictionsCount={missingPredictionsCount}
                    copyPublicUrl={copyPublicUrl}
                />

                {isLoggedIn && (
                    <PublicLatestPredictionCard
                        latestPrediction={latestPrediction}
                        myPredictionsProgress={myPredictionsProgress}
                    />
                )}

                <PublicEventStatsGrid
                    participants={data?.stats?.participants ?? 0}
                    predictions={data?.stats?.predictions ?? 0}
                    matches={data?.stats?.matches ?? 0}
                    myPicks={myPredictionsCount}
                    liveMatches={liveMatchesCount}
                    communityAccuracy={communityAccuracy}
                />

                <MyPickemProgress
                    myPredictionsCount={myPredictionsCount}
                    totalMatchesCount={totalMatchesCount}
                    missingPredictionsCount={missingPredictionsCount}
                    myPredictionsProgress={myPredictionsProgress}
                />

                <PublicFeaturedMatch
                    heroMatch={heroMatch}
                    myPrediction={heroMatch ? myPredictions[heroMatch.id] : null}
                    nowTick={nowTick}
                    formatPhaseLabel={formatPhaseLabel}
                    formatStatusLabel={formatStatusLabel}
                    getCountdown={getCountdown}
                    openPredictionModal={openPredictionModal}
                    openMatchModal={openMatchModal}
                />

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

                <CommunityPulse
                    liveMatchesCount={liveMatchesCount}
                    totalPredictions={data?.stats?.predictions ?? 0}
                    phase={formatPhaseLabel(event?.phase)}
                    communityAccuracy={communityAccuracy}
                    mostTrustedPick={mostTrustedPick}
                    biggestUpset={biggestUpset}
                />

                <SwissPickemTrends swissStats={swissStats} />

                <CommunityMatchPredictions eventMatchStats={eventMatchStats} />

                <TournamentProgress
                    phase={event?.phase}
                    formatPhaseLabel={formatPhaseLabel}
                    PublicPhaseStep={PublicPhaseStep}
                />

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
                                                <a
                                                    href={`/public/users/${player.user_id}`}
                                                    className="text-xl font-black transition hover:text-violet-300 md:text-2xl"
                                                >
                                                    {player.user_id}
                                                </a>

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

                    <PublicMatchesSection
                        publicMatches={publicMatches}
                        visiblePublicMatches={visiblePublicMatches}
                        heroMatch={heroMatch}
                        nextUnpredictedMatch={nextUnpredictedMatch}
                        myPredictions={myPredictions}
                        showOnlyMyPicks={showOnlyMyPicks}
                        setShowOnlyMyPicks={setShowOnlyMyPicks}
                        matchFilter={matchFilter}
                        setMatchFilter={setMatchFilter}
                        nowTick={nowTick}
                        formatPhaseLabel={formatPhaseLabel}
                        formatStatusLabel={formatStatusLabel}
                        getCountdown={getCountdown}
                        openPredictionModal={openPredictionModal}
                        openMatchModal={openMatchModal}
                    />
                </div>

                <div className="mt-10 grid gap-6 xl:grid-cols-2">
                    <EventLeaderboardPreview
                        slug={slug}
                        eventLeaderboard={eventLeaderboard}
                    />

                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Community Pulse
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            Swiss Stage 1 Trends
                        </h2>

                        <p className="mt-2 text-white/50">
                            Based on {swissStats?.total_predictions || 0} submitted Pick&apos;Ems.
                        </p>

                        <div className="mt-6 grid gap-4">
                            {(swissStats?.stats?.three_zero || []).slice(0, 5).map((row) => (
                                <div
                                    key={row.team}
                                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="font-black">
                                            {row.team}
                                        </p>

                                        <p className="text-sm font-black text-violet-300">
                                            {row.count} picks
                                        </p>
                                    </div>

                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                                        <div
                                            className="h-full rounded-full bg-violet-500"
                                            style={{ width: `${row.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {(!swissStats || (swissStats?.stats?.three_zero || []).length === 0) && (
                                <p className="text-white/50">
                                    No Swiss stats yet.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                {isLoggedIn && (
                    <StickyPickemProgress
                        myPredictionsCount={myPredictionsCount}
                        totalMatchesCount={totalMatchesCount}
                        missingPredictionsCount={missingPredictionsCount}
                        myPredictionsProgress={myPredictionsProgress}
                    />
                )}
                <PublicFooter />

                {
                    selectedMatch && (
                        <MatchModal
                            selectedMatch={selectedMatch}
                            matchModalTab={matchModalTab}
                            setMatchModalTab={setMatchModalTab}
                            matchStats={matchStats}
                            matchStatsLoading={matchStatsLoading}
                            getPickPercent={getPickPercent}
                            closeMatchModal={closeMatchModal}
                            eventMatchStats={eventMatchStats}
                        />

                    )
                }
                {
                    predictionMatch && (
                        <PredictionModal
                            match={predictionMatch}
                            closePredictionModal={closePredictionModal}
                            onPredictionSaved={(prediction) => {
                                setMyPredictions((prev) => ({
                                    ...prev,
                                    [prediction.match_id]: prediction
                                }));
                            }}
                        />
                    )
                }
            </div >
        </div >
    );
}

function MatchModal({
    selectedMatch,
    matchModalTab,
    setMatchModalTab,
    matchStats,
    matchStatsLoading,
    getPickPercent,
    closeMatchModal,
    eventMatchStats
}) {
    const teamAPercent = getPickPercent(selectedMatch.id, 'team_a');
    const teamBPercent = getPickPercent(selectedMatch.id, 'team_b');

    const communityFavorite =
        teamAPercent > teamBPercent
            ? 'team_a'
            : teamBPercent > teamAPercent
                ? 'team_b'
                : null;

    const publicMatchStats = eventMatchStats.find(
        (match) => String(match.match_id) === String(selectedMatch.id)
    );

    const confidence = publicMatchStats
        ? Math.max(
            publicMatchStats.team_a_percentage,
            publicMatchStats.team_b_percentage
        )
        : 0;


    return (
        <div
            onClick={closeMatchModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl animate-in zoom-in-95 duration-200 md:p-8"
            >
                <div className="flex items-start justify-between gap-6">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Match Details
                    </p>

                    <button
                        onClick={closeMatchModal}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-1 items-center gap-10 text-center md:grid-cols-[1fr_auto_1fr]">
                    <div
                        className={
                            selectedMatch.ui_status === 'FINAL'
                                ? Number(selectedMatch.score_a) > Number(selectedMatch.score_b)
                                    ? 'drop-shadow-[0_0_25px_rgba(74,222,128,0.45)]'
                                    : 'opacity-50'
                                : ''
                        }
                    >
                        <TeamLogoBlock team={selectedMatch.team_a} />
                    </div>

                    <div className="text-center">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Matchup
                        </p>

                        <h2 className="mt-2 text-5xl font-black text-violet-300">
                            VS
                        </h2>

                        <p className="mt-3 text-white/50">
                            {formatPhaseLabel(selectedMatch.phase)}
                        </p>
                    </div>

                    <div
                        className={
                            selectedMatch.ui_status === 'FINAL'
                                ? Number(selectedMatch.score_b) > Number(selectedMatch.score_a)
                                    ? 'drop-shadow-[0_0_25px_rgba(74,222,128,0.45)]'
                                    : 'opacity-50'
                                : ''
                        }
                    >
                        <TeamLogoBlock team={selectedMatch.team_b} />
                    </div>
                </div>

                <div
                    className={`mt-6 flex items-center justify-center gap-6 transition-all duration-500 ${selectedMatch.just_updated
                        ? 'scale-110 text-green-300'
                        : 'text-violet-300'
                        }`}
                >
                    <span className="text-6xl font-black">
                        {selectedMatch.score_a ?? 0}
                    </span>

                    <span className="text-2xl font-black text-white/30">
                        :
                    </span>

                    <span className="text-6xl font-black">
                        {selectedMatch.score_b ?? 0}
                    </span>
                </div>

                {selectedMatch.live_status && (
                    <p className="mt-3 text-center text-sm font-black uppercase tracking-[0.2em] text-green-300">
                        {formatStatusLabel(selectedMatch.live_status)} • MAP {selectedMatch.current_map || 1}
                    </p>
                )}

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    <PublicStat title="Phase" value={formatPhaseLabel(selectedMatch.phase)} />
                    <PublicStat title="BO" value={`BO${selectedMatch.best_of || 3}`} />
                    <PublicStat title="Status" value={formatStatusLabel(selectedMatch.ui_status)} />
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
                                            <span className={communityFavorite === 'team_a' ? 'text-violet-300' : ''}>
                                                {selectedMatch.team_a} — {teamAPercent}%
                                            </span>

                                            <span className={communityFavorite === 'team_b' ? 'text-red-300' : ''}>
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

                                {(matchStats[selectedMatch.id]?.series_breakdown || []).length > 0 && (
                                    <div className="mt-8">
                                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                            Series Picks
                                        </p>

                                        <div className="mt-4 grid gap-3">
                                            {matchStats[selectedMatch.id].series_breakdown.map((row) => {
                                                const total = Number(matchStats[selectedMatch.id]?.predictions || 0);
                                                const percent = total > 0
                                                    ? Math.round((Number(row.picks || 0) / total) * 100)
                                                    : 0;

                                                return (
                                                    <div
                                                        key={`${row.pred_a}:${row.pred_b}`}
                                                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                                    >
                                                        <div className="flex items-center justify-between gap-4">
                                                            <p className="font-black">
                                                                {row.label}
                                                            </p>

                                                            <p className="text-sm font-black text-violet-300">
                                                                {row.picks} picks • {percent}%
                                                            </p>
                                                        </div>

                                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                                                            <div
                                                                className="h-full rounded-full bg-violet-500"
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {(matchStats[selectedMatch.id]?.map_breakdown || []).length > 0 && (
                                    <div className="mt-8">
                                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                            Most Picked Map Scores
                                        </p>

                                        <div className="mt-4 grid gap-4">
                                            {matchStats[selectedMatch.id].map_breakdown.map((map) => (
                                                <div
                                                    key={map.map_no}
                                                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                                                >
                                                    <p className="font-black">
                                                        {getMapLabel(map.map_no, selectedMatch.best_of)}
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {(map.scores || []).map((score) => (
                                                            <span
                                                                key={`${map.map_no}-${score.score}`}
                                                                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-black text-white/70"
                                                            >
                                                                {score.score} • {score.picks}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
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
                            Match Analytics
                        </p>

                        {!publicMatchStats && (
                            <p className="mt-3 text-white/50">
                                No public match stats yet.
                            </p>
                        )}

                        {publicMatchStats && (
                            <>
                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <PublicStat
                                        title="Total Picks"
                                        value={publicMatchStats.total_predictions}
                                    />

                                    <PublicStat
                                        title="Community Pick"
                                        value={publicMatchStats.community_pick || '-'}
                                    />

                                    <PublicStat
                                        title="Confidence"
                                        value={`${confidence}%`}
                                    />
                                </div>

                                <div className="mt-6">
                                    <MatchTrendBar
                                        team={publicMatchStats.team_a}
                                        percentage={publicMatchStats.team_a_percentage}
                                        variant="primary"
                                    />

                                    <MatchTrendBar
                                        team={publicMatchStats.team_b}
                                        percentage={publicMatchStats.team_b_percentage}
                                    />
                                </div>

                                {publicMatchStats.winner && (
                                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                                        <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
                                            Community vs Reality
                                        </p>

                                        <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                            <span className="rounded-full bg-violet-500/20 px-3 py-1 font-black text-violet-300">
                                                Community: {publicMatchStats.community_pick}
                                            </span>

                                            <span className="rounded-full bg-white/10 px-3 py-1 font-black text-white/70">
                                                Winner: {publicMatchStats.winner}
                                            </span>

                                            <span
                                                className={`rounded-full px-3 py-1 font-black ${publicMatchStats.community_was_right
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-red-500/20 text-red-300'
                                                    }`}
                                            >
                                                {publicMatchStats.community_was_right
                                                    ? 'Community was right'
                                                    : 'Community was wrong'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {publicMatchStats.top_scores?.length > 0 && (
                                    <div className="mt-6">
                                        <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
                                            Most picked scores
                                        </p>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {publicMatchStats.top_scores.map((scorePick) => (
                                                <span
                                                    key={`${publicMatchStats.match_id}-${scorePick.score}`}
                                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-white/70"
                                                >
                                                    {scorePick.score} • {scorePick.picks} picks
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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

function getRequiredWins(bestOf) {
    const bo = Number(bestOf || 1);

    if (bo === 1) return 1;
    if (bo === 3) return 2;
    if (bo === 5) return 3;

    return 1;
}

function getSeriesOptions(match) {
    const requiredWins = getRequiredWins(match.best_of);

    if (requiredWins === 1) {
        return [
            {
                label: `${match.team_a} 1:0`,
                pred_a: 1,
                pred_b: 0,
                winner: 'team_a'
            },
            {
                label: `${match.team_b} 1:0`,
                pred_a: 0,
                pred_b: 1,
                winner: 'team_b'
            }
        ];
    }

    const options = [];

    for (let loserScore = 0; loserScore < requiredWins; loserScore++) {
        options.push({
            label: `${match.team_a} ${requiredWins}:${loserScore}`,
            pred_a: requiredWins,
            pred_b: loserScore,
            winner: 'team_a'
        });
    }

    for (let loserScore = requiredWins - 1; loserScore >= 0; loserScore--) {
        options.push({
            label: `${match.team_b} ${requiredWins}:${loserScore}`,
            pred_a: loserScore,
            pred_b: requiredWins,
            winner: 'team_b'
        });
    }

    return options;
}

function getMapLabel(mapNo, bestOf) {
    if (Number(bestOf) === 1) return 'BO1';

    if (Number(mapNo) === 1) return 'Pick Team A';
    if (Number(mapNo) === 2) return 'Pick Team B';
    if (Number(mapNo) === 3) return 'Decider';

    return `Map ${mapNo}`;
}

function formatPredictionSummary(prediction) {
    if (!prediction) return null;

    if (prediction.series) {
        return `${prediction.series.pred_a}:${prediction.series.pred_b}`;
    }

    if (prediction.score_a != null && prediction.score_b != null) {
        return `${prediction.score_a}:${prediction.score_b}`;
    }

    return 'Saved';
}

function getMapsToPredict(match, series) {
    const bestOf = Number(match.best_of || 1);

    if (bestOf === 1) return [1];

    if (!series) return [];

    return Math.max(Number(series.pred_a), Number(series.pred_b));
}

function PredictionModal({ match, closePredictionModal, onPredictionSaved }) {
    const { isLoggedIn, user } = usePublicAuth();

    const predictionClosed =
        match.ui_status === 'LOCKED' ||
        match.ui_status === 'FINAL';

    const [selectedSeries, setSelectedSeries] = useState(null);
    const [mapScores, setMapScores] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const seriesOptions = getSeriesOptions(match);
    const mapsToPredict = getMapsToPredict(match, selectedSeries);

    function resetFeedback() {
        setError(null);
        setSuccess(false);
    }

    function updateMapScore(mapNo, side, value) {
        resetFeedback();

        setMapScores((prev) => ({
            ...prev,
            [mapNo]: {
                ...(prev[mapNo] || {}),
                [side]: value
            }
        }));
    }

    useEffect(() => {
        async function loadPrediction() {
            if (!isLoggedIn || !user?.id) return;

            try {
                const result = await getPublicPrediction(match.id, user.id);

                if (!result.prediction) return;

                setSelectedSeries(result.prediction.series || null);

                const mapped = {};

                for (const map of result.prediction.maps || []) {
                    mapped[map.map_no] = {
                        pred_exact_a: String(map.pred_exact_a ?? ''),
                        pred_exact_b: String(map.pred_exact_b ?? '')
                    };
                }

                setMapScores(mapped);
            } catch (err) {
                console.error(err);
            }
        }

        loadPrediction();
    }, [match.id, isLoggedIn, user?.id]);

    const mapsValid =
        selectedSeries &&
        mapsToPredict.length > 0 &&
        mapsToPredict.every((mapNo) => {
            const score = mapScores[mapNo];

            const a = Number(score?.pred_exact_a);
            const b = Number(score?.pred_exact_b);

            return (
                score?.pred_exact_a !== '' &&
                score?.pred_exact_b !== '' &&
                Number.isInteger(a) &&
                Number.isInteger(b) &&
                a >= 0 &&
                b >= 0 &&
                a !== b
            );
        });

    const canSubmit =
        !predictionClosed &&
        isLoggedIn &&
        selectedSeries &&
        mapsValid;

    async function handleSavePrediction() {
        if (!canSubmit) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            const maps = mapsToPredict.map((mapNo) => ({
                map_no: mapNo,
                pred_exact_a: Number(mapScores[mapNo].pred_exact_a),
                pred_exact_b: Number(mapScores[mapNo].pred_exact_b)
            }));

            const result = await savePublicPrediction(match.id, {
                series: {
                    pred_a: selectedSeries.pred_a,
                    pred_b: selectedSeries.pred_b
                },
                maps
            });

            onPredictionSaved?.(result.prediction);

            setSuccess(true);

            setTimeout(() => {
                closePredictionModal();
            }, 900);
        } catch (err) {
            console.error(err);

            setError(
                err?.message ||
                err?.error ||
                'Failed to save prediction.'
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            onClick={closePredictionModal}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl md:p-8"
            >
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Make Prediction
                        </p>

                        <h2 className="mt-3 text-3xl font-black">
                            {match.team_a} vs {match.team_b}
                        </h2>

                        <p className="mt-2 text-white/40">
                            {formatPhaseLabel(match.phase)} • BO{match.best_of || 1}
                        </p>
                    </div>

                    <button
                        onClick={closePredictionModal}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Close
                    </button>
                </div>

                {predictionClosed && (
                    <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">
                            Prediction Closed
                        </p>

                        <p className="mt-2 text-white/60">
                            This match is already locked or finished.
                        </p>
                    </div>
                )}

                {!isLoggedIn && (
                    <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                            Login Required
                        </p>

                        <p className="mt-2 text-white/60">
                            Sign in with Discord to save your prediction.
                        </p>

                        <a
                            href="/api/auth/discord"
                            className="mt-4 inline-flex rounded-xl bg-violet-500 px-4 py-3 text-sm font-black transition hover:bg-violet-400"
                        >
                            Login Discord
                        </a>
                    </div>
                )}

                <div className="mt-8 rounded-[2rem] border border-white/10 bg-black/30 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        1. Series Result
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {seriesOptions.map((option) => {
                            const active =
                                selectedSeries?.pred_a === option.pred_a &&
                                selectedSeries?.pred_b === option.pred_b;

                            return (
                                <button
                                    key={`${option.pred_a}:${option.pred_b}`}
                                    onClick={() => {
                                        setSelectedSeries(option);
                                        setMapScores({});
                                        resetFeedback();
                                    }}
                                    className={`rounded-2xl border p-5 text-left transition ${active
                                        ? 'border-violet-400 bg-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.18)]'
                                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                        Pick
                                    </p>

                                    <h3 className="mt-2 text-2xl font-black">
                                        {option.label}
                                    </h3>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/30 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        2. Map Scores
                    </p>

                    {!selectedSeries && (
                        <p className="mt-4 text-white/50">
                            Select series result first.
                        </p>
                    )}

                    {selectedSeries && (
                        <div className="mt-5 grid gap-4">
                            {mapsToPredict.map((mapNo) => {
                                const score = mapScores[mapNo] || {};

                                return (
                                    <div
                                        key={mapNo}
                                        className="rounded-2xl border border-white/10 bg-white/5 p-5"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                                                    Map {mapNo}
                                                </p>

                                                <h3 className="mt-1 text-xl font-black">
                                                    {getMapLabel(mapNo, match.best_of)}
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <input
                                                    value={score.pred_exact_a || ''}
                                                    onChange={(e) =>
                                                        updateMapScore(
                                                            mapNo,
                                                            'pred_exact_a',
                                                            e.target.value
                                                        )
                                                    }
                                                    type="number"
                                                    min="0"
                                                    max="99"
                                                    placeholder="13"
                                                    className="w-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center text-2xl font-black outline-none focus:border-violet-400"
                                                />

                                                <span className="text-2xl font-black text-white/30">
                                                    :
                                                </span>

                                                <input
                                                    value={score.pred_exact_b || ''}
                                                    onChange={(e) =>
                                                        updateMapScore(
                                                            mapNo,
                                                            'pred_exact_b',
                                                            e.target.value
                                                        )
                                                    }
                                                    type="number"
                                                    min="0"
                                                    max="99"
                                                    placeholder="10"
                                                    className="w-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center text-2xl font-black outline-none focus:border-violet-400"
                                                />
                                            </div>
                                        </div>

                                        <p className="mt-3 text-sm text-white/40">
                                            {match.team_a} : {match.team_b}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {selectedSeries && mapsValid && (
                    <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Your Prediction
                        </p>

                        <p className="mt-2 text-2xl font-black">
                            Series: {selectedSeries.pred_a}:{selectedSeries.pred_b}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {mapsToPredict.map((mapNo) => (
                                <span
                                    key={mapNo}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-white/70"
                                >
                                    {getMapLabel(mapNo, match.best_of)}: {mapScores[mapNo]?.pred_exact_a}:{mapScores[mapNo]?.pred_exact_b}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <p className="mt-4 text-center font-black text-red-300">
                        {error}
                    </p>
                )}

                {success && (
                    <p className="mt-4 text-center font-black text-green-300">
                        Prediction saved!
                    </p>
                )}

                <button
                    onClick={handleSavePrediction}
                    disabled={!canSubmit || saving}
                    className={`mt-8 w-full rounded-2xl px-6 py-4 font-black transition ${canSubmit && !saving
                        ? 'bg-violet-500 hover:bg-violet-400'
                        : 'cursor-not-allowed bg-white/10 text-white/30'
                        }`}
                >
                    {saving
                        ? 'Saving...'
                        : predictionClosed
                            ? 'Prediction Closed'
                            : success
                                ? 'Saved!'
                                : isLoggedIn
                                    ? 'Save Prediction'
                                    : 'Login Required'}
                </button>
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

function PublicSkeletonCard() {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-10 w-20 animate-pulse rounded-xl bg-white/10" />
        </div>
    );
}

function formatPhaseLabel(phase) {
    if (!phase) return '-';

    return phase
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatusLabel(status) {
    if (!status) return '-';

    return status
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatsMiniColumn({ title, rows }) {
    return (
        <div>
            <p className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-violet-300">
                {title}
            </p>

            <div className="space-y-3">
                {rows.map((row) => (
                    <div
                        key={row.team}
                        className="rounded-2xl border border-white/10 bg-black/30 p-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="font-black">
                                {row.team}
                            </span>

                            <span className="text-sm text-violet-300">
                                {row.percentage}%
                            </span>
                        </div>
                    </div>
                ))}

                {rows.length === 0 && (
                    <p className="text-sm text-white/40">
                        No data
                    </p>
                )}
            </div>
        </div>
    );
}

function InsightCard({ title, match, empty }) {
    if (!match) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    {title}
                </p>

                <p className="mt-3 text-white/40">
                    {empty}
                </p>
            </div>
        );
    }

    const confidence = Math.max(
        match.team_a_percentage,
        match.team_b_percentage
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h3 className="mt-3 text-2xl font-black">
                {match.team_a} vs {match.team_b}
            </h3>

            <p className="mt-2 text-white/50">
                Community picked {match.community_pick} with {confidence}% confidence.
            </p>

            <p className="mt-2 text-white/50">
                Winner: {match.winner}
            </p>
        </div>
    );
}

function MatchTrendBar({ team, percentage, variant }) {
    return (
        <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
                <span>{team}</span>
                <span>{percentage}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-black/40">
                <div
                    className={`h-full rounded-full ${variant === 'primary' ? 'bg-violet-500' : 'bg-white/60'
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}