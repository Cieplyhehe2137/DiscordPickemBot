import { useEffect, useState } from "react";
import { Trophy, Users, CalendarDays, PartyPopper } from "lucide-react";
import { getActiveEvents } from "../lib/api";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/ui/EmptyState";

export default function Dashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getActiveEvents();

        setEvents(data.events || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* TOPBAR */}
      <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-3xl font-black tracking-widest">PICKEMBOT</h1>

            <p className="text-sm text-white/40">Panel Pick&apos;Em</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
            Panel Administracyjny
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
            Panel
          </p>

          <h2 className="mt-2 text-5xl font-black">Aktywne eventy</h2>
        </div>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
            Ładowanie eventów...
          </div>
        )}

        {!loading && events.length === 0 && (
          <EmptyState
            icon={PartyPopper}
            title="Brak aktywnych eventów"
            description="Utwórz event z poziomu panelu serwera, aby zobaczyć go tutaj."
          />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {events.map((event, index) => (
            <div
              key={event.id}
              style={{ animationDelay: `${index * 60}ms` }}
              className="card-hover animate-fade-in-up rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition hover:border-violet-400/30 hover:bg-white/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                    {event.phase}
                  </p>

                  <h3 className="mt-3 text-4xl font-black">{event.name}</h3>
                </div>

                <div className="rounded-2xl bg-green-500/15 px-4 py-2 text-sm font-black text-green-300">
                  AKTYWNY
                </div>
              </div>

              <div className="mt-8 grid gap-4">
                <InfoCard
                  icon={<Users size={18} />}
                  label="Uczestnicy"
                  value={event.participants ?? 0}
                />

                <InfoCard
                  icon={<Trophy size={18} />}
                  label="Typy"
                  value={event.predictions ?? 0}
                />

                <InfoCard
                  icon={<CalendarDays size={18} />}
                  label="Deadline"
                  value={formatDeadline(event.deadline)}
                />
              </div>

              <button
                onClick={() =>
                  navigate(`/app/events/${event.slug || event.id}`)
                }
                className="mt-8 w-full rounded-2xl bg-violet-500 px-6 py-4 text-lg font-black transition hover:bg-violet-400"
              >
                Otwórz event
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function formatDeadline(deadline) {
  if (!deadline) return "Brak ustawionego deadline";

  const diff = new Date(deadline).getTime() - Date.now();

  if (diff <= 0) return "Deadline minął";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `zostało ${days}d ${hours}h`;

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `zostało ${hours}h ${minutes}m`;
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center gap-3 text-white/60">
        {icon}
        <span>{label}</span>
      </div>

      <strong>{value}</strong>
    </div>
  );
}
