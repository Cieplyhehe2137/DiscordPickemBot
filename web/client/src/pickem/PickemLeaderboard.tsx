import { usePickemLeaderboard } from "./usePickemLeaderboard";

export default function PickemLeaderboard() {
  const { data, loading } = usePickemLeaderboard();

  if (loading) return <p>Ładowanie rankingu…</p>;
  if (!data) return <p>Brak danych rankingu</p>;

  return (
    <div>
      <h2>🏆 {data.event.name} – Ranking</h2>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Gracz</th>
            <th>Punkty</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.userId}>
              <td>{row.rank}</td>
              <td>{row.username}</td>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
