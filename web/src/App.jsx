import { Routes, Route } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout.jsx";

import HomePage from "./pages/HomePage.jsx";
import EventsPage from "./pages/EventsPage.jsx";
import EventPage from "./pages/EventPage.jsx";

import MatchesPage from "./pages/MatchesPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";

import MyPicksPage from "./pages/MyPicksPage.jsx";
import MyStatsPage from "./pages/MyStatsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import PlayerProfilePage from "./pages/PlayerProfilePage.jsx";

import SwissPickemPage from "./pages/SwissPickemPage.jsx";
import PlayinPickemPage from "./pages/PlayinPickemPage.jsx";
import PlayoffsPickemPage from "./pages/PlayoffsPickemPage.jsx";
import DoubleElimPickemPage from "./pages/DoubleElimPickemPage.jsx";

import AdminPage from "./pages/AdminPage.jsx";
import AdminMatchResultPage from "./pages/AdminMatchResultPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* MAIN */}
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:slug" element={<EventPage />} />

        {/* MATCHES */}
        <Route path="/events/:slug/matches" element={<MatchesPage />} />

        <Route path="/events/:slug/matches/:matchId" element={<MatchPage />} />

        {/* PLAYER */}
        <Route path="/events/:slug/my-picks" element={<MyPicksPage />} />

        <Route path="/events/:slug/my-stats" element={<MyStatsPage />} />

        <Route path="/events/:slug/leaderboard" element={<LeaderboardPage />} />

        <Route
          path="/events/:slug/player/:userId"
          element={<PlayerProfilePage />}
        />

        {/* PICK'EM PHASES */}
        <Route
          path="/events/:slug/swiss/:stage"
          element={<SwissPickemPage />}
        />

        <Route path="/events/:slug/playin" element={<PlayinPickemPage />} />

        <Route path="/events/:slug/playoffs" element={<PlayoffsPickemPage />} />

        <Route
          path="/events/:slug/doubleelim"
          element={<DoubleElimPickemPage />}
        />

        {/* ADMIN */}
        <Route path="/admin" element={<AdminPage />} />

        <Route
          path="/admin/matches/:matchId/result"
          element={<AdminMatchResultPage />}
        />

        {/* Musi zostać na końcu - łapie każdy adres, który nie pasował wyżej. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
