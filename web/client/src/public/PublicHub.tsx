import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Event = {
  id: number;
  slug: string;
  name: string;
  phase: string;
  is_open: number;
};

export default function PublicHub() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/public/events");
      const json = await res.json();
      setEvents(json);
      setLoading(false);
    }

    load();
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );

  const liveEvent = events.find((e) => e.is_open);
  const archived = events.filter((e) => !e.is_open);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">

      {/* HERO */}
      <section className="relative h-[70vh] flex flex-col justify-center items-center text-center">

        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-black" />

        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent z-10">
          PICK'EM PLATFORM
        </h1>

        <p className="text-gray-400 mt-6 text-lg z-10">
          Competitive Prediction Engine
        </p>

      </section>

      {/* FEATURED EVENT */}
      {liveEvent && (
        <section className="max-w-6xl mx-auto px-6 pb-24">

          <h2 className="text-3xl font-bold mb-8">Live Event</h2>

          <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-2xl border border-indigo-500/30 shadow-2xl shadow-indigo-900/20">

            <div className="flex justify-between items-center">

              <div>
                <h3 className="text-4xl font-bold mb-4">
                  {liveEvent.name}
                </h3>

                <p className="text-gray-400">
                  Phase: {liveEvent.phase}
                </p>
              </div>

              <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full font-semibold">
                LIVE
              </span>

            </div>

            <div className="mt-10">
              <Link
                to={`/public/test/pickem`}
                className="inline-block px-10 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-lg font-semibold shadow-lg hover:shadow-indigo-500/40"
              >
                ENTER EVENT
              </Link>
            </div>

          </div>

        </section>
      )}

      {/* ARCHIVE */}
      <section className="max-w-6xl mx-auto px-6 pb-24">

        <h2 className="text-3xl font-bold mb-8">Archive</h2>

        <div className="grid gap-6">

          {archived.map((event) => (
            <div
              key={event.id}
              className="bg-zinc-900/60 p-6 rounded-xl flex justify-between items-center border border-zinc-800"
            >
              <div>
                <h3 className="text-xl font-semibold text-gray-200">
                  {event.name}
                </h3>

                <p className="text-gray-500 text-sm">
                  {event.phase}
                </p>
              </div>

              <span className="px-4 py-2 bg-zinc-700 text-gray-400 rounded-full text-sm">
                ARCHIVED
              </span>
            </div>
          ))}

        </div>
      </section>

    </div>
  );
}
