import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

type EventItem = {
  slug: string;
  name: string;
  phase: string;
  status: string;
};

export default function Dashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<EventItem[]>("/events/active");
        // console.log("EVENTS ACTIVE:", res);
        setEvents(res);
      } catch (err: any) {
        console.error("EVENTS ACTIVE ERROR:", err);
        setError(err?.message || "Nie udało się pobrać eventów");
      }
    }

    load();
  }, []);

  return (
    <div className="p-10 space-y-6">
      <h1 className="text-3xl font-bold">Aktywne eventy</h1>

      {error && (
        <div className="p-4 rounded-xl bg-red-900/40 border border-red-500 text-red-200">
          {error}
        </div>
      )}

      {events.map((e) => (
        <div
          key={e.slug}
          onClick={() => navigate(`/dashboard/${e.slug}`)}
          className="p-6 bg-zinc-900 rounded-xl cursor-pointer hover:bg-zinc-800"
        >
          <div className="font-semibold">{e.name}</div>
          <div className="text-sm text-zinc-400">
            {e.phase} • {e.status}
          </div>
        </div>
      ))}
    </div>
  );
}