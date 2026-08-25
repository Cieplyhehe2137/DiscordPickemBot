import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Archive } from "lucide-react";
import { getGuildArchive, describeActionError } from "../lib/api";
import { usePublicAuth } from "../context/PublicAuthContext";
import Breadcrumbs from "../components/layout/Breadcrumbs";
import EmptyState from "../components/ui/EmptyState";
import { translateStatus, translatePhase } from "../lib/labels";

export default function TournamentArchivePage() {
  const { guildId } = useParams();
  const navigate = useNavigate();
  const { user } = usePublicAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const guildName =
    user?.guilds?.find((g) => g.id === guildId)?.name || guildId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getGuildArchive(guildId);
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(describeActionError(err, "wczytać archiwum"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <Breadcrumbs
          items={[
            { label: "Serwery", to: "/app/guilds" },
            { label: "Serwer", to: `/app/guilds/${guildId}` },
            { label: "Archiwum turniejów" },
          ]}
        />

        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          Archiwum turniejów
        </p>

        <h1 className="mt-3 text-5xl font-black">{guildName}</h1>

        <p className="mt-4 text-white/50">
          Zakończone turnieje tego serwera wraz z końcową klasyfikacją i
          wynikami faz.
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
            Ładowanie archiwum...
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="mt-10">
            <EmptyState
              icon={Archive}
              title="Brak zakończonych turniejów"
              description="Turnieje pojawią się tutaj po zamknięciu lub zarchiwizowaniu."
            />
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {events.map((event, index) => (
            <button
              key={event.id}
              onClick={() =>
                navigate(`/app/guilds/${guildId}/archive/${event.slug}`)
              }
              style={{ animationDelay: `${index * 50}ms` }}
              className="card-hover animate-fade-in-up rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left transition hover:border-violet-400/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    {translatePhase(event.phase)}
                  </p>

                  <h2 className="mt-2 text-3xl font-black">{event.name}</h2>

                  <p className="mt-2 font-mono text-sm text-white/40">
                    {event.slug}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {Number(event.is_archived) === 1 && (
                    <span className="rounded-2xl bg-violet-500/15 px-4 py-2 text-sm font-black text-violet-300">
                      ZARCHIWIZOWANY
                    </span>
                  )}

                  <span className="rounded-2xl bg-zinc-500/15 px-4 py-2 text-sm font-black text-zinc-300">
                    {translateStatus(event.status)}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniStat label="Gracze" value={event.players} />
                <MiniStat label="Mecze" value={event.matches} />
                <MiniStat label="Suma punktów" value={event.total_points} />
                <MiniStat
                  label="Eksport Excel"
                  value={event.archive_file ? "jest" : "—"}
                />
              </div>

              <p className="mt-5 text-sm font-black text-violet-300">
                Zobacz wyniki →
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>

      <h3 className="mt-2 text-2xl font-black">{value}</h3>
    </div>
  );
}
