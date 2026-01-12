import { useEffect, useMemo, useState } from "react";
import "./App.css";

function StatCard({ title, value, hint, accent }) {
  return (
    <div className={`card stat ${accent || ""}`.trim()}>
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
      {hint && <div className="card-hint">{hint}</div>}
    </div>
  );
}

function formatPhaseLabel(phase) {
  const p = String(phase || "").toUpperCase();
  const map = {
    PRE_EVENT: "Przed turniejem",
    SWISS_STAGE_1: "Swiss – Stage 1",
    SWISS_STAGE_2: "Swiss – Stage 2",
    SWISS_STAGE_3: "Swiss – Stage 3",
    PLAYIN: "Play-In",
    PLAYOFFS: "Playoffs",
    DOUBLE_ELIM: "Double Elimination",
    FINISHED: "Zakończony",
    UNKNOWN: "Nieustawione",
  };
  return map[p] || p || "Nieustawione";
}

function formatActionLabel(action) {
  const a = String(action || "").toUpperCase();
  const map = {
    OPEN_PREDICTIONS: "Otwarto typowanie",
    CLOSE_PREDICTIONS: "Zamknięto typowanie",
    CHANGE_PHASE: "Zmieniono fazę",
  };
  return map[a] || a;
}

export default function App() {
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingPhase, setSavingPhase] = useState(false);

  const load = async () => {
    const res = await fetch("/api/dashboard/summary");
    const json = await res.json();
    setData(json);
  };

  const loadAudit = async () => {
    const res = await fetch("/api/dashboard/audit?limit=50");
    const json = await res.json();
    setAudit(json?.rows || []);
  };

  useEffect(() => {
    load().catch(console.error);
    loadAudit().catch(console.error);
  }, []);

  const phases = useMemo(() => {
    if (Array.isArray(data?.allowedPhases) && data.allowedPhases.length) return data.allowedPhases;
    return [
      "PRE_EVENT",
      "SWISS_STAGE_1",
      "SWISS_STAGE_2",
      "SWISS_STAGE_3",
      "PLAYIN",
      "PLAYOFFS",
      "DOUBLE_ELIM",
      "FINISHED",
    ];
  }, [data]);

  const refresh = async () => {
    setLoading(true);
    try {
      await load();
      await loadAudit();
    } finally {
      setLoading(false);
    }
  };

  const open = async () => {
    setLoading(true);
    try {
      await fetch("/api/dashboard/open", { method: "POST" });
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    setLoading(true);
    try {
      await fetch("/api/dashboard/close", { method: "POST" });
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const changePhase = async (phase) => {
    setSavingPhase(true);
    try {
      await fetch("/api/dashboard/phase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      await refresh();
    } finally {
      setSavingPhase(false);
    }
  };

  const counters = data?.counters || {};

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Pick&apos;Em Dashboard</h1>
          <div className="sub">
            Status jak na DC (bez samego typowania). Admin ma tu sterowanie fazą / open-close.
          </div>
        </div>

        <button className="btn" onClick={refresh} disabled={loading}>
          Odśwież
        </button>
      </header>

      {!data && <div className="loading">Ładowanie danych…</div>}

      {data && (
        <>
          <div className="grid">
            <StatCard title="Faza turnieju" value={formatPhaseLabel(data.phase)} hint={String(data.phase || "")} />
            <StatCard
              title="Typowanie" 
              value={data.isOpen ? "OTWARTE" : "ZAMKNIĘTE"}
              accent={data.isOpen ? "open" : "closed"}
            />
            <StatCard title="Swiss – uczestnicy" value={counters.swissParticipants ?? 0} />
            <StatCard title="Swiss – oddane typy" value={counters.swissPredictions ?? 0} />
            <StatCard title="Playoffs – uczestnicy" value={counters.playoffsParticipants ?? 0} />
            <StatCard title="Play-In – uczestnicy" value={counters.playinParticipants ?? 0} />
            <StatCard title="Double Elim – uczestnicy" value={counters.doubleElimParticipants ?? 0} />
          </div>

          {data.isAdmin ? (
            <div className="panel">
              <div className="panel-title">Sterowanie (admin)</div>

              <div className="actions">
                <button
                  onClick={open}
                  disabled={loading || data.isOpen}
                  className="btn green"
                >
                  Otwórz typowanie
                </button>

                <button
                  onClick={close}
                  disabled={loading || !data.isOpen}
                  className="btn red"
                >
                  Zamknij typowanie
                </button>
              </div>

              <div className="phase-row">
                <label className="phase-label">Faza:</label>
                <select
                  className="phase-select"
                  value={String(data.phase || "UNKNOWN")}
                  onChange={(e) => changePhase(e.target.value)}
                  disabled={savingPhase}
                >
                  {/* jeżeli backend zwraca UNKNOWN, to dorzucamy option */}
                  {!phases.includes("UNKNOWN") && (
                    <option value="UNKNOWN">Nieustawione</option>
                  )}

                  {phases.map((p) => (
                    <option key={p} value={p}>
                      {formatPhaseLabel(p)}
                    </option>
                  ))}
                </select>
                {savingPhase && <span className="hint">zapisywanie…</span>}
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-title">Sterowanie</div>
              <div className="muted">Tylko dla admina.</div>
            </div>
          )}

          <div className="panel">
            <div className="panel-title">Audit log (ostatnie akcje)</div>

            {audit.length === 0 ? (
              <div className="muted">Brak wpisów (albo brak tabeli tournament_audit_log).</div>
            ) : (
              <div className="audit">
                <div className="audit-head">
                  <div>Data</div>
                  <div>Akcja</div>
                  <div>Zmiana</div>
                  <div>Actor</div>
                </div>
                {audit.map((row, idx) => (
                  <div className="audit-row" key={idx}>
                    <div className="mono">{row.created_at ? String(row.created_at) : "-"}</div>
                    <div>{formatActionLabel(row.action)}</div>
                    <div>
                      <span className="mono">{row.old_value ?? "-"}</span>
                      <span className="arrow">→</span>
                      <span className="mono">{row.new_value ?? "-"}</span>
                    </div>
                    <div className="mono">{row.actor_discord_id ?? "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
