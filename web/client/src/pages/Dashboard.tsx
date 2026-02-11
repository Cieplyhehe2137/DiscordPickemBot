import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Event = {
  id: number;
  slug: string;
  name: string;
  status: string;
  deadline: string;
};

export default function Dashboard() {
  const [active, setActive] = useState<Event[]>([]);
  const [archived, setArchived] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const activeRes = await fetch("/api/events/active");
        const archivedRes = await fetch("/api/events/archived");

        const activeData = await activeRes.json();
        const archivedData = await archivedRes.json();

        setActive(activeData);
        setArchived(archivedData);
      } catch (err) {
        console.error("Błąd ładowania turniejów", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading)
    return <div className="p-10 text-gray-400">Ładowanie...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12 text-white">
      <div className="max-w-5xl mx-auto space-y-12">

        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Panel turniejów
        </h1>

        {/* ================= AKTYWNE ================= */}

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">
            🎮 Aktywne turnieje
          </h2>

          {active.length === 0 && (
            <div className="text-zinc-500">
              Brak aktywnych turniejów.
            </div>
          )}

          <div className="grid gap-6">
            {active.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/dashboard/${event.slug}`)}
                className="bg-zinc-900 p-6 rounded-xl flex justify-between items-center 
                  border border-zinc-800
                  hover:border-indigo-500
                  hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]
                  hover:scale-[1.01]
                  transition-all duration-300
                  cursor-pointer"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">
                    {event.name}
                  </h2>

                  <p className="text-zinc-400 text-sm">
                    Deadline: {new Date(event.deadline).toLocaleString()}
                  </p>

                  <p className="text-xs text-zinc-600 uppercase tracking-wider">
                    {event.slug}
                  </p>
                </div>

                <span className="px-5 py-2 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
                  {event.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ================= ARCHIWUM ================= */}

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-400 pt-6">
            📦 Archiwalne turnieje
          </h2>

          {archived.length === 0 && (
            <div className="text-zinc-600">
              Brak archiwalnych turniejów.
            </div>
          )}

          <div className="grid gap-6">
            {archived.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/dashboard/${event.slug}`)}
                className="opacity-60 grayscale bg-zinc-900 p-6 rounded-xl flex justify-between items-center 
                  border border-zinc-800
                  hover:border-zinc-500
                  hover:shadow-lg
                  transition-all duration-300
                  cursor-pointer"
              >
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold">
                    {event.name}
                  </h2>

                  <p className="text-zinc-500 text-sm">
                    Deadline: {new Date(event.deadline).toLocaleString()}
                  </p>

                  <p className="text-xs text-zinc-700 uppercase tracking-wider">
                    {event.slug}
                  </p>
                </div>

                <span className="px-5 py-2 rounded-full text-sm font-semibold bg-red-500/20 text-red-400">
                  ARCHIVE
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
