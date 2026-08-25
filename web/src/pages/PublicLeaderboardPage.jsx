import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getPublicLeaderboard } from "../lib/api";
import PublicFooter from "../components/public/PublicFooter";
import PublicAuthButton from "../components/public/PublicAuthButton";
import EmptyState from "../components/ui/EmptyState";

export default function PublicLeaderboardPage() {
  const [data, setData] = useState(null);
  const [sort, setSort] = useState("POINTS");

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const result = await getPublicLeaderboard();
        setData(result);
      } catch (err) {
        console.error(err);
      }
    }

    loadLeaderboard();
  }, []);

  if (!data) {
    return (
      <PageShell>
        <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-10 h-96 animate-pulse rounded-[2rem] bg-white/10" />
      </PageShell>
    );
  }

  const leaderboard = [...(data.leaderboard || [])].sort((a, b) => {
    if (sort === "ACCURACY") {
      return b.accuracy - a.accuracy;
    }

    if (sort === "EXACT") {
      return b.exact_scores - a.exact_scores;
    }

    if (sort === "PREDICTIONS") {
      return b.total_predictions - a.total_predictions;
    }

    return b.total_points - a.total_points;
  });

  return (
    <PageShell>
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Publiczne rankingi
      </p>

      <h1 className="mt-3 text-4xl font-black md:text-6xl">Ranking graczy</h1>

      <p className="mt-4 max-w-2xl text-white/50">
        Śledź najlepszych graczy Pick&apos;Em pod względem punktów, skuteczności
        i dokładnych trafień.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {[
          ["POINTS", "Punkty"],
          ["ACCURACY", "Skuteczność"],
          ["EXACT", "Dokładne trafienia"],
          ["PREDICTIONS", "Typy"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSort(value)}
            className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
              sort === value
                ? "bg-violet-500 text-white"
                : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          Najlepsi gracze
        </p>

        <div className="mt-6 grid gap-4">
          {leaderboard.map((player, index) => (
            <Link
              key={player.user_id}
              to={`/public/users/${player.user_id}`}
              className={`rounded-2xl border p-5 transition hover:scale-[1.01] ${
                index === 0
                  ? "border-yellow-400/30 bg-yellow-500/10"
                  : index === 1
                    ? "border-zinc-300/20 bg-zinc-400/10"
                    : index === 2
                      ? "border-orange-400/20 bg-orange-500/10"
                      : "border-white/10 bg-black/30 hover:border-violet-400/30 hover:bg-violet-500/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black ${
                      index === 0
                        ? "bg-yellow-400/20 text-yellow-200"
                        : index === 1
                          ? "bg-zinc-300/20 text-zinc-100"
                          : index === 2
                            ? "bg-orange-400/20 text-orange-200"
                            : "bg-violet-500/20 text-violet-200"
                    }`}
                  >
                    {index === 0
                      ? "👑"
                      : index === 1
                        ? "🥈"
                        : index === 2
                          ? "🥉"
                          : `#${index + 1}`}
                  </div>

                  <div>
                    <h3 className="break-all text-xl font-black md:text-2xl">
                      {player.user_id}
                    </h3>

                    <p className="mt-1 text-sm text-white/40">
                      {player.total_predictions} typów
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat title="Punkty" value={player.total_points} />
                  <MiniStat title="Skuteczność" value={`${player.accuracy}%`} />
                  <MiniStat title="Dokładne" value={player.exact_scores} />
                  <MiniStat title="Trafione" value={player.correct_winners} />
                </div>
              </div>
            </Link>
          ))}

          {leaderboard.length === 0 && (
            <EmptyState
              icon={Trophy}
              title="Brak jeszcze danych rankingu"
              description="Ranking pojawi się, gdy gracze zaczną typować."
            />
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
          <Link
            to="/public"
            className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Społeczności
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
            Ranking
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

function MiniStat({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
      <p className="text-xs uppercase tracking-[0.15em] text-white/40">
        {title}
      </p>

      <p className="mt-1 text-xl font-black text-violet-300">{value}</p>
    </div>
  );
}
