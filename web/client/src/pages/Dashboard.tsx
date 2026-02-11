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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const res = await fetch("http://localhost:3301/api/events");
      const json = await res.json();
      setEvents(json);
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <div className="p-10 text-gray-400">Ładowanie...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12">
      <div className="max-w-5xl mx-auto space-y-10">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Panel turniejów
        </h1>

        {events.length === 0 && (
          <div className="text-zinc-500">Brak utworzonych turniejów.</div>
        )}

        <div className="grid gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => navigate(`/dashboard/${event.slug}`)}
              className="cursor-pointer bg-zinc-900/80 backdrop-blur p-8 rounded-2xl border border-zinc-800 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 flex justify-between items-center"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-white">
                  {event.name}
                </h2>

                <p className="text-zinc-400 text-sm">
                  Deadline: {new Date(event.deadline).toLocaleString()}
                </p>

                <p className="text-xs text-zinc-600 uppercase tracking-wider">
                  {event.slug}
                </p>
              </div>

              <span
                className={`px-5 py-2 rounded-full text-sm font-semibold ${
                  event.status === "OPEN"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {event.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
