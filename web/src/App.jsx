import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout.jsx";
import Ladowanie from "./components/Ladowanie.jsx";

import HomePage from "./pages/HomePage.jsx";
import EventsPage from "./pages/EventsPage.jsx";
import EventPage from "./pages/EventPage.jsx";

import MatchesPage from "./pages/MatchesPage.jsx";
import MatchPage from "./pages/MatchPage.jsx";

import MyPicksPage from "./pages/MyPicksPage.jsx";
import MyStatsPage from "./pages/MyStatsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import PlayerProfilePage from "./pages/PlayerProfilePage.jsx";
import HeadToHeadPage from "./pages/HeadToHeadPage.jsx";

import TeamsPage from "./pages/TeamsPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";

import ScoringPage from "./pages/ScoringPage.jsx";
import AllTimePage from "./pages/AllTimePage.jsx";
import UpsetsPage from "./pages/UpsetsPage.jsx";
import PlayerCareerPage from "./pages/PlayerCareerPage.jsx";
import MapsPage from "./pages/MapsPage.jsx";
import SwissPicksPage from "./pages/SwissPicksPage.jsx";
import ServerPage from "./pages/ServerPage.jsx";

import SwissPickemPage from "./pages/SwissPickemPage.jsx";
import PlayinPickemPage from "./pages/PlayinPickemPage.jsx";
import PlayoffsPickemPage from "./pages/PlayoffsPickemPage.jsx";
import DoubleElimPickemPage from "./pages/DoubleElimPickemPage.jsx";

// PANEL ADMINISTRATORA DOCIĄGANY OSOBNO.
//
// Zmierzone: web/src/admin to 145 kB źródeł - 12% całego kodu strony -
// a otwiera go kilka osób. Do tej pory pobierał go każdy, kto wszedł
// na jakikolwiek adres.
//
// To nie jest zabezpieczenie i nie udaje nim być: dostępu pilnuje
// requireGuildAdmin po stronie serwera, a zakładka pokazuje się dopiero
// wtedy, gdy /api/auth/me na to pozwoli. To jest wyłącznie kwestia tego,
// czego NIE trzeba ściągać.
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));

const AdminMatchResultPage = lazy(
  () => import("./pages/AdminMatchResultPage.jsx"),
);
import NotFoundPage from "./pages/NotFoundPage.jsx";

function PanelWczytywany() {
  return (
    <main className="ui-page">
      <Ladowanie />
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* MAIN */}
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />

        {/* SERVER
            Strona pojedynczej spolecznosci. Serwis obsluguje dwa serwery
            z turniejami naraz, a do tej pory mieszal je w jednej liscie. */}
        <Route path="/servers/:slug" element={<ServerPage />} />
        <Route path="/events/:slug" element={<EventPage />} />

        {/* TEAMS */}
        <Route path="/teams" element={<TeamsPage />} />

        <Route path="/teams/:name" element={<TeamPage />} />

        {/* ALL TIME */}
        <Route path="/all-time" element={<AllTimePage />} />

        {/* UPSETS */}
        <Route path="/upsets" element={<UpsetsPage />} />

        {/* MAPS */}
        <Route path="/maps" element={<MapsPage />} />

        {/* PLAYER ACROSS TOURNAMENTS */}
        <Route path="/player/:userId" element={<PlayerCareerPage />} />

        {/* RULES */}
        <Route path="/scoring" element={<ScoringPage />} />

        {/* PHASE PICKS
            Typy na fazy Swiss zestawione z tym, co sie stalo. Osobna strona,
            bo trzy etapy razy trzy grupy to kilkadziesiat wierszy - na
            stronie turnieju przykryloby to wszystko inne. */}
        <Route path="/events/:slug/phase-picks" element={<SwissPicksPage />} />

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

        <Route
          path="/events/:slug/h2h/:userA/:userB"
          element={<HeadToHeadPage />}
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

        {/* ADMIN - dociągany osobno, patrz import wyżej. Zapas to ten sam
            wskaźnik ładowania, którego używa każda strona czekająca na
            dane - dla oglądającego nie ma różnicy, czy czeka na kod, czy
            na odpowiedź serwera. */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={<PanelWczytywany />}>
              <AdminPage />
            </Suspense>
          }
        />

        <Route
          path="/admin/matches/:matchId/result"
          element={
            <Suspense fallback={<PanelWczytywany />}>
              <AdminMatchResultPage />
            </Suspense>
          }
        />

        {/* Musi zostać na końcu - łapie każdy adres, który nie pasował wyżej. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
