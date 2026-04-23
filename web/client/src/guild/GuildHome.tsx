import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/useApi";
import { useGuild } from "../guild/GuildContext";

type EventRow = {
  id: number;
  name: string;
  slug: string;
  phase: string;
  status: string;
};

export default function GuildHome() {
  const api = useApi();
  const { guild } = useGuild();

  const [active, setActive] = useState<EventRow[]>([]);
  const [archived, setArchived] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [activeRows, archivedRows] = await Promise.all([
          api.get<EventRow[]>("/events/active"),
          api.get<EventRow[]>("/events/archived"),
        ]);

        setActive(activeRows);
        setArchived(archivedRows);
      } catch (err: any) {
        setError(err?.message || "Błąd ładowania eventów");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div className="p-8 text-white">Ładowanie...</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white">
          {guild?.name || "Panel serwera"}
        </h1>
        <p className="text-zinc-400 mt-2">
          Aktywne i archiwalne eventy Pick&apos;Em.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Aktywne eventy</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((event) => (
            <Link
              key={event.id}
              to={`events/${event.slug}`}
              className="rounded-2xl bg-zinc-900 p-5 hover:bg-zinc-800 transition"
            >
              <div className="text-lg font-semibold text-white">{event.name}</div>
              <div className="text-sm text-zinc-400 mt-2">
                {event.phase} • {event.status}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Archiwum</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {archived.map((event) => (
            <Link
              key={event.id}
              to={`events/${event.slug}`}
              className="rounded-2xl bg-zinc-950 p-5 hover:bg-zinc-900 transition border border-zinc-800"
            >
              <div className="text-lg font-semibold text-white">{event.name}</div>
              <div className="text-sm text-zinc-500 mt-2">
                {event.phase} • {event.status}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}