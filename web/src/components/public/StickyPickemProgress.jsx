import { Link } from "react-router-dom";
export default function StickyPickemProgress({
  myPredictionsCount,
  totalMatchesCount,
  missingPredictionsCount,
  myPredictionsProgress,
}) {
  return (
    <div className="sticky bottom-4 z-40 mt-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-violet-400/20 bg-zinc-950/90 p-5 shadow-[0_0_50px_rgba(139,92,246,0.2)] backdrop-blur-xl">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
            Twój postęp Pick&apos;Em
          </p>

          <p className="mt-1 text-white/50">
            {myPredictionsCount} / {totalMatchesCount} obstawionych • zostało{" "}
            {missingPredictionsCount}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-40 overflow-hidden rounded-full border border-white/10 bg-black/30">
            <div
              className="h-3 rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${myPredictionsProgress}%` }}
            />
          </div>

          <p className="text-2xl font-black text-violet-300">
            {myPredictionsProgress}%
          </p>

          <button
            onClick={() => {
              const picksSection = document.getElementById("matches-section");

              if (picksSection) {
                picksSection.scrollIntoView({
                  behavior: "smooth",
                });
              }
            }}
            className="rounded-2xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400"
          >
            Moje typy
          </button>

          <Link
            to="/public/me/predictions"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
          >
            Wszystkie typy
          </Link>
        </div>
      </div>
    </div>
  );
}
