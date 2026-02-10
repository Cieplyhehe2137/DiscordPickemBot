import { usePickemUserDetails } from "./usePickemUserDetails";
import UserBreakdownTabs from "./UserBreakdownTabs";

export default function PickemUserDetails() {
  const { data, loading } = usePickemUserDetails();

  if (loading) return <p>Ładowanie gracza…</p>;
  if (!data) return <p>Brak danych gracza</p>;

  return (
    <div>
      <h2>👤 {data.user.username}</h2>
      <p>⭐ Punkty: {data.totalPoints}</p>

      <UserBreakdownTabs breakdown={data.breakdown} />
    </div>
  );
}
