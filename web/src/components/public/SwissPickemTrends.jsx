export default function SwissPickemTrends({ swissStats }) {
  return (
    <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Trendy Pick&apos;Em Swiss
      </p>

      <p className="mt-2 text-white/50">
        Na podstawie {swissStats?.total_predictions || 0} zapisanych typów
        Pick&apos;Em.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatsMiniColumn
          title="Najczęściej typowane 3-0"
          rows={(swissStats?.stats?.three_zero || []).slice(0, 5)}
        />

        <StatsMiniColumn
          title="Najczęściej typowane 0-3"
          rows={(swissStats?.stats?.zero_three || []).slice(0, 5)}
        />

        <StatsMiniColumn
          title="Najczęściej typowani awansujący"
          rows={(swissStats?.stats?.advancing || []).slice(0, 5)}
        />
      </div>
    </div>
  );
}

function StatsMiniColumn({ title, rows }) {
  return (
    <div>
      <p className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-violet-300">
        {title}
      </p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.team}
            className="rounded-2xl border border-white/10 bg-black/30 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-black">{row.team}</span>

              <span className="text-sm text-violet-300">{row.percentage}%</span>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-sm text-white/40">Brak danych</p>
        )}
      </div>
    </div>
  );
}
