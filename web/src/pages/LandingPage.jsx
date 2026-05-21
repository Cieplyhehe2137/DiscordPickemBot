import { motion } from 'framer-motion';
import {
  Trophy,
  Users,
  Flame,
  BarChart3
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getActiveEvents, getMe } from '../lib/api';

export default function LandingPage() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);

        const [meData, eventsData] = await Promise.all([
          getMe(),
          getActiveEvents()
        ]);

        setUser(meData.user || meData);
        setEvents(Array.isArray(eventsData) ? eventsData : eventsData.events || []);
      } catch (err) {
        console.error(err);
        setApiError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const activeEvent = events[0];
  return (
    <div className="min-h-screen overflow-hidden text-white">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-black tracking-widest">
              HYPERLAND
            </h1>
          </div>

          <nav className="hidden gap-6 text-sm text-white/70 md:flex">
            <a href="#" className="hover:text-white">
              Home
            </a>
            <a href="#" className="hover:text-white">
              Leaderboard
            </a>
            <a href="#" className="hover:text-white">
              Stats
            </a>
            <a href="#" className="hover:text-white">
              Pick&apos;Em
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <main className="relative px-6"
      >
        <section className="mx-auto grid min-h-[90vh] max-w-7xl items-center gap-14 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          {loading && (
            <div className="mx-auto mt-6 max-w-7xl rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
              Ładowanie danych z API...
            </div>
          )}

          {apiError && (
            <div className="mx-auto mt-6 max-w-7xl rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200">
              API error: {apiError}
            </div>
          )}
          {/* LEFT */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="mb-5 inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-5 py-2 text-sm font-bold text-violet-200">
                {activeEvent?.name || 'Brak aktywnego eventu'}
              </p>
            </motion.div>

            <motion.h1
              className="max-w-5xl text-6xl font-black leading-[0.95] tracking-tight md:text-8xl"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Predict.
              <br />
              Compete.
              <br />
              <span className="bg-gradient-to-r from-violet-300 via-white to-blue-300 bg-clip-text text-transparent">
                Climb.
              </span>
            </motion.h1>

            <motion.p
              className="mt-8 max-w-2xl text-lg leading-8 text-white/60"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Typuj mecze, walcz o TOP1 leaderboardu i pokaż całemu
              Hyperlandowi, kto naprawdę zna się na Counter-Strike&apos;u.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button className="rounded-2xl bg-violet-500 px-8 py-4 text-lg font-black shadow-[0_0_40px_rgba(139,92,246,0.45)] transition hover:scale-105 hover:bg-violet-400">
                Join Pick&apos;Em
              </button>

              <button className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-bold text-white/80 backdrop-blur-xl transition hover:bg-white/10">
                View Leaderboard
              </button>
            </motion.div>
          </div>

          {/* RIGHT */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur-2xl">
              <div className="rounded-[1.5rem] bg-black/40 p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/50">
                      Active Event
                    </p>

                    <h2 className="text-3xl font-black">
                      {activeEvent?.name ? `${activeEvent.name} Pick'Em` : 'Hyperland Pick&apos;Em'}
                    </h2>
                  </div>

                  <div className="rounded-2xl bg-green-500/15 px-4 py-2 text-sm font-black text-green-300">
                    LIVE
                  </div>
                </div>

                <div className="grid gap-4">
                  <StatCard
                    icon={<Users />}
                    label="Participants"
                    value="124"
                  />

                  <StatCard
                    icon={<Trophy />}
                    label="Predictions"
                    value="98"
                  />

                  <StatCard
                    icon={<Flame />}
                    label="Most Picked Winner"
                    value="Vitality"
                  />

                  <StatCard
                    icon={<BarChart3 />}
                    label="Biggest Upset"
                    value="The MongolZ"
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
                  <p className="text-sm font-bold text-violet-200">
                    {activeEvent?.phase || 'Waiting for event'}
                  </p>

                  <p className="mt-2 text-4xl font-black">
                    5d 14h 22m
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    Deadline for predictions
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
        {/* LIVE MATCHES */}
        <section className="mx-auto max-w-7xl pb-20">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                Live Matches
              </p>

              <h2 className="mt-2 text-4xl font-black">
                Ongoing Predictions
              </h2>
            </div>

            <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white/70 backdrop-blur-xl hover:bg-white/10">
              View All
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <MatchCard
              teamA="FaZe"
              teamB="Spirit"
              score="1 : 0"
              viewers="72% picked Spirit"
              time="LIVE"
            />

            <MatchCard
              teamA="Vitality"
              teamB="NAVI"
              score="0 : 0"
              viewers="58% picked Vitality"
              time="18:00"
            />

            <MatchCard
              teamA="G2"
              teamB="MOUZ"
              score="2 : 1"
              viewers="64% picked G2"
              time="FINISHED"
            />
          </div>
        </section>

        {/* LEADERBOARD */}
        <section className="mx-auto max-w-7xl pb-24">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
              Leaderboard
            </p>

            <h2 className="mt-2 text-4xl font-black">
              Top Players
            </h2>
          </div>

          <div className="grid gap-4">
            <LeaderboardCard
              place="#1"
              user="niko1337"
              points="128"
              streak="12"
            />

            <LeaderboardCard
              place="#2"
              user="lukasz"
              points="121"
              streak="9"
            />

            <LeaderboardCard
              place="#3"
              user="gilu"
              points="117"
              streak="7"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
      <div className="flex items-center gap-3 text-white/60">
        {icon}
        <span>{label}</span>
      </div>

      <strong className="text-xl">{value}</strong>
    </div>
  );
}

function MatchCard({
  teamA,
  teamB,
  score,
  viewers,
  time
}) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-300">
          {time}
        </span>

        <span className="text-sm text-white/40">
          BO3
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black">
            {teamA}
          </span>

          <span className="text-xl text-white/40">
            {score.split(':')[0]}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-2xl font-black">
            {teamB}
          </span>

          <span className="text-xl text-white/40">
            {score.split(':')[1]}
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm text-white/60">
        🔥 {viewers}
      </div>
    </motion.div>
  );
}

function LeaderboardCard({
  place,
  user,
  points,
  streak
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/20 text-2xl font-black">
          {place}
        </div>

        <div>
          <h3 className="text-2xl font-black">
            {user}
          </h3>

          <p className="mt-1 text-sm text-white/50">
            🔥 {streak} correct streak
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-3xl font-black text-green-300">
          {points}
        </p>

        <p className="text-sm text-white/40">
          points
        </p>
      </div>
    </motion.div>
  );
}