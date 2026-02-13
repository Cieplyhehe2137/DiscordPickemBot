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
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.json())
      .then(user => {
        if (!user.guilds?.length) {
          navigate("/servers");
        }
      });
  }, []);

  useEffect(() => {
    async function load() {
      const activeRes = await fetch("/api/events/active", {
        credentials: "include"
      });

      const archivedRes = await fetch("/api/events/archived", {
        credentials: "include"
      });

      if (activeRes.ok) setActive(await activeRes.json());
      if (archivedRes.ok) setArchived(await archivedRes.json());

      setLoading(false);
    }

    load();
  }, []);

  if (loading)
    return <div className="p-10 text-gray-400">Ładowanie...</div>;

  return (
    <div className="p-12 space-y-16">

      {/* ================= ACTIVE ================= */}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">
          🎮 Aktywne turnieje
        </h2>

        {active.length === 0 && (
          <div className="text-zinc-500">
            Brak aktywnych turniejów
          </div>
        )}

        <div className="grid gap-6">
          {active.map(event => (
            <div
              key={event.id}
              onClick={() => navigate(`/dashboard/${event.slug}`)}
              className="bg-zinc-900 p-6 rounded-xl border border-zinc-800
                         hover:border-indigo-500
                         hover:shadow-[0_0_25px_rgba(99,102,241,0.4)]
                         transition-all duration-300
                         cursor-pointer"
            >
              <h3 className="text-xl font-semibold text-white">
                {event.name}
              </h3>

              <p className="text-zinc-400 text-sm">
                Deadline: {new Date(event.deadline).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= ARCHIVED ================= */}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-400">
          📦 Archiwalne turnieje
        </h2>

        {archived.length === 0 && (
          <div className="text-zinc-500">
            Brak archiwalnych turniejów
          </div>
        )}

        <div className="grid gap-6">
          {archived.map(event => (
            <div
              key={event.id}
              onClick={() => navigate(`/dashboard/${event.slug}`)}
              className="bg-zinc-900 p-6 rounded-xl border border-zinc-800
                         opacity-60 grayscale
                         hover:opacity-90
                         hover:border-indigo-500
                         transition-all duration-300
                         cursor-pointer"
            >
              <h3 className="text-xl font-semibold">
                {event.name}
              </h3>

              <p className="text-zinc-400 text-sm">
                Zakończony: {new Date(event.deadline).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
