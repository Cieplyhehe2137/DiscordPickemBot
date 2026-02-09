import { Navigate, Outlet, useParams } from "react-router-dom";
import { GuildProvider } from "./GuildContext";

export default function RequireGuild() {
  const { guildId } = useParams();

  if (!guildId) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <GuildProvider>
      <Outlet />
    </GuildProvider>
  );
}
