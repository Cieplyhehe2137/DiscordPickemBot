import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GuildHome from "./pages/GuildHome";
import PickemOverview from "./pickem/PickemOverview";
import PickemLeaderboard from "./pickem/PickemLeaderboard";
import PickemParticipants from "./pickem/PickemParticipants";

import RequireAuth from "./auth/RequireAuth";
import RequireGuild from "./guild/RequireGuild";
import GuildLayout from "./guild/GuildLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />

        {/* AUTH REQUIRED */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* GUILD CONTEXT */}
          <Route path="/guild/:guildId" element={<RequireGuild />}>
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
