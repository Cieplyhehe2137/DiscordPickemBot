import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import EmptyState from "../ui/EmptyState";

export default function EventLeaderboardPreview({ slug, eventLeaderboard }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
            Najlepsi gracze
          </p>

          <h2 className="mt-2 text-3xl font-black">Ranking eventu</h2>
        </div>

        <Link
          to={`/public/event/${slug}/leaderboard`}
          className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-black transition hover:bg-violet-400"
        >
          Pełny ranking
        </Link>
      </div>

      <div className="mt-6 grid gap-3">
        {eventLeaderboard.map((player) => (
          <Link
            key={player.user_id}
            to={`/public/users/${player.user_id}`}
            className="card-hover rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:border-violet-400/30 hover:bg-violet-500/5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-black">
                  #{player.rank} {player.displayname || player.user_id}
                </p>

                <p className="mt-1 text-sm text-white/40">{player.user_id}</p>
              </div>

              <p className="text-2xl font-black text-violet-300">
                {player.total_points}
              </p>
            </div>
          </Link>
        ))}

        {eventLeaderboard.length === 0 && (
          <EmptyState
            icon={Trophy}
            title="Brak jeszcze danych rankingu"
            description="Wyniki pojawią się, gdy zaczną napływać typy."
          />
        )}
      </div>
    </div>
  );
}
