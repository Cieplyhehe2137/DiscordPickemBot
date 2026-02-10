import { usePickemOverview } from "./usePickemOverview";
import { usePermissions } from "../guild/usePermissions";
import { usePickemActions } from "./usePickemActions";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function PickemOverview() {
  const { data, loading, refetch } = usePickemOverview();
  const { isAdmin } = usePermissions();
  const { lockPickem, recalculatePickem } = usePickemActions();
  const [busy, setBusy] = useState(false);

  async function handleLock() {
    try {
      await lockPickem();
      await refetch();
    } catch {
      alert("Nie udało się zamknąć typowania")
    }
  }

  async function handleRecalculate() {
    try {
      setBusy(true);
      await recalculatePickem();
      await refetch();
    } catch {
      alert("Błąd podczas przeliczania punktów");
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p>Ładowanie Pick’Em…</p>;
  if (!data) return <p>Brak danych Pick’Em</p>;

  return (
    <div>
      <h2>{data.event.name}</h2>

      <Link to="leaderboard" style={{ display: "inline-block", marginBottom: 12 }}>
        📊 Zobacz ranking
      </Link>
      <Link to="participants" style={{ marginLeft: 12 }}>
        👥 Uczestnicy
      </Link>


      <ul>
        <li>👥 Uczestnicy: {data.participants}</li>
        <li>⏰ Deadline: {new Date(data.deadline).toLocaleString()}</li>
        <li>📊 Status: {data.status}</li>
      </ul>

      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          {data.status === "open" && (
            <button onClick={handleLock}>🔒 Zamknij typowanie</button>
          )}

          {data.status !== "open" && (
            <button onClick={handleRecalculate} disabled={busy}>
              🔄 Przelicz punkty
            </button>
          )}


          <button>📥 Eksport</button>
        </div>
      )}
    </div>
  );
}
