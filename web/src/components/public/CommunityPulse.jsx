export default function CommunityPulse({
  liveMatchesCount,
  totalPredictions,
  phase,
  communityAccuracy,
  mostTrustedPick,
  biggestUpset,
}) {
  return (
    <>
      <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          Puls społeczności
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <PulseStat title="Mecze na żywo" value={liveMatchesCount} />

          <PulseStat title="Wszystkie typy" value={totalPredictions} />

          <PulseStat title="Faza eventu" value={phase} />

          <PulseStat
            title="Skuteczność społeczności"
            value={`${communityAccuracy}%`}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <InsightCard
          title="Najbardziej zaufany typ"
          match={mostTrustedPick}
          empty="Brak jeszcze trafionych typów społeczności."
        />

        <InsightCard
          title="Największa niespodzianka"
          match={biggestUpset}
          empty="Brak jeszcze niespodzianek."
        />
      </div>
    </>
  );
}

function PulseStat({ title, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
        {title}
      </p>

      <p className="mt-3 text-3xl font-black">{value}</p>
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

        <p className="mt-3 text-white/40">{empty}</p>
      </div>
    );
  }

  const confidence = Math.max(match.team_a_percentage, match.team_b_percentage);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
        {title}
      </p>

      <h3 className="mt-3 text-2xl font-black">
        {match.team_a} vs {match.team_b}
      </h3>

      <p className="mt-2 text-white/50">
        Społeczność typowała {match.community_pick} z pewnością {confidence}%.
      </p>

      <p className="mt-2 text-white/50">Zwycięzca: {match.winner}</p>
    </div>
  );
}
