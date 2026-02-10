import { usePickemParticipants } from "./usePickemParticipants";

export default function PickemParticipants() {
  const { data, loading } = usePickemParticipants();

  if (loading) return <p>Ładowanie uczestników…</p>;
  if (!data) return <p>Brak danych uczestników</p>;

  return (
    <div>
      <h2>👥 {data.event.name} – Uczestnicy</h2>

      <table>
        <thead>
          <tr>
            <th>Gracz</th>
            <th>Punkty</th>
            <th>Dołączył</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <tr key={row.userId}>
              <td>{row.username}</td>
              <td>{row.points ?? "—"}</td>
              <td>{new Date(row.joinedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
