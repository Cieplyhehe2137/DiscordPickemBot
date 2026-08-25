import { Link } from "react-router-dom";
import { translateStatus } from "../../lib/labels";

export default function PublicEventHero({
  event,
  slug,
  publicUrl,
  isLoggedIn,
  totalMatchesCount,
  missingPredictionsCount,
  copyPublicUrl,
}) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-violet-400/20 bg-white/[0.04] p-8 shadow-[0_0_80px_rgba(139,92,246,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.28),transparent_42%)]" />

      <div className="relative z-10">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          Publiczny event Pick&apos;Em
        </p>

        <h1 className="mt-4 text-4xl font-black md:text-7xl">
          {event?.name || slug}
        </h1>

        <p className="mt-4 max-w-3xl text-lg text-white/60">
          Typuj mecze, śledź trendy społeczności, wspinaj się w rankingu i
          porównuj swoje typy z innymi graczami.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="inline-flex rounded-2xl border border-green-400/20 bg-green-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-green-300">
            Aktualizacje na żywo włączone
          </div>

          {isLoggedIn &&
            totalMatchesCount > 0 &&
            missingPredictionsCount === 0 && (
              <div className="inline-flex rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                Pick&apos;Em ukończony
              </div>
            )}

          <span
            className={`inline-flex rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.2em] ${
              event?.status === "OPEN"
                ? "bg-green-500/15 text-green-300"
                : event?.status === "CLOSED"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-zinc-500/15 text-zinc-300"
            }`}
          >
            {event?.status ? translateStatus(event.status) : "NIEZNANY"}
          </span>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            onClick={copyPublicUrl}
            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
          >
            Kopiuj link publiczny
          </button>

          <Link
            to={`/public/event/${slug}/pickem/stage1`}
            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
          >
            Pełny Pick&apos;Em
          </Link>

          <Link
            to={`/public/event/${slug}/leaderboard`}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
          >
            Ranking eventu
          </Link>

          <Link
            to="/public/archives"
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
          >
            Archiwum
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-white/50">
          {publicUrl}
        </div>
      </div>
    </div>
  );
}
