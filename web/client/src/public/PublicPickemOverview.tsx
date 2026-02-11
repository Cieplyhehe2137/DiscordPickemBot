import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type Overview = {
  guildSlug: string;
  name: string;
  participants: number;
  deadline: string;
  status: string;
};

export default function PublicPickemOverview() {
  const { guildSlug } = useParams();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `http://localhost:3301/api/public/${guildSlug}/overview`
        );
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [guildSlug]);

  if (loading) return <div>Ładowanie...</div>;
  if (!data) return <div>Brak danych</div>;

  return (
    <section className="min-h-[80vh] flex flex-col justify-center">
      <h1 className="text-6xl font-extrabold tracking-tight mb-8 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
        {data.name}
      </h1>

      <span className="inline-block px-4 py-2 rounded-full bg-green-500/20 text-green-400 mb-6 w-fit">
        {data.status}
      </span>

      <div className="space-y-2 text-gray-400 mb-10">
        <p>👥 {data.participants} uczestników</p>
        <p>⏰ {new Date(data.deadline).toLocaleString()}</p>
      </div>

      <div className="flex gap-6">
        <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-lg hover:shadow-indigo-500/40">
          📊 Zobacz ranking
        </button>

        <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-purple-500/40">
          🎮 Dołącz do Pick’Em
        </button>
      </div>
    </section>
  );
}
