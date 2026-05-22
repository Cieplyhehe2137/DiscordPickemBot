import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getEventSummary,
  getEventMatches,
  getEventLeaderboard,
  updateEventPhase,
  updateEventStatus
} from '../lib/api';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import { useApp } from '../context/AppContext';
import Skeleton from '../components/ui/Skeleton';


export default function EventDashboard() {
  const { slug } = useParams();

  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [phaseLoading, setPhaseLoading] = useState(false);
  const { setSelectedEvent } = useApp();

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
  }, [slug]);

  async function handlePhaseUpdate() {
    try {
      setPhaseLoading(true);

      await updateEventPhase(slug, selectedPhase);

      const refreshed = await getEventSummary(slug);

      setData(refreshed);
    } catch (err) {
      console.error(err);
    } finally {
      setPhaseLoading(false);
    }
  }

  async function handleCloseEvent() {
    try {
      await updateEventStatus(slug, 'closed');

      const refreshed = await getEventSummary(slug);
      setData(refreshed);
    } catch (err) {
      console.error(err);
    }
  }

  const event = data?.event;
  const stats = data?.stats;
  const matchStatus = data?.match_status;
  const nextMatch = data?.next_match;
  const phaseInfo = data?.phase_info;

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

        <div className="mb-10"></div>

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
            Event Dashboard
          </p>

          <h1 className="mt-2 text-5xl font-black">
            {event?.name || slug}
          </h1>
        </div>
        {loading && (
          <div className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-40"
                />
              ))}
            </div>

            <Skeleton className="h-64" />

            <Skeleton className="h-96" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* STATS */}
            <div className="grid gap-6 lg:grid-cols-4">
              <Panel
                title="Participants"
                value={stats?.participants ?? 0}
              />

              <Panel
                title="Predictions"
                value={stats?.predictions ?? 0}
              />

              <Panel
                title="Matches"
                value={stats?.matches ?? 0}
              />

              <Panel
                title="Current Phase"
                value={event?.phase || '-'}
              />
            </div>

            {/* MATCH STATUS */}
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <StatusCard
                title="LIVE"
                value={matchStatus?.live ?? 0}
              />

              <StatusCard
                title="LOCKED"
                value={matchStatus?.locked ?? 0}
              />

              <StatusCard
                title="SCHEDULED"
                value={matchStatus?.scheduled ?? 0}
              />
            </div>

            {/* NEXT MATCH */}
            {nextMatch && (
              <div className="mt-10 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                  Next Match
                </p>

                <h2 className="mt-3 text-4xl font-black">
                  {nextMatch.team_a} vs {nextMatch.team_b}
                </h2>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <InfoMini
                    label="Phase"
                    value={nextMatch.phase || '-'}
                  />

                  <InfoMini
                    label="BO"
                    value={`BO${nextMatch.best_of || 3}`}
                  />

                  <InfoMini
                    label="Start UTC"
                    value={nextMatch.start_time_utc || '-'}
                  />
                </div>
              </div>
            )}

            {/* TOURNAMENT PROGRESS */}
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
                <PhaseStep
                  active={phaseInfo?.current === 'PLAY_IN'}
                  label="Play-In"
                />

                <PhaseStep
                  active={phaseInfo?.current === 'SWISS'}
                  label="Swiss"
                />

                <PhaseStep
                  active={phaseInfo?.current === 'PLAYOFFS'}
                  label="Playoffs"
                />

                <PhaseStep
                  active={phaseInfo?.current === 'FINISHED'}
                  label="Finished"
                />
              </div>
            </div>

            {/* ADMIN CONTROLS */}
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Admin Controls
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Event Management
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <button className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400">
                  Recalculate Scores
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
                  className="rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-4 font-black text-red-300 transition hover:bg-red-500/20"
                >
                  Close Event
                </button>
              </div>
            </div>

            {/* OVERVIEW */}
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Match Overview
              </h2>

              <p className="mt-4 text-white/60">
                Event ID: {event?.id}
              </p>
            </div>

            {/* MATCHES */}
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <h2 className="text-3xl font-black">
                Matches
              </h2>

              <div className="mt-6 grid gap-4">
                {matches.length === 0 && (
                  <p className="text-white/50">
                    No matches found for this event.
                  </p>
                )}

                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
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
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em]
                        ${match.ui_status === 'LOCKED'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-green-500/20 text-green-300'
                          }`}
                      >
                        {match.ui_status}
                      </div>

                      <p className="mt-2 text-sm text-white/40">
                        {match.start_time_utc || 'No date'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* LEADERBOARD */}
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