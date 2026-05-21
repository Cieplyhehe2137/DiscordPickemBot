import { Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import EventDashboard from './pages/EventDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/app" element={<Dashboard />} />

      <Route
        path="/app/events/:slug"
        element={<EventDashboard />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}