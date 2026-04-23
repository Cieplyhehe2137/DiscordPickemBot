import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { PickemLeaderboardDTO } from "../pickem/types";
import PickemUserDetailsModal from "../pickem/PickemUserDetailsModal";
import { useApi } from "../api/useApi";

type SummaryResponse = {
  event: {
    id: number;
    name: string;
    slug: string;
    deadline: string | null;
  };
  tournament: {
    phase: string;
    status: string;
    isOpen: boolean;
  };
  stats: {
    participants: number;
    predictions: number;
    byType: {
      swiss: number;
      playoffs: number;
      doubleElimination: number;
      playIn: number;
      matches: number;
      maps: number;
      mvp?: number;
    };
  };
  permissions: {
    isAdmin: boolean;
  };
};

const PHASES = [
  "SWISS_STAGE_1",
  "SWISS_STAGE_2",
  "SWISS_STAGE_3",
  "PLAYOFFS",
  "DOUBLE_ELIMINATION",
  "PLAY_IN",
  "FINISHED",
];

function formatDate(value: string | null) {
  if (!value) return "Brak";
  return new Date(value).toLocaleString("pl-PL");
}

function normalizeStatus(status: string) {
  return status?.toUpperCase?.() || "UNKNOWN";
}

function formatPhaseLabel(phase: string) {
  switch (phase) {
    case "SWISS_STAGE_1":
      return "Swiss Stage 1";
    case "SWISS_STAGE_2":
      return "Swiss Stage 2";
    case "SWISS_STAGE_3":
      return "Swiss Stage 3";
    case "PLAYOFFS":
      return "Playoffs";
    case "DOUBLE_ELIMINATION":
      return "Double Elimination";
    case "PLAY_IN":
      return "Play-In";
    case "FINISHED":
      return "Zakończony";
    default:
      return phase || "Nieznana";
  }
}

export default function EventDashboard() {
  const { slug, guildId } = useParams();
  const api = useApi();

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [top, setTop] = useState<PickemLeaderboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleOpenUserDetails = (userId: string) => {
    setSelectedUserId(userId);
    setDetailsOpen(true);
  };

  const handleCloseUserDetails = () => {
    setDetailsOpen(false);
    setSelectedUserId(null);
  };

  const loadSummary = useCallback(async () => {
    if (!slug) return;

    const json = await api.get<SummaryResponse>(`/events/${slug}/summary`);
    setData(json);
  }, [api, slug]);

  const loadTop = useCallback(async () => {
    if (!slug) return;

    const json = await api.get<PickemLeaderboardDTO>(`/events/${slug}/top`);
    setTop(json);
  }, [api, slug]);

  const reloadAll = useCallback(async () => {
    if (!slug) return;

    setError(null);
    setLoading(true);

    try {
      await Promise.all([loadSummary(), loadTop()]);
    } catch (err: any) {
      setError(err?.message || "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadTop, slug]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll, guildId, slug]);

  useEffect(() => {
    if (!data?.event.deadline) {
      setTimeLeft("");
      return;
    }

    const interval = setInterval(() => {
      const deadline = data.event.deadline;
      if (!deadline) {
        setTimeLeft("");
        clearInterval(interval);
        return;
      }

      const now = Date.now();
      const end = new Date(deadline).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Czas minął");
        clearInterval(interval);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.event.deadline]);

  const status = useMemo(
    () => normalizeStatus(data?.tournament.status || ""),
    [data?.tournament.status]
  );

  const currentIndex = PHASES.indexOf(data?.tournament.phase || "");

  const runAdminAction = async (
    fn: () => Promise<void>,
    successMessage?: string
  ) => {
    try {
      setBusy(true);
      setActionError(null);
      setActionSuccess(null);

      await fn();
      await reloadAll();

      if (successMessage) {
        setActionSuccess(successMessage);
      }
    } catch (err: any) {
      setActionError(err?.message || "Wystąpił błąd");
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    if (!slug) return;

    await runAdminAction(async () => {
      await api.post(`/events/${slug}/open`);
    }, "Event został otwarty.");
  };

  const handleClose = async () => {
    if (!slug) return;

    await runAdminAction(async () => {
      await api.post(`/events/${slug}/close`);
    }, "Event został zamknięty.");
  };

  const handlePhaseChange = async (phase: string) => {
    if (!slug) return;

    await runAdminAction(async () => {
      await api.post(`/events/${slug}/phase`, { phase });
    }, `Faza została zmieniona na ${formatPhaseLabel(phase)}.`);
  };

  const handleRecalculate = async () => {
    if (!slug) return;

    await runAdminAction(async () => {
      await api.post(`/events/${slug}/recalculate`);
    }, "Punkty zostały przeliczone.");
  };

  if (loading) {
    return <div className="p-10 text-white">Ładowanie...</div>;
  }

  if (error) {
    return <div className="p-10 text-red-400">{error}</div>;
  }

  if (!data) {
    return <div className="p-10 text-white">Brak danych</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12 text-white">
      <div className="mx-auto max-w-6xl space-y-12">
        <div
          className="relative overflow-hidden rounded-3xl border border-indigo-500/30
          bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent p-12"
        >
          <div className="relative z-10 space-y-4">
            <h1 className="text-5xl font-extrabold">{data.event.name}</h1>

            {timeLeft && (
              <div className="font-mono text-lg text-indigo-400">⏳ {timeLeft}</div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <span
                className={`rounded-full px-5 py-2 text-sm font-semibold ${
                  data.tournament.isOpen
                    ? "animate-pulse bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {status}
              </span>

              <span className="text-gray-400">
                Faza:{" "}
                <span className="text-white">
                  {formatPhaseLabel(data.tournament.phase)}
                </span>
              </span>

              <span className="text-gray-400">
                Deadline:{" "}
                <span className="text-white">{formatDate(data.event.deadline)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-zinc-900 p-8">
            <p className="text-gray-400">Uczestnicy</p>
            <p className="text-2xl font-semibold">{data.stats.participants}</p>
          </div>

          <div className="rounded-2xl bg-zinc-900 p-8">
            <p className="text-gray-400">Predykcje</p>
            <p className="text-2xl font-semibold">{data.stats.predictions}</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold text-indigo-400">
            📦 Rozbicie predykcji
          </h2>

          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-zinc-800 p-4">
              Swiss: {data.stats.byType.swiss}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              Playoffs: {data.stats.byType.playoffs}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              Double Elimination: {data.stats.byType.doubleElimination}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              Play-In: {data.stats.byType.playIn}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              Matches: {data.stats.byType.matches}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              Maps: {data.stats.byType.maps}
            </div>
            <div className="rounded-xl bg-zinc-800 p-4">
              MVP: {data.stats.byType.mvp ?? 0}
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl bg-zinc-900 p-8">
          <h2 className="text-xl font-semibold text-yellow-400">🏆 Top 5 graczy</h2>

          {(!top || top.rows.length === 0) && (
            <div className="text-zinc-500">Brak danych w rankingu</div>
          )}

          {top?.rows.map((player) => (
            <button
              key={player.userId}
              type="button"
              onClick={() => handleOpenUserDetails(player.userId)}
              className="flex w-full items-center justify-between rounded-2xl bg-zinc-800 p-6 text-left transition hover:bg-zinc-700"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 text-xl font-bold">{player.rank}.</span>
                <div>
                  <div>{player.username}</div>
                  <div className="text-xs text-zinc-400">
                    Swiss: {player.swissPoints ?? 0} · Playoffs:{" "}
                    {player.playoffPoints ?? 0} · MVP: {player.mvpPoints ?? 0} ·
                    Mecze: {player.matchPoints ?? 0}
                  </div>
                </div>
              </div>
              <span className="font-semibold">{player.points} pkt</span>
            </button>
          ))}
        </div>

        {data.permissions.isAdmin && (
          <>
            {(actionError || actionSuccess) && (
              <div
                className={`rounded-2xl border p-4 ${
                  actionError
                    ? "border-red-500/40 bg-red-500/10 text-red-300"
                    : "border-green-500/40 bg-green-500/10 text-green-300"
                }`}
              >
                {actionError || actionSuccess}
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-red-400">🛠 Panel admina</h2>

              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleOpen}
                  disabled={busy}
                  className="rounded-xl bg-green-600 px-6 py-3 hover:bg-green-500 disabled:opacity-50"
                >
                  🔓 Otwórz
                </button>

                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="rounded-xl bg-red-600 px-6 py-3 hover:bg-red-500 disabled:opacity-50"
                >
                  🔒 Zamknij
                </button>

                <button
                  onClick={handleRecalculate}
                  disabled={busy}
                  className="rounded-xl bg-indigo-600 px-6 py-3 hover:bg-indigo-500 disabled:opacity-50"
                >
                  🔄 Przelicz punkty
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-cyan-400">🎯 Zmień fazę</h2>

              <div className="flex flex-wrap gap-3">
                {PHASES.map((phase, index) => {
                  const isCurrent = phase === data.tournament.phase;
                  const isPast = currentIndex >= 0 && index < currentIndex;

                  return (
                    <button
                      key={phase}
                      onClick={() => handlePhaseChange(phase)}
                      disabled={busy || isCurrent}
                      className={`rounded-xl border px-5 py-3 transition ${
                        isCurrent
                          ? "border-indigo-400 bg-indigo-500/20 text-indigo-300"
                          : isPast
                          ? "border-zinc-700 bg-zinc-800 text-zinc-400"
                          : "border-zinc-700 bg-zinc-900 text-white hover:border-cyan-400"
                      } disabled:opacity-50`}
                    >
                      {formatPhaseLabel(phase)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <PickemUserDetailsModal
          guildId={guildId!}
          slug={slug!}
          userId={selectedUserId}
          open={detailsOpen}
          onClose={handleCloseUserDetails}
        />
      </div>
    </div>
  );
}