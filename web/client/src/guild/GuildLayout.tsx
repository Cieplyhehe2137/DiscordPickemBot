import { Outlet } from "react-router-dom";

export default function GuildLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "black", color: "white", padding: 20 }}>
      <div>GuildLayout działa</div>
      <Outlet />
    </div>
  );
}