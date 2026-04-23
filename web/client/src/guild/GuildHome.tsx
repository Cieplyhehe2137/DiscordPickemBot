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

        setActive(Array.isArray(activeRows) ? activeRows : []);
        setArchived(Array.isArray(archivedRows) ? archivedRows : []);
      } catch (err: any) {
        setError(err?.message || "Nie udało się załadować eventów");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [api]);

  if (loading) {
    return <div className="text-white">Ładowanie eventów...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <div>
        <h1 className="text-4xl font-extrabold text-white">
          {guild?.name || "Panel serwera"}
        </h1>
        <p className="mt-2 text-zinc-400">
          Zarządzaj eventami Pick&apos;Em dla tego serwera.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Aktywne eventy</h2>

        {active.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-400">
            Brak aktywnych eventów.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((event) => (
              <Link
                key={event.id}
                to={`events/${event.slug}`}
                className="rounded-2xl bg-zinc-900 p-5 transition hover:bg-zinc-800"
              >
                <div className="text-xl font-semibold text-white">{event.name}</div>
                <div className="mt-2 text-sm text-zinc-400">
                  {formatPhaseLabel(event.phase)} • {event.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Archiwum</h2>

        {archived.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-400">
            Brak archiwalnych eventów.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((event) => (
              <Link
                key={event.id}
                to={`events/${event.slug}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:bg-zinc-900"
              >
                <div className="text-xl font-semibold text-white">{event.name}</div>
                <div className="mt-2 text-sm text-zinc-500">
                  {formatPhaseLabel(event.phase)} • {event.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}