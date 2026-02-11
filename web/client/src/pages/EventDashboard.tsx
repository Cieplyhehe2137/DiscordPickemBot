import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Summary = {
  phase: string;
  isOpen: boolean;
  participants: number;
  predictions: number;
  isAdmin: boolean;
};

export default function EventDashboard() {
  const { slug } = useParams();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/dashboard/${slug}/summary`);
      if (!res.ok) {
        throw new Error("Nie udało się pobrać danych");
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError("Błąd ładowania eventu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [slug]);

  const handleOpen = async () => {
    await fetch(`/api/dashboard/${slug}/open`, { method: "POST" });
    loadSummary();
  };

  const handleClose = async () => {
    await fetch(`/api/dashboard/${slug}/close`, { method: "POST" });
    loadSummary();
  };

  const handlePhaseChange = async (phase: string) => {
    await fetch(`/api/dashboard/${slug}/phase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phase }),
    });

    loadSummary();
  };

  if (loading) return <div className="p-10">Ładowanie...</div>;
  if (error) return <div className="p-10 text-red-400">{error}</div>;
  if (!data) return <div className="p-10">Brak danych</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12">
      <div className="max-w-5xl mx-auto space-y-10">

        <h1 className="text-4xl font-bold">
          Panel eventu: <span className="text-indigo-400">{slug}</span>
        </h1>

        <div className="grid grid-cols-2 gap-6">

          <div className="bg-zinc-900 p-6 rounded-xl">
            <p className="text-gray-400">Faza</p>
            <p className="text-2xl font-semibold">{data.phase}</p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl">
            <p className="text-gray-400 mb-2">Status</p>
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                data.isOpen
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {data.isOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl">
            <p className="text-gray-400">Uczestnicy</p>
            <p className="text-2xl font-semibold">{data.participants}</p>
          </div>

          <div className="bg-zinc-900 p-6 rounded-xl">
            <p className="text-gray-400">Predykcje</p>
            <p className="text-2xl font-semibold">{data.predictions}</p>
          </div>

        </div>

        {data.isAdmin && (
          <>
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleOpen}
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 transition"
              >
                🔓 Otwórz
              </button>

              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 transition"
              >
                🔒 Zamknij
              </button>
            </div>

            <div className="pt-6">
              <select
                value={data.phase}
                onChange={(e) => handlePhaseChange(e.target.value)}
                className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700"
              >
                <option value="SWISS_STAGE_1">SWISS_STAGE_1</option>
                <option value="SWISS_STAGE_2">SWISS_STAGE_2</option>
                <option value="SWISS_STAGE_3">SWISS_STAGE_3</option>
                <option value="PLAYOFFS">PLAYOFFS</option>
                <option value="FINISHED">FINISHED</option>
              </select>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
