import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import GuildHome from "./pages/GuildHome";
import PickemOverview from "./pickem/PickemOverview";
import PickemLeaderboard from "./pickem/PickemLeaderboard";
import PickemParticipants from "./pickem/PickemParticipants";
import PublicPickemOverview from "./public/PublicPickemOverview";
import PublicPickemLeaderboard from "./public/PublicPickemLeaderboard";
import RequireAuth from "./auth/RequireAuth";
import RequireGuild from "./guild/RequireGuild";
import GuildLayout from "./guild/GuildLayout";
import PublicLayout from "./public/PublicLayout";
import EventDashboard from "./pages/EventDashboard";
import PublicHub from "./public/PublicHub";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC */}
        <Route path="/public/:guildSlug/pickem" element={<PublicLayout />}>
          <Route index element={<PublicPickemOverview />} />
          <Route path="leaderboard" element={<PublicPickemLeaderboard />} />
        </Route>

        {/* AUTH */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:slug" element={<EventDashboard />} />

          <Route path="/guild/:guildId" element={<RequireGuild />}>
            <Route element={<GuildLayout />}>
              <Route index element={<GuildHome />} />
              <Route path="pickem" element={<PickemOverview />} />
              <Route path="pickem/leaderboard" element={<PickemLeaderboard />} />
              <Route path="pickem/participants" element={<PickemParticipants />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
