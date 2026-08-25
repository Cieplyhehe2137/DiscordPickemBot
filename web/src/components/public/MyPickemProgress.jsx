export default function MyPickemProgress({
  myPredictionsCount,
  totalMatchesCount,
  missingPredictionsCount,
  myPredictionsProgress,
}) {
  return (
    <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
            Twój postęp Pick&apos;Em
          </p>

          <p className="mt-2 text-white/50">
            {myPredictionsCount} z {totalMatchesCount} obstawionych • zostało{" "}
            {missingPredictionsCount}
          </p>
        </div>

        <p className="text-3xl font-black text-violet-300">
          {myPredictionsProgress}%
        </p>
      </div>

      <div className="mt-5 h-4 overflow-hidden rounded-full border border-white/10 bg-black/30">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${myPredictionsProgress}%` }}
        />
      </div>

      {totalMatchesCount > 0 && missingPredictionsCount === 0 && (
        <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-500/10 p-5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
            Pick&apos;Em ukończony
          </p>

          <p className="mt-2 text-white/60">
            Obstawiłeś już wszystkie dostępne mecze w tym evencie.
          </p>
        </div>
      )}
    </div>
  );
}
