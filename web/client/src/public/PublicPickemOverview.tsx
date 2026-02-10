import { Link } from "react-router-dom";
import { usePublicPickemOverview } from "./usePublicPickemOverview";
import PickemStatusBadge from "../pickem/PickemStatusBadge";


export default function PublicPickemOverview() {
  const { data, loading } = usePublicPickemOverview();

  if (loading) return <p>Ładowanie Pick’Em…</p>;
  if (!data) return <p>Brak danych</p>;

  return (
    <div>
      <h2>{data.event.name}</h2>

      <ul>
        <li>👥 Uczestnicy: {data.participants}</li>
        <li>⏰ Deadline: {new Date(data.deadline).toLocaleString()}</li>
        <li>
          📊 Status: <PickemStatusBadge status={data.status} />
        </li>
      </ul>

      <Link to="leaderboard">📊 Zobacz ranking</Link>
    </div>
  );
}
