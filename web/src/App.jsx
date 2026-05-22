import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import EventDashboard from './pages/EventDashboard';
import GuildSelect from './pages/GuildSelect';
import GuildDashboard from './pages/GuildDashboard';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

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