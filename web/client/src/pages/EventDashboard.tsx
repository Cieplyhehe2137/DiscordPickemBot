import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Summary = {
  name: string;
  phase: string;
  isOpen: boolean;
  participants: number;
  predictions: number;
  deadline: string;
  isAdmin: boolean;
};

type Leader = {
  user_id: string;
  total_points: number;
};

const PHASES = [
  "SWISS_STAGE_1",
  "SWISS_STAGE_2",
  "SWISS_STAGE_3",
  "PLAYOFFS",
  "FINISHED",
];

export default function EventDashboard() {
  const { slug } = useParams();

  const [data, setData] = useState<Summary | null>(null);
  const [top, setTop] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  /* ================= LOAD SUMMARY ================= */

  const loadSummary = async () => {
    if (!slug) return;

    try {
      const res = await fetch(`/api/dashboard/${slug}/summary`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Błąd ładowania eventu");
    }
  };

  const loadTop = async () => {
    if (!slug) return;

    try {
      const res = await fetch(`/api/dashboard/${slug}/top`);
      if (!res.ok) return;
      setTop(await res.json());
    } catch {
      console.error("Top load error");
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadSummary();
      await loadTop();
      setLoading(false);
    };

    init();
  }, [slug]);

  /* ================= COUNTDOWN ================= */

  useEffect(() => {
    if (!data?.deadline) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(data.deadline).getTime();
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
  }, [data?.deadline]);

  /* ================= ACTIONS ================= */

  const handleOpen = async () => {
    await fetch(`/api/dashboard/${slug}/open`, { method: "POST" });
    await loadSummary();
  };

  const handleClose = async () => {
    await fetch(`/api/dashboard/${slug}/close`, { method: "POST" });
    await loadSummary();
  };

  const handlePhaseChange = async (phase: string) => {
    await fetch(`/api/dashboard/${slug}/phase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase }),
    });

    await loadSummary();
  };

  const handleRecalculate = async () => {
    await fetch(`/api/dashboard/${slug}/recalculate`, {
      method: "POST",
    });

    await loadSummary();
    await loadTop();
    alert("Punkty przeliczone ✅");
  };

  if (loading) return <div className="p-10 text-white">Ładowanie...</div>;
  if (error) return <div className="p-10 text-red-400">{error}</div>;
  if (!data) return <div className="p-10 text-white">Brak danych</div>;

  const currentIndex = PHASES.indexOf(data.phase);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12 text-white">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* ================= HEADER ================= */}

        <div className="relative overflow-hidden rounded-3xl p-12
          bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent
          border border-indigo-500/30">

          <div className="relative z-10 space-y-4">
            <h1 className="text-5xl font-extrabold">
              {data.name}
            </h1>

            {timeLeft && (
              <div className="text-indigo-400 text-lg font-mono">
                ⏳ {timeLeft}
              </div>
            )}

            <div className="flex items-center gap-4">
              <span
                className={`px-5 py-2 rounded-full text-sm font-semibold ${
                  data.isOpen
                    ? "bg-green-500/20 text-green-400 animate-pulse"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {data.isOpen ? "OPEN" : "CLOSED"}
              </span>

              <span className="text-gray-400">
                Faza: <span className="text-white">{data.phase}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-zinc-900 p-8 rounded-2xl">
            <p className="text-gray-400">Uczestnicy</p>
            <p className="text-2xl font-semibold">
              {data.participants}
            </p>
          </div>

          <div className="bg-zinc-900 p-8 rounded-2xl">
            <p className="text-gray-400">Predykcje</p>
            <p className="text-2xl font-semibold">
              {data.predictions}
            </p>
          </div>
        </div>

        {/* ================= TOP 5 ================= */}

        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-yellow-400">
            🏆 Top 5 Graczy
          </h2>

          {top.map((player: Leader, index: number) => (
            <div
              key={player.user_id}
              className="flex justify-between items-center p-6 rounded-2xl bg-zinc-900"
            >
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold w-8">
                  {index + 1}.
                </span>
                <span>{player.user_id}</span>
              </div>
              <span className="font-semibold">
                {player.total_points} pkt
              </span>
            </div>
          ))}
        </div>

        {/* ================= ADMIN ================= */}

        {data.isAdmin && (
          <>
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleOpen}
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500"
              >
                🔓 Otwórz
              </button>

              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500"
              >
                🔒 Zamknij
              </button>

              <button
                onClick={handleRecalculate}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500"
              >
                🔄 Przelicz punkty
              </button>
            </div>

            <div className="pt-6">
              <select
                value={data.phase}
                onChange={(e) =>
                  handlePhaseChange(e.target.value)
                }
                className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}