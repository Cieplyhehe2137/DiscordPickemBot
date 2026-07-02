import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getEventSummary,
  getEventMatches,
  getEventLeaderboard,
  updateEventPhase,
  updateEventStatus,
  recalculateEvent,
  updateMatchLock,
  getMatchStats,
  getTeams,
  createMatch,
  submitMatchResult,
  describeActionError
} from '../lib/api';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import { useApp } from '../context/AppContext';
import Skeleton from '../components/ui/Skeleton';
import { socket } from '../lib/socket';
import EventStatusButtons from '../components/admin/EventStatusButtons';
import PublicLinkButtons from '../components/admin/PublicLinkButtons';

export default function EventDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { setSelectedEvent } = useApp();

  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPhase, setSelectedPhase] = useState('');
  const [phaseLoading, setPhaseLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [matchSortBy, setMatchSortBy] = useState('match_no');
  const [matchSearch, setMatchSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState('ALL');
  const [matchStats, setMatchStats] = useState({});
  const [matchStatsLoading, setMatchStatsLoading] = useState({});

  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);
  const [activeTeams, setActiveTeams] = useState([]);
  const [matchForm, setMatchForm] = useState({ phase: 'SWISS', teamA: '', teamB: '', bestOf: 3, startTimeUtc: '' });
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [createMatchError, setCreateMatchError] = useState(null);

  const [resultModalMatch, setResultModalMatch] = useState(null);
  const [resultForm, setResultForm] = useState({ resA: '', resB: '' });
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultError, setResultError] = useState(null);

  const event = data?.event;
  const stats = data?.stats;
  const matchStatus = data?.match_status;
  const nextMatch = data?.next_match;
  const phaseInfo = data?.phase_info;

  const sortedMatches = [...matches]
    .filter((match) => {
      if (
        matchStatusFilter !== 'ALL' &&
        match.ui_status !== matchStatusFilter
      ) {
        return false;
      }

      const query = matchSearch.toLowerCase();

      return (
        match.team_a?.toLowerCase().includes(query) ||
        match.team_b?.toLowerCase().includes(query) ||
        match.phase?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (matchSortBy === 'match_no') {
        return (a.match_no || 0) - (b.match_no || 0);
      }

      if (matchSortBy === 'start_time') {
        return new Date(a.start_time_utc || 0) - new Date(b.start_time_utc || 0);
      }

      if (matchSortBy === 'phase') {
        return (a.phase || '').localeCompare(b.phase || '');
      }

      if (matchSortBy === 'locked') {
        return Number(b.is_locked || 0) - Number(a.is_locked || 0);
      }

      return 0;
    });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const result = await getEventSummary(slug);

        setData(result);
        setSelectedEvent(result.event);
        setSelectedPhase(result?.event?.phase || '');

        const matchesResult = await getEventMatches(slug);
        setMatches(matchesResult.matches || []);

        const leaderboardResult = await getEventLeaderboard(slug);
        setLeaderboard(leaderboardResult.leaderboard || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug, setSelectedEvent]);

  useEffect(() => {
    function handleConnect() {
      console.log('Socket connected:', socket.id);
    }

    function handleDashboardRefresh(payload) {
      console.log('LIVE REFRESH', payload);

      if (payload?.slug !== slug) return;

      refreshEventData();
      console.log('LIVE DASHBOARD UPDATE');
    }

    function handleMatchUpdated(payload) {
      if (payload?.slug !== slug) return;

      setMatches((prev) =>
        prev.map((m) =>
          String(m.id) === String(payload.matchId)
            ? {
              ...m,
              is_locked: payload.locked ? 1 : 0,
              ui_status: payload.locked ? 'LOCKED' : 'OPEN'
            }
            : m
        )
      );
    }

    function handleEventStatusUpdated(payload) {
      if (payload?.slug !== slug) return;

      setData((prev) => ({
        ...prev,
        event: {
          ...prev.event,
          status: payload.status
        },
        phase_info: {
          ...prev.phase_info,
          status: payload.status
        }
      }));
    }

    socket.on('connect', handleConnect);
    socket.on('dashboard:refresh', handleDashboardRefresh);
    socket.on('match:updated', handleMatchUpdated);
    socket.on('event:status_updated', handleEventStatusUpdated);
    

    return () => {
      socket.off('connect', handleConnect);
      socket.off('dashboard:refresh', handleDashboardRefresh);
      socket.off('event:status_updated', handleEventStatusUpdated);
      socket.off('match:updated', handleMatchUpdated);
    };
  }, [slug]);

  async function refreshEventData() {
    const result = await getEventSummary(slug);

    setData(result);
    setSelectedPhase(result?.event?.phase || '');
    setSelectedEvent(result.event);

    const matchesResult = await getEventMatches(slug);
    setMatches(matchesResult.matches || []);

    const leaderboardResult = await getEventLeaderboard(slug);
    setLeaderboard(leaderboardResult.leaderboard || []);
  }

  async function handlePhaseUpdate() {
    try {
      setPhaseLoading(true);

      await updateEventPhase(slug, selectedPhase);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'update the phase'));
    } finally {
      setPhaseLoading(false);
    }
  }

  async function handleStatusUpdate(status) {
    try {
      await updateEventStatus(slug, status);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'update the status'));
    }
  }

  async function handleCloseEvent() {
    await handleStatusUpdate('CLOSED');
  }

  async function handleArchiveEvent() {
    const confirmed = window.confirm(
      `Archive event "${event?.name || slug}"?\n\nThis will hide it from active views, but it will not delete data from the database.`
    );

    if (!confirmed) return;

    await handleStatusUpdate('ARCHIVED');
  }

  async function handleRecalculate() {
    try {
      setRecalculating(true);

      await recalculateEvent(slug);

      alert('Scores recalculated!');
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'recalculate scores'));
    } finally {
      setRecalculating(false);
    }
  }

  async function handleMatchLock(matchId, locked) {
    try {
      await updateMatchLock(matchId, locked);
    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'update the match lock'));
    }
  }

  async function handleBulkMatchLock(locked) {
    const confirmed = window.confirm(
      `${locked ? 'Lock' : 'Unlock'} all visible matches?`
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        sortedMatches.map((match) => updateMatchLock(match.id, locked))
      );

    } catch (err) {
      console.error(err);
      alert(describeActionError(err, 'update match locks'));
    }
  }

  async function openCreateMatchModal() {
    setCreateMatchError(null);
    setMatchForm({ phase: event?.phase || 'SWISS', teamA: '', teamB: '', bestOf: 3, startTimeUtc: '' });
    setShowCreateMatchModal(true);

    try {
      const result = await getTeams(event.guild_id, { includeInactive: false });
      setActiveTeams(result.teams || []);
    } catch (err) {
      console.error(err);
      setActiveTeams([]);
    }
  }

  async function handleCreateMatch() {
    try {
      setCreatingMatch(true);
      setCreateMatchError(null);

      await createMatch(event.guild_id, slug, {
        phase: matchForm.phase,
        teamA: matchForm.teamA,
        teamB: matchForm.teamB,
        bestOf: Number(matchForm.bestOf),
        startTimeUtc: matchForm.startTimeUtc || null
      });

      await refreshEventData();
      setShowCreateMatchModal(false);
    } catch (err) {
      console.error(err);
      setCreateMatchError(err?.status === 400 ? err.message : describeActionError(err, 'create the match'));
    } finally {
      setCreatingMatch(false);
    }
  }

  function openResultModal(match) {
    setResultError(null);
    setResultForm({ resA: '', resB: '' });
    setResultModalMatch(match);
  }

  async function handleSubmitResult() {
    try {
      setSubmittingResult(true);
      setResultError(null);

      const resA = Number(resultForm.resA);
      const resB = Number(resultForm.resB);

      await submitMatchResult(resultModalMatch.id, resA, resB);

      await refreshEventData();
      setResultModalMatch(null);
    } catch (err) {
      console.error(err);
      setResultError(err?.status === 400 ? err.message : describeActionError(err, 'save the result'));
    } finally {
      setSubmittingResult(false);
    }
  }

  async function handleToggleMatchDetails(matchId) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }

    setExpandedMatchId(matchId);

    try {
      setMatchStatsLoading((prev) => ({
        ...prev,
        [matchId]: true
      }));

      const result = await getMatchStats(matchId);

      setMatchStats((prev) => ({
        ...prev,
        [matchId]: result.stats
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setMatchStatsLoading((prev) => ({
        ...prev,
        [matchId]: false
      }));
    }
  }

  return (
    <div>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Breadcrumbs
          items={[
            {
              label: 'Servers',
              to: '/app/guilds'
            },
            {
              label: 'Guild',
              to: `/app/guilds/${event?.guild_id || ''}`
            },
            {
              label: event?.name || slug
            }
          ]}
        />

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
            Event Dashboard
          </p>

          <h1 className="mt-2 text-5xl font-black">
            {event?.name || slug}
          </h1>

          <div className="mt-4">
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

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            <InfoPill label="Phase" value={event?.phase || '-'} />
            <InfoPill label="Status" value={event?.status || '-'} />
            <InfoPill label="Participants" value={stats?.participants ?? 0} />
            <InfoPill label="Matches" value={stats?.matches ?? 0} />
            <InfoPill label="Predictions" value={stats?.predictions ?? 0} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <PublicLinkButtons eventSlug={slug} size="sm" />

            <EventStatusButtons
              status={event?.status}
              onOpen={() => handleStatusUpdate('OPEN')}
              onClose={() => handleStatusUpdate('CLOSED')}
              onArchive={handleArchiveEvent}
              size="md"
            />

            <button
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/70 transition hover:bg-white/10"
            >
              Back
            </button>
          </div>
        </div>

        {loading && (
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>

            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid gap-6 lg:grid-cols-4">
              <Panel title="Participants" value={stats?.participants ?? 0} />
              <Panel title="Predictions" value={stats?.predictions ?? 0} />
              <Panel title="Matches" value={stats?.matches ?? 0} />
              <Panel title="Current Phase" value={event?.phase || '-'} />
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <StatusCard title="LIVE" value={matchStatus?.live ?? 0} />
              <StatusCard title="LOCKED" value={matchStatus?.locked ?? 0} />
              <StatusCard title="SCHEDULED" value={matchStatus?.scheduled ?? 0} />
            </div>

            {nextMatch && (
              <div className="mt-10 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                  Next Match
                </p>

                <h2 className="mt-3 text-4xl font-black">
                  {nextMatch.team_a} vs {nextMatch.team_b}
                </h2>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <InfoMini label="Phase" value={nextMatch.phase || '-'} />
                  <InfoMini label="BO" value={`BO${nextMatch.best_of || 3}`} />
                  <InfoMini label="Start UTC" value={nextMatch.start_time_utc || '-'} />
                </div>
              </div>
            )}

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Tournament Progress
                  </p>

                  <h2 className="mt-2 text-4xl font-black">
                    {phaseInfo?.current || 'UNKNOWN'}
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-3">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Status
                  </p>

                  <p className="mt-1 text-xl font-black text-green-300">
                    {phaseInfo?.status || 'UNKNOWN'}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <PhaseStep active={phaseInfo?.current === 'PLAY_IN'} label="Play-In" />
                <PhaseStep active={phaseInfo?.current === 'SWISS'} label="Swiss" />
                <PhaseStep active={phaseInfo?.current === 'PLAYOFFS'} label="Playoffs" />
                <PhaseStep active={phaseInfo?.current === 'FINISHED'} label="Finished" />
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Admin Controls
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Event Management
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                >
                  {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
                </button>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-white/50">
                    Change Phase
                  </p>

                  <select
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none"
                  >
                    <option value="NOT_STARTED">NOT_STARTED</option>
                    <option value="PLAY_IN">PLAY_IN</option>
                    <option value="SWISS">SWISS</option>
                    <option value="PLAYOFFS">PLAYOFFS</option>
                    <option value="FINISHED">FINISHED</option>
                  </select>

                  <button
                    onClick={handlePhaseUpdate}
                    disabled={phaseLoading}
                    className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 font-black transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {phaseLoading ? 'Saving...' : 'Save Phase'}
                  </button>
                </div>

                <button
                  onClick={handleCloseEvent}
                  disabled={event?.status === 'CLOSED'}
                  className="rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-4 font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Close Event
                </button>
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Match Overview
              </h2>

              <p className="mt-4 text-white/60">
                Event ID: {event?.id}
              </p>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-3xl font-black">
                  Matches
                </h2>

                <button
                  onClick={openCreateMatchModal}
                  className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                >
                  Create Match
                </button>
              </div>

              <div className="sticky top-4 z-20 mt-6 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-xl">
                <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                  <input
                    value={matchSearch}
                    onChange={(e) => setMatchSearch(e.target.value)}
                    placeholder="Search matches..."
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  />

                  <select
                    value={matchSortBy}
                    onChange={(e) => setMatchSortBy(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                  >
                    <option value="match_no">Sort by Match No</option>
                    <option value="start_time">Sort by Start Time</option>
                    <option value="phase">Sort by Phase</option>
                    <option value="locked">Locked first</option>
                  </select>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {['ALL', 'LIVE', 'LOCKED', 'SCHEDULED'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setMatchStatusFilter(status)}
                      className={`rounded-2xl px-5 py-3 text-sm font-black transition ${matchStatusFilter === status
                        ? 'bg-violet-500 text-white'
                        : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="mt-4 text-sm font-bold text-white/40">
                  Showing {sortedMatches.length} of {matches.length} matches
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleBulkMatchLock(true)}
                    disabled={sortedMatches.length === 0}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Lock Visible
                  </button>

                  <button
                    onClick={() => handleBulkMatchLock(false)}
                    disabled={sortedMatches.length === 0}
                    className="rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-3 text-sm font-black text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Unlock Visible
                  </button>

                  <button
                    onClick={() => {
                      setMatchSearch('');
                      setMatchSortBy('match_no');
                      setMatchStatusFilter('ALL');
                    }}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {sortedMatches.length === 0 && (
                  <p className="text-white/50">
                    {matches.length === 0
                      ? 'No matches found for this event.'
                      : 'No matches match your current filters.'}
                  </p>
                )}

                {sortedMatches.map((match) => {
                  const predictions = matchStats[match.id]?.predictions || 0;
                  const teamAPicks = matchStats[match.id]?.team_a_picks || 0;
                  const teamBPicks = matchStats[match.id]?.team_b_picks || 0;

                  const teamAPercent = predictions
                    ? Math.round((teamAPicks / predictions) * 100)
                    : 0;

                  const teamBPercent = predictions
                    ? Math.round((teamBPicks / predictions) * 100)
                    : 0;

                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-6">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                            {match.phase || 'Match'}
                          </p>

                          <h3 className="mt-2 text-2xl font-black">
                            {match.team_a} vs {match.team_b}
                          </h3>
                        </div>

                        <div className="text-right">
                          <div
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${match.ui_status === 'LIVE'
                              ? 'bg-green-500/20 text-green-300'
                              : match.ui_status === 'LOCKED'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                              }`}
                          >
                            {match.ui_status}
                          </div>

                          <p className="mt-2 text-sm text-white/40">
                            {match.start_time_utc
                              ? new Date(match.start_time_utc).toLocaleString()
                              : 'No date'}
                          </p>

                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => handleToggleMatchDetails(match.id)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/70 transition hover:bg-white/10"
                            >
                              {expandedMatchId === match.id ? 'Hide' : 'Open'}
                            </button>

                            <button
                              onClick={() => handleMatchLock(match.id, match.ui_status !== 'LOCKED')}
                              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20"
                            >
                              {match.ui_status === 'LOCKED' ? 'Unlock' : 'Lock'}
                            </button>

                            <button
                              onClick={() => openResultModal(match)}
                              className="rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                              Enter Result
                            </button>
                          </div>
                        </div>
                      </div>

                      {expandedMatchId === match.id && (
                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Match Details
                          </p>

                          {matchStatsLoading[match.id] && (
                            <p className="mt-4 text-sm font-bold text-white/40">
                              Loading match stats...
                            </p>
                          )}

                          <div className="mt-4 grid gap-4 md:grid-cols-9">
                            <InfoMini label="Match ID" value={match.id} />
                            <InfoMini label="Phase" value={match.phase || '-'} />
                            <InfoMini label="BO" value={`BO${match.best_of || 3}`} />
                            <InfoMini
                              label="Locked"
                              value={match.is_locked ? 'YES' : 'NO'}
                            />
                            <InfoMini label="Predictions" value={predictions} />
                            <InfoMini label={match.team_a} value={teamAPicks} />
                            <InfoMini label={match.team_b} value={teamBPicks} />
                            <InfoMini label={`${match.team_a} %`} value={`${teamAPercent}%`} />
                            <InfoMini label={`${match.team_b} %`} value={`${teamBPercent}%`} />
                          </div>

                          {predictions > 0 && (
                            <div className="mt-6">
                              <div className="flex items-center justify-between text-sm font-bold text-white/50">
                                <span>
                                  {match.team_a} — {teamAPercent}%
                                </span>

                                <span>
                                  {match.team_b} — {teamBPercent}%
                                </span>
                              </div>

                              <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="bg-violet-500"
                                  style={{
                                    width: `${teamAPercent}%`
                                  }}
                                />

                                <div
                                  className="bg-red-500"
                                  style={{
                                    width: `${teamBPercent}%`
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Leaderboard
              </h2>

              <div className="mt-6 grid gap-4">
                {leaderboard.length === 0 && (
                  <p className="text-white/50">
                    No leaderboard data.
                  </p>
                )}

                {leaderboard.map((user, index) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-xl font-black">
                        #{index + 1}
                      </div>

                      <div>
                        <h3 className="text-2xl font-black">
                          {user.username || user.user_id}
                        </h3>

                        <p className="text-sm text-white/40">
                          Pick&apos;Em Player
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-black text-green-300">
                        {user.total_points}
                      </p>

                      <p className="text-sm text-white/40">
                        points
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {showCreateMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
              Create Match
            </p>

            <h2 className="mt-2 text-3xl font-black">
              New Match
            </h2>

            <div className="mt-8 grid gap-5">
              <div>
                <label className="text-sm font-bold text-white/60">Phase</label>
                <select
                  value={matchForm.phase}
                  onChange={(e) => setMatchForm((f) => ({ ...f, phase: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                >
                  <option value="PLAY_IN">PLAY_IN</option>
                  <option value="SWISS">SWISS</option>
                  <option value="PLAYOFFS">PLAYOFFS</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-white/60">Team A</label>
                  <select
                    value={matchForm.teamA}
                    onChange={(e) => setMatchForm((f) => ({ ...f, teamA: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="">Select team...</option>
                    {activeTeams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-white/60">Team B</label>
                  <select
                    value={matchForm.teamB}
                    onChange={(e) => setMatchForm((f) => ({ ...f, teamB: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="">Select team...</option>
                    {activeTeams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-white/60">Best of</label>
                  <select
                    value={matchForm.bestOf}
                    onChange={(e) => setMatchForm((f) => ({ ...f, bestOf: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  >
                    <option value={1}>BO1</option>
                    <option value={3}>BO3</option>
                    <option value={5}>BO5</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-bold text-white/60">Start Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={matchForm.startTimeUtc}
                    onChange={(e) => setMatchForm((f) => ({ ...f, startTimeUtc: e.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                  />
                </div>
              </div>
            </div>

            {createMatchError && (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                {createMatchError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setShowCreateMatchModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateMatch}
                disabled={creatingMatch || !matchForm.teamA || !matchForm.teamB || matchForm.teamA === matchForm.teamB}
                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
              >
                {creatingMatch ? 'Creating...' : 'Create Match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resultModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
              Enter Result
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {resultModalMatch.team_a} vs {resultModalMatch.team_b}
            </h2>

            <div className="mt-8 grid grid-cols-2 gap-5">
              <div>
                <label className="text-sm font-bold text-white/60">{resultModalMatch.team_a}</label>
                <input
                  type="number"
                  min="0"
                  value={resultForm.resA}
                  onChange={(e) => setResultForm((f) => ({ ...f, resA: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-white/60">{resultModalMatch.team_b}</label>
                <input
                  type="number"
                  min="0"
                  value={resultForm.resB}
                  onChange={(e) => setResultForm((f) => ({ ...f, resB: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                />
              </div>
            </div>

            <p className="mt-4 text-sm text-white/40">
              Saving recalculates points for all predictions on this match.
            </p>

            {resultError && (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                {resultError}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-4">
              <button
                onClick={() => setResultModalMatch(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmitResult}
                disabled={submittingResult || resultForm.resA === '' || resultForm.resB === ''}
                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
              >
                {submittingResult ? 'Saving...' : 'Save Result'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, value }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
        {title}
      </p>

      <h2 className="mt-4 text-4xl font-black">
        {value}
      </h2>
    </div>
  );
}

function StatusCard({ title, value }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
      <p className="text-sm uppercase tracking-[0.2em] text-white/50">
        {title}
      </p>

      <h2 className="mt-4 text-5xl font-black">
        {value}
      </h2>
    </div>
  );
}

function InfoMini({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <p className="mt-2 text-lg font-black">
        {value}
      </p>
    </div>
  );
}

function PhaseStep({ label, active }) {
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

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <h3 className="mt-2 text-2xl font-black">
        {value}
      </h3>
    </div>
  );
}