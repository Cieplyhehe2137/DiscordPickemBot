import { usePickemOverview } from "./usePickemOverview";
import { usePermissions } from "../guild/usePermissions";
import { usePickemActions } from "./usePickemActions";
import { useState } from "react";
import { Link } from "react-router-dom";
import PickemStatusBadge from "./PickemStatusBadge";
import { useGuild } from "../guild/GuildContext";


export default function PickemOverview() {
  const { data, loading, refetch } = usePickemOverview();
  const { isAdmin } = usePermissions();
  const { lockPickem, recalculatePickem } = usePickemActions();
  const [busy, setBusy] = useState(false);
  const { guild } = useGuild();

  // ======================
  // Handlers
  // ======================

  async function handleLock() {
    try {
      setBusy(true);
      await lockPickem();
      await refetch();
    } catch {
      alert("Nie udało się zamknąć typowania");
    } finally {
      setBusy(false);
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
      setBusy(false);
    }
  }

  // ======================
  // Guards
  // ======================

  if (loading) return <p>Ładowanie Pick’Em…</p>;
  if (!data) return <p>Brak danych Pick’Em</p>;

  const isScoring = data.status === "scoring";

  // ======================
  // Render
  // ======================

  return (
    <div>
      <h2>{data.event.name}</h2>
      {guild?.slug && (
        <div style={{ marginBottom: 12 }}>
          <a
            href={`/public/${guild.slug}/pickem`}
            target="_blank"
            rel="noopener noreferrer"
          >
            🌍 Publiczny widok
          </a>
        </div>
      )}


      <div style={{ marginBottom: 12 }}>
        <Link to="leaderboard">📊 Zobacz ranking</Link>
        <Link to="participants" style={{ marginLeft: 12 }}>
          👥 Uczestnicy
        </Link>
      </div>

      <ul>
        <li>👥 Uczestnicy: {data.participants}</li>
        <li>⏰ Deadline: {new Date(data.deadline).toLocaleString()}</li>
        <li>
          📊 Status: <PickemStatusBadge status={data.status} />
        </li>
      </ul>

      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          {data.status === "open" && (
            <button onClick={handleLock} disabled={busy}>
              🔒 Zamknij typowanie
            </button>
          )}

          {data.status === "locked" && (
            <button onClick={handleRecalculate} disabled={busy}>
              🔄 Przelicz punkty
            </button>
          )}

          {isScoring && (
            <p>⏳ Trwa liczenie punktów…</p>
          )}

          {data.status === "scored" && (
            <button disabled>
              ✅ Punkty policzone
            </button>
          )}

          <div style={{ marginTop: 8 }}>
            <button disabled={busy || isScoring}>
              📥 Eksport
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
