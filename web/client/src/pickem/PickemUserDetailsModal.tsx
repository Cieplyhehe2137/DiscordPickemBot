import { usePickemUserDetails } from "./usePickemUserDetails";
import type { UserPickRow, UserMatchBreakdownRow } from "./types";

type Props = {
  slug: string;
  userId: string | null;
  open: boolean;
  onClose: () => void;
};

function getExplanationClasses(explanation: string) {
  if (explanation.toLowerCase().includes("idealny")) {
    return "bg-green-500/15 text-green-300 border border-green-500/30";
  }

  if (
    explanation.toLowerCase().includes("dobry zwycięzca") ||
    explanation.toLowerCase().includes("zły dokładny wynik")
  ) {
    return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30";
  }

  if (
    explanation.toLowerCase().includes("nietrafiony") ||
    explanation.toLowerCase().includes("brak")
  ) {
    return "bg-red-500/15 text-red-300 border border-red-500/30";
  }

  return "bg-zinc-700/40 text-zinc-300 border border-zinc-600";
}

function formatStage(stage: string) {
  const map: Record<string, string> = {
    stage1: "Etap 1",
    stage2: "Etap 2",
    stage3: "Etap 3",
    playoffs: "Playoffs",
    double_elimination: "Double Elimination",
    play_in: "Play-In",
    mvp: "MVP",
    matches: "Mecze",
  };

  return map[stage] || stage;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Szczegóły punktów</h2>
            {data?.user && (
              <p className="mt-1 text-zinc-400">
                {data.user.username} • ID: {data.user.id}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900"
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
                Rozbicie punktów
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
                      <div className="text-sm text-zinc-400">
                        {formatStage(pick.stage)}
                      </div>
                    </div>

                    <div className="text-lg font-semibold text-white">
                      {pick.points} pkt
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-5">
              <h3 className="mb-4 text-lg font-semibold text-yellow-400">
                Szczegóły meczów
              </h3>

              {!data.matchBreakdown || data.matchBreakdown.length === 0 ? (
                <div className="text-zinc-500">Brak punktów za mecze</div>
              ) : (
                <div className="space-y-4">
                  {data.matchBreakdown.map(
                    (match: UserMatchBreakdownRow) => (
                      <div
                        key={match.matchId}
                        className="rounded-xl bg-zinc-800 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="font-medium text-white">
                              {match.matchNo
                                ? `Mecz ${match.matchNo}`
                                : `Match ID ${match.matchId}`}{" "}
                              • {match.teamA} vs {match.teamB}
                            </div>

                            <div className="text-sm text-zinc-400">
                              {match.phase}
                            </div>

                            <div className="text-sm text-zinc-300">
                              Typ serii:{" "}
                              <span className="font-semibold text-white">
                                {match.predA !== null && match.predB !== null
                                  ? `${match.predA}:${match.predB}`
                                  : "brak"}
                              </span>
                            </div>

                            <div className="text-sm text-zinc-300">
                              Wynik oficjalny:{" "}
                              <span className="font-semibold text-white">
                                {match.resA !== null && match.resB !== null
                                  ? `${match.resA}:${match.resB}`
                                  : "brak"}
                              </span>
                            </div>

                            <div
                              className={`inline-block rounded-lg px-3 py-1 text-xs font-medium ${getExplanationClasses(
                                match.explanation
                              )}`}
                            >
                              {match.explanation}
                              {match.maps && match.maps.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {match.maps.map((map) => (
                                    <div
                                      key={`${match.matchId}-${map.mapNo}`}
                                      className="rounded-lg bg-zinc-900/80 px-3 py-2"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="text-xs font-medium text-zinc-300">
                                            Mapa {map.mapNo}
                                          </div>

                                          <div className="text-xs text-zinc-400">
                                            Typ:{" "}
                                            <span className="text-zinc-200">
                                              {map.predA !== null && map.predB !== null
                                                ? `${map.predA}:${map.predB}`
                                                : "brak"}
                                            </span>
                                          </div>

                                          <div className="text-xs text-zinc-400">
                                            Wynik:{" "}
                                            <span className="text-zinc-200">
                                              {map.resA !== null && map.resB !== null
                                                ? `${map.resA}:${map.resB}`
                                                : "brak"}
                                            </span>
                                          </div>

                                          <div className="text-[11px] text-zinc-500">
                                            {map.explanation}
                                          </div>
                                        </div>

                                        <div className="text-sm font-semibold text-white">
                                          {map.points} pkt
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}