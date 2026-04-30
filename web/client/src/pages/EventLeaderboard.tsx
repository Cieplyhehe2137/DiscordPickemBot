import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api/useApi";

type Row = {
  rank: number;
  userId: string;
  username: string;
  points: number;
  swissPoints?: number;
  playoffPoints?: number;
  matchPoints?: number;
  mvpPoints?: number;
};

type LeaderboardDTO = {
  event: {
    name: string;
  };
  rows: Row[];
};

export default function EventLeaderboard() {
  const { slug } = useParams();
  const api = useApi();

  const [data, setData] = useState<LeaderboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<LeaderboardDTO>(`/events/${slug}/leaderboard`);
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  if (loading) return <div className="text-white p-10">Ładowanie...</div>;

  if (!data) return <div className="text-white p-10">Brak danych</div>;

  return (
    <div className="p-10 space-y-6 text-white">
      <h1 className="text-3xl font-bold">
        Ranking — {data.event.name}
      </h1>

      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-left">
          <thead className="bg-zinc-900 text-sm text-zinc-400">
            <tr>
              <th className="p-4">#</th>
              <th className="p-4">Gracz</th>
              <th className="p-4">Punkty</th>
              <th className="p-4">Swiss</th>
              <th className="p-4">Playoffs</th>
              <th className="p-4">Mecze</th>
              <th className="p-4">MVP</th>
            </tr>
          </thead>

          <tbody>
            {data.rows.map((r) => (
              <tr
                key={r.userId}
                className="border-t border-zinc-800 hover:bg-zinc-900"
              >
                <td className="p-4 font-bold">{r.rank}</td>
                <td className="p-4">{r.username}</td>
                <td className="p-4 font-semibold">{r.points}</td>
                <td className="p-4">{r.swissPoints ?? 0}</td>
                <td className="p-4">{r.playoffPoints ?? 0}</td>
                <td className="p-4">{r.matchPoints ?? 0}</td>
                <td className="p-4">{r.mvpPoints ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}