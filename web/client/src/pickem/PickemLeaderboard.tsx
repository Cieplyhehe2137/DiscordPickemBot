import { usePickemLeaderboard } from "./usePickemLeaderboard";

type Props = {
  slug: string;
};

export default function PickemLeaderboard({ slug }: Props) {
  const { data, loading, error } = usePickemLeaderboard(slug);

  if (loading) return <p>Ładowanie rankingu…</p>;
  if (error) return <p>{error}</p>;
  if (!data || !data.event) return <p>Brak danych rankingu</p>;

  return (
    <div>
      <h2>🏆 {data.event.name} – Ranking</h2>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Gracz</th>
            <th>Swiss</th>
            <th>Playoffs</th>
            <th>MVP</th>
            <th>Mecze</th>
            <th>Punkty</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.userId}>
              <td>{row.rank}</td>
              <td>{row.username}</td>
              <td>{row.swissPoints ?? 0}</td>
              <td>{row.playoffPoints ?? 0}</td>
              <td>{row.mvpPoints ?? 0}</td>
              <td>{row.matchPoints ?? 0}</td>
              <td>
                <strong>{row.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}