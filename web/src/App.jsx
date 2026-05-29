import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import EventDashboard from './pages/EventDashboard';
import GuildSelect from './pages/GuildSelect';
import GuildDashboard from './pages/GuildDashboard';
import PublicEventPage from './pages/PublicEventPage';
import AppLayout from './components/layout/AppLayout';
import PublicServersPage from './pages/PublicServersPage';
import PublicGuildPage from './pages/PublicGuildPage';
import PublicUserPage from './pages/PublicUserPage';
import PublicMyPredictionsPage from './pages/PublicMyPredictionsPage';
import PublicLeaderboardPage from './pages/PublicLeaderboardPage';
import PublicSwissPickemPage from './pages/PublicSwissPickemPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/public" element={<PublicServersPage />} />
      <Route path="/public/leaderboard" element={<PublicLeaderboardPage />} />
      <Route path="/public/me/predictions" element={<PublicMyPredictionsPage />} />
      <Route path="/public/users/:userId" element={<PublicUserPage />} />
      <Route path="/public/event/:slug" element={<PublicEventPage />} />
      <Route path="/public/:guildSlug" element={<PublicGuildPage />} />
      <Route path="/public/event/:slug/pickem/:stage" element={<PublicSwissPickemPage />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="guilds" element={<GuildSelect />} />
        <Route path="guilds/:guildId" element={<GuildDashboard />} />
        <Route path="events/:slug" element={<EventDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}