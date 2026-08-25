export default function PublicEventStatsGrid({
  participants,
  predictions,
  matches,
  myPicks,
  liveMatches,
  communityAccuracy,
}) {
  const stats = [
    {
      label: "Gracze",
      value: participants ?? 0,
      hint: "unikalni uczestnicy",
    },
    {
      label: "Typy",
      value: predictions ?? 0,
      hint: "zapisane typy",
    },
    {
      label: "Mecze",
      value: matches ?? 0,
      hint: "opublikowane mecze",
    },
    {
      label: "Moje typy",
      value: myPicks ?? 0,
      hint: "twoje zapisane typy",
    },
    {
      label: "Na żywo",
      value: liveMatches ?? 0,
      hint: "trwające mecze",
    },
    {
      label: "Skuteczność społeczności",
      value: `${communityAccuracy ?? 0}%`,
      hint: "zakończone mecze",
    },
  ];

  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
            {stat.label}
          </p>

          <h2 className="mt-3 text-3xl font-black">{stat.value}</h2>

          <p className="mt-2 text-sm text-white/40">{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}
