import { useEffect, useState } from "react";
import "./App.css";

function StatCard({ title, value, accent }) {
  return (
    <div className={`card ${accent || ""}`}>
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    fetch("/api/dashboard/summary")
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  };

  useEffect(load, []);

  const open = async () => {
    setLoading(true);
    await fetch("/api/dashboard/open", { method: "POST" });
    await load();
    setLoading(false);
  };

  const close = async () => {
    setLoading(true);
    await fetch("/api/dashboard/close", { method: "POST" });
    await load();
    setLoading(false);
  };

  return (
    <div className="app">
      <h1>Pick'Em Dashboard</h1>

      {!data && <div className="loading">Ładowanie danych…</div>}

      {data && (
        <>
          <div className="grid">
            <StatCard title="Faza turnieju" value={data.phase} />
            <StatCard
              title="Typowanie"
              value={data.isOpen ? "OTWARTE" : "ZAMKNIĘTE"}
              accent={data.isOpen ? "open" : "closed"}
            />
            <StatCard title="Uczestnicy" value={data.participants} />
            <StatCard title="Oddane typy" value={data.predictions} />
          </div>

          {/* 🔐 PRZYCISKI TYLKO DLA ADMINA */}
          {data.isAdmin && (
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
          )}
        </>
      )}
    </div>
  );
}
