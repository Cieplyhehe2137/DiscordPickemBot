import { useEffect, useState } from "react";

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard/summary")
      .then(res => res.json())
      .then(setData)
      .catch(err => {
        console.error(err);
        setError("Błąd połączenia z API");
      });
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Pick'Em Dashboard</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <pre>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export default App;
