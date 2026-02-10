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


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        

        {/* AUTH REQUIRED */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* GUILD CONTEXT */}
          <Route path="/guild/:guildId" element={<RequireGuild />}>
          <Route path="/public/:guildSlug/pickem" element={<PublicPickemOverview />} />
          <Route path="/public/:guildSlug/pickem/leaderboard" element={<PublicPickemLeaderboard />} />
            <Route element={<GuildLayout />}>
              <Route index element={<GuildHome />} />
              <Route path="pickem" element={<PickemOverview />} />
              <Route path="pickem/leaderboard" element={<PickemLeaderboard />} />
              <Route path="pickem/participants" element={<PickemParticipants />} />
            </Route>
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
