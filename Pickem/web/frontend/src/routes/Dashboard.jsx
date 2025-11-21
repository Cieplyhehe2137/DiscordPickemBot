import { useEffect, useState } from "react";

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    fetch("http://localhost:4000/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setUser(data.user);
        else window.location.href = "/";
      });
  }, []);

  if (!user) return <p>Ładowanie panelu…</p>;

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
        👑 Panel admina Pick'Em
      </h1>

      <p style={{ fontSize: "20px" }}>
        Witaj, <b>{user.username}</b>!
      </p>

      <p>ID Discord: {user.discord_id}</p>

      <button
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          border: "none",
          background: "#ff4747",
          color: "white",
          borderRadius: "6px",
          cursor: "pointer"
        }}
        onClick={() => {
          localStorage.removeItem("auth_token");
          window.location.href = "/";
        }}
      >
        🚪 Wyloguj
      </button>
    </div>
  );
}
