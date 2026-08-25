export default function TournamentProgress({
  phase,
  formatPhaseLabel,
  PublicPhaseStep,
}) {
  return (
    <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Postęp turnieju
      </p>

      <h2 className="mt-3 text-4xl font-black">
        {formatPhaseLabel(phase || "UNKNOWN")}
      </h2>

      <p className="mt-2 text-white/50">Aktualny publiczny etap turnieju.</p>

      <div className="mt-8 flex flex-wrap gap-4">
        <PublicPhaseStep active={phase === "PLAY_IN"} label="Play-In" />

        <PublicPhaseStep active={phase === "SWISS"} label="Swiss" />

        <PublicPhaseStep active={phase === "PLAYOFFS"} label="Playoffs" />

        <PublicPhaseStep active={phase === "FINISHED"} label="Zakończony" />
      </div>
    </div>
  );
}
