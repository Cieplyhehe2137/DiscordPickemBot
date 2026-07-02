import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import EventDashboard from './pages/EventDashboard';
import GuildSelect from './pages/GuildSelect';
import GuildDashboard from './pages/GuildDashboard';
import TeamsPage from './pages/TeamsPage';
import AppLayout from './components/layout/AppLayout';
import RequireAdmin from './components/auth/RequireAdmin';
import PublicServersPage from './pages/PublicServersPage';
import PublicGuildPage from './pages/PublicGuildPage';
import PublicUserPage from './pages/PublicUserPage';
import PublicEventPage from './pages/PublicEventPage';
import PublicMyPredictionsPage from './pages/PublicMyPredictionsPage';
import PublicLeaderboardPage from './pages/PublicLeaderboardPage';
import PublicSwissPickemPage from './pages/PublicSwissPickemPage';
import PublicEventLeaderboardPage from './pages/PublicEventLeaderboardPage';
import PublicPlayinPickemPage from './pages/PublicPlayinPickemPage';
import PublicPlayoffsPickemPage from './pages/PublicPlayoffsPickemPage';
import PublicDoubleElimPickemPage from './pages/PublicDoubleElimPickemPage';
import PublicArchivePage from './pages/PublicArchivePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/public" replace />} />

      <Route path="/public" element={<PublicServersPage />} />
      <Route path="/public/leaderboard" element={<PublicLeaderboardPage />} />
      <Route path="/public/me/predictions" element={<PublicMyPredictionsPage />} />
      <Route path="/public/users/:userId" element={<PublicUserPage />} />
      <Route
        path="/public/event/:slug/doubleelim"
        element={<PublicDoubleElimPickemPage />}
      />
      <Route path="/public/event/:slug/playoffs" element={<PublicPlayoffsPickemPage />} />
      <Route path="/public/event/:slug/playin" element={<PublicPlayinPickemPage />} />
      <Route path="/public/event/:slug/pickem/:stage" element={<PublicSwissPickemPage />} />
      <Route path="/public/event/:slug/leaderboard" element={<PublicEventLeaderboardPage />} />
      <Route path="/public/event/:slug" element={<PublicEventPage />} />
      <Route path="/public/archives" element={<PublicArchivePage />} />
      <Route path="/public/:guildSlug" element={<PublicGuildPage />} />

      <Route
        path="/app"
        element={
          <RequireAdmin>
            <AppLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="guilds" element={<GuildSelect />} />
        <Route path="guilds/:guildId" element={<GuildDashboard />} />
        <Route path="guilds/:guildId/teams" element={<TeamsPage />} />
        <Route path="events/:slug" element={<EventDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/public" replace />} />
    </Routes>
  );
}