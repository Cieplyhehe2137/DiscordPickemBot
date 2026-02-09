import { Link } from "react-router-dom";
import { useMe } from "../auth/useMe";

export default function Dashboard() {
  const { data, loading } = useMe();

  if (loading) return <p>Ładowanie…</p>;
  if (!data) return <p>Brak danych</p>;

  return (
    <div>
      <h1>Twoje serwery</h1>

      <ul>
        {data.guilds
          .filter(g => g.botPresent)
          .map(g => (
            <li key={g.id}>
              <Link to={`/guild/${g.id}`}>
                {g.name}
                {!g.isAdmin && " (read-only)"}
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
