import { usePickemUserDetails } from "./usePickemUserDetails";

export default function PickemUserDetails() {
  const { data, loading } = usePickemUserDetails();

  if (loading) return <p>Ładowanie gracza…</p>;
  if (!data) return <p>Brak danych gracza</p>;

  return (
    <div>
      <h2>👤 {data.user.username}</h2>
      <p>⭐ Punkty: {data.totalPoints}</p>

      <h3>Szczegóły typów</h3>
      <ul>
        {data.picks.map((p, i) => (
          <li key={i}>
            [{p.stage}] {p.label} → {p.points} pkt
          </li>
        ))}
      </ul>
    </div>
  );
}
