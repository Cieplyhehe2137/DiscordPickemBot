import { usePublicPickemLeaderboard } from "./usePublicPickemLeaderboard";

export default function PublicPickemLeaderboard() {
  const { data, loading } = usePublicPickemLeaderboard();

  if (loading) return <p>Ładowanie rankingu…</p>;
  if (!data) return <p>Brak danych</p>;

  return (
    <div>
      <h2>🏆 {data.event.name} – Ranking</h2>

      <table>
        <tbody>
          {data.rows.map(r => (
            <tr key={r.userId}>
              <td>{r.rank}</td>
              <td>{r.username}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
