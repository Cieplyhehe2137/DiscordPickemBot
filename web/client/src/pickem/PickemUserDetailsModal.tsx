import { usePickemUserDetails } from "./usePickemUserDetails";
import type { UserPickRow, UserMatchBreakdownRow } from "./types";

type Props = {
  slug: string;
  userId: string | null;
  open: boolean;
  onClose: () => void;
};

export default function PickemUserDetailsModal({
  slug,
  userId,
  open,
  onClose,
}: Props) {
  const { data, loading, error } = usePickemUserDetails(
    slug,
    open ? userId : null
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Szczegóły punktów
            </h2>
            {data?.user && (
              <p className="mt-1 text-zinc-400">
                {data.user.username} • ID: {data.user.id}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Zamknij
          </button>
        </div>

        {loading && (
          <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-300">
            Ładowanie szczegółów…
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-950/40 p-6 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-zinc-900 p-5">
              <p className="text-sm text-zinc-400">Suma punktów</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {data.totalPoints}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-5">
              <h3 className="mb-4 text-lg font-semibold text-indigo-400">
                Rozbicie
              </h3>

              <div className="space-y-3">
                {data.picks.length === 0 && (
                  <div className="text-zinc-500">Brak szczegółowych danych.</div>
                )}

                {data.picks.map((pick: UserPickRow, index: number) => (
                  <div
                    key={`${pick.stage}-${index}`}
                    className="flex items-center justify-between rounded-xl bg-zinc-800 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-white">{pick.label}</div>
                      <div className="text-sm text-zinc-400">{pick.stage}</div>
                    </div>

                    <div className="text-lg font-semibold text-white">
                      {pick.points} pkt
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {data.matchBreakdown && data.matchBreakdown.length > 0 && (
              <div className="rounded-2xl bg-zinc-900 p-5">
                <h3 className="mb-4 text-lg font-semibold text-yellow-400">
                  Szczegóły meczów
                </h3>

                <div className="space-y-3">
                  {data.matchBreakdown.map(
                    (match: UserMatchBreakdownRow) => (
                      <div
                        key={match.matchId}
                        className="rounded-xl bg-zinc-800 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium text-white">
                              {match.matchNo
                                ? `Mecz ${match.matchNo}`
                                : `Match ID ${match.matchId}`}{" "}
                              • {match.teamA} vs {match.teamB}
                            </div>

                            <div className="text-sm text-zinc-400">
                              {match.phase}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">
                              {match.totalPoints} pkt
                            </div>

                            <div className="text-xs text-zinc-400">
                              seria: {match.seriesPoints} • mapy: {match.mapPoints}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}