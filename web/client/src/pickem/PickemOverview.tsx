import { usePickemOverview } from "./usePickemOverview";
import { usePickemActions } from "./usePickemActions";
import { useState } from "react";
import { Link } from "react-router-dom";
import PickemStatusBadge from "./PickemStatusBadge";
import { useGuild } from "../guild/GuildContext";

export default function PickemOverview() {
  const { data, loading, refetch } = usePickemOverview();
  const { lockPickem, recalculatePickem } = usePickemActions();
  const [busy, setBusy] = useState(false);
  const { guild } = useGuild();

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

  if (loading) return <p>Ładowanie Pick’Em…</p>;
  if (!data) return <p>Brak danych Pick’Em</p>;

  const status = data.tournament.status;
  const normalizedStatus = status?.toLowerCase();
  const isScoring = normalizedStatus === "scoring";
  const deadline = data.event.deadline;

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
        <li>👥 Uczestnicy: {data.stats.participants}</li>
        <li>
          ⏰ Deadline: {deadline ? new Date(deadline).toLocaleString() : "Brak"}
        </li>
        <li>
          📊 Status: <PickemStatusBadge status={normalizedStatus} />
        </li>
        <li>🎯 Typy łącznie: {data.stats.predictions}</li>
        <li>🧩 Faza: {data.tournament.phase}</li>
      </ul>

      {data.permissions.isAdmin && (
        <div style={{ marginTop: 16 }}>
          {normalizedStatus === "open" && (
            <button onClick={handleLock} disabled={busy}>
              🔒 Zamknij typowanie
            </button>
          )}

          {normalizedStatus === "locked" && (
            <button onClick={handleRecalculate} disabled={busy}>
              🔄 Przelicz punkty
            </button>
          )}

          {isScoring && <p>⏳ Trwa liczenie punktów…</p>}

          {normalizedStatus === "scored" && <button disabled>✅ Punkty policzone</button>}

          <div style={{ marginTop: 8 }}>
            <button disabled={busy || isScoring}>📥 Eksport</button>
          </div>
        </div>
      )}
    </div>
  );
}