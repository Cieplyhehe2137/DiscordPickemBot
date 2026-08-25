export default function MvpAdminPanel({
  candidates,
  result,
  textarea,
  selectedCandidateId,
  savingCandidates,
  savingResult,
  candidatesError,
  resultError,
  onTextareaChange,
  onSelectedCandidateChange,
  onSaveCandidates,
  onSaveResult,
}) {
  const activeCandidates = candidates.filter(
    (candidate) => candidate.is_active,
  );

  const officialCandidate = result
    ? candidates.find(
        (candidate) => Number(candidate.id) === Number(result.candidate_id),
      )
    : null;

  return (
    <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <h2 className="text-3xl font-black">MVP</h2>

      <p className="mt-2 text-white/50">
        Oficjalny MVP:{" "}
        <strong className="text-white">
          {officialCandidate
            ? officialCandidate.nickname
            : result
              ? `#${result.candidate_id}`
              : "Nie ustawiono"}
        </strong>
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
            Dodaj lub zastąp kandydatów
          </p>

          <p className="mt-2 text-sm text-white/40">
            Jeden kandydat na linię. Format: <strong>nick | drużyna</strong> —
            nazwa drużyny jest opcjonalna. Zapis zastępuje aktualną listę
            kandydatów.
          </p>

          <textarea
            value={textarea}
            onChange={(event) => onTextareaChange(event.target.value)}
            rows={6}
            placeholder={"s1mple | Team A\nZywOo | Team B"}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
          />

          {candidatesError && (
            <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
              {candidatesError}
            </div>
          )}

          <button
            type="button"
            onClick={onSaveCandidates}
            disabled={savingCandidates || !textarea.trim()}
            className="mt-4 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingCandidates ? "Zapisywanie..." : "Zapisz kandydatów"}
          </button>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">
            Ustaw oficjalnego MVP
          </p>

          <p className="mt-2 text-sm text-white/40">
            Aktywnych kandydatów:{" "}
            <strong className="text-white">{activeCandidates.length}</strong>
          </p>

          <select
            value={selectedCandidateId}
            onChange={(event) => onSelectedCandidateChange(event.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
          >
            <option value="">Wybierz kandydata...</option>

            {activeCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.nickname}

                {candidate.team_name ? ` (${candidate.team_name})` : ""}
              </option>
            ))}
          </select>

          {resultError && (
            <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
              {resultError}
            </div>
          )}

          <button
            type="button"
            onClick={onSaveResult}
            disabled={savingResult || !selectedCandidateId}
            className="mt-4 rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingResult ? "Zapisywanie..." : "Ustaw oficjalnego MVP"}
          </button>
        </div>
      </div>
    </section>
  );
}
