import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GuildHome from "./pages/GuildHome";
import PickemOverview from "./pickem/PickemOverview";

import RequireAuth from "./auth/RequireAuth";
import RequireGuild from "./guild/RequireGuild";

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
            <Route index element={<GuildHome />} />
            <Route path="pickem" element={<PickemOverview />} />
            {/* tu dojdą: export, participants, settings */}
          </Route>
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
