import { NavLink } from "react-router-dom";
import { useGuild } from "./GuildContext";
import { usePermissions } from "./usePermissions";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: "block",
  padding: "10px 12px",
  marginBottom: 4,
  borderRadius: 6,
  textDecoration: "none",
  background: isActive ? "#2b2b2b" : "transparent",
  color: "white",
});

export default function GuildSidebar() {
  const { guild } = useGuild();
  const { isAdmin } = usePermissions();

  return (
    <aside
      style={{
        width: 220,
        background: "#1f1f1f",
        padding: 16,
        color: "white",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <strong>{guild?.name ?? "Serwer"}</strong>
      </div>

      <nav>
        <NavLink to="pickem" style={linkStyle}>
          🏠 Overview
        </NavLink>

        <NavLink to="pickem/leaderboard" style={linkStyle}>
          📊 Ranking
        </NavLink>

        <NavLink to="pickem/participants" style={linkStyle}>
          👥 Uczestnicy
        </NavLink>

        {isAdmin && (
          <>
            <hr style={{ opacity: 0.2 }} />
            <NavLink to="pickem" style={linkStyle}>
              ⚙️ Akcje admina
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
