import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import EventDashboard from "./pages/EventDashboard";
import PublicPickemOverview from "./public/PublicPickemOverview";
import PublicPickemLeaderboard from "./public/PublicPickemLeaderboard";
import PublicLayout from "./public/PublicLayout";
import RequireAuth from "./auth/RequireAuth";
import GuildSelect from "./pages/GuildSelect";
import GuildHome from "./pages/GuildHome";
import RequireGuild from "./guild/RequireGuild";
import GuildLayout from "./guild/GuildLayout";
import TopBar from "./components/TopBar";
import ServerSidebar from "./components/ServerSidebar";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/public/:guildSlug/pickem" element={<PublicLayout />}>
          <Route index element={<PublicPickemOverview />} />
          <Route path="leaderboard" element={<PublicPickemLeaderboard />} />
        </Route>

        <Route path="/" element={<Navigate to="/guilds" replace />} />

        <Route element={<RequireAuth />}>
          <Route path="/guilds" element={<GuildSelect />} />

          <Route path="/guilds/:guildId" element={<RequireGuild />}>
            <Route element={<GuildLayout />}>
              <Route index element={<GuildHome />} />
              <Route path="events/:slug" element={<EventDashboard />} />
            </Route>
          </Route>

          <Route
            path="/dashboard"
            element={
              <div className="flex min-h-screen bg-black text-white">
                <ServerSidebar />
                <div className="flex-1">
                  <TopBar />
                  <Dashboard />
                </div>
              </div>
            }
          />

          <Route path="/dashboard/:slug" element={<EventDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/guilds" replace />} />
      </Routes>
    </BrowserRouter>
  );
}