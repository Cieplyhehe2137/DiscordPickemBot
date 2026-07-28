import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Route-level code splitting: every page is its own chunk, so the initial
// load only pulls what the current route needs. Notably this keeps the
// admin panel (/app/*) and socket.io-client - only used by the two live
// dashboards - out of the bundle for visitors who just browse rankings.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EventDashboard = lazy(() => import('./pages/EventDashboard'));
const GuildSelect = lazy(() => import('./pages/GuildSelect'));
const GuildDashboard = lazy(() => import('./pages/GuildDashboard'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const AppLayout = lazy(() => import('./components/layout/AppLayout'));
const RequireAdmin = lazy(() => import('./components/auth/RequireAdmin'));
const PublicServersPage = lazy(() => import('./pages/PublicServersPage'));
const PublicGuildPage = lazy(() => import('./pages/PublicGuildPage'));
const PublicUserPage = lazy(() => import('./pages/PublicUserPage'));
const PublicEventPage = lazy(() => import('./pages/PublicEventPage'));
const PublicMyPredictionsPage = lazy(() => import('./pages/PublicMyPredictionsPage'));
const PublicLeaderboardPage = lazy(() => import('./pages/PublicLeaderboardPage'));
const PublicSwissPickemPage = lazy(() => import('./pages/PublicSwissPickemPage'));
const PublicEventLeaderboardPage = lazy(() => import('./pages/PublicEventLeaderboardPage'));
const PublicPlayinPickemPage = lazy(() => import('./pages/PublicPlayinPickemPage'));
const PublicPlayoffsPickemPage = lazy(() => import('./pages/PublicPlayoffsPickemPage'));
const PublicDoubleElimPickemPage = lazy(() => import('./pages/PublicDoubleElimPickemPage'));
const PublicArchivePage = lazy(() => import('./pages/PublicArchivePage'));

// Matches the loading state RequireAdmin already uses, so a chunk fetch
// looks the same as an auth check instead of flashing a blank page.
function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-10 w-10 animate-pulse rounded-full bg-violet-500/40" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}
