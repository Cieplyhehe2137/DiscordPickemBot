import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../auth/useAuth.js";
import socket from "../../lib/socket.js";
import { isAdminAnywhere } from "../../lib/permissions.js";

function AppLayout() {
  const { user, authLoading, logout } = useAuth();

  const [realtimeRefresh, setRealtimeRefresh] = useState({
    version: 0,
    payload: null,
  });

  useEffect(() => {
    function handleDashboardRefresh(payload) {
      setRealtimeRefresh((current) => ({
        version: current.version + 1,
        payload: payload ?? null,
      }));
    }

    socket.on("dashboard:refresh", handleDashboardRefresh);

    return () => {
      socket.off("dashboard:refresh", handleDashboardRefresh);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <Link className="app-logo" to="/">
            PickEmBot
          </Link>

          <nav className="app-nav">
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Start
            </NavLink>

            <NavLink
              to="/events"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Eventy
            </NavLink>

            {/* Panel był osiągalny wyłącznie przez ręczne wpisanie /admin -
                nawet dla kont z uprawnieniami. Widoczność to sama wygoda;
                dostęp i tak pilnuje requireGuildAdmin na serwerze. */}
            {isAdminAnywhere(user) && (
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                Panel
              </NavLink>
            )}
          </nav>

          <div className="app-user">
            {authLoading ? (
              <span>Ładowanie...</span>
            ) : user ? (
              <>
                {user.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                    alt=""
                  />
                )}

                <span>{user.global_name ?? user.username}</span>

                <button
                  type="button"
                  className="app-logout"
                  onClick={async () => {
                    try {
                      await logout();
                    } catch (err) {
                      console.error("LOGOUT ERROR:", err);
                    }
                  }}
                >
                  Wyloguj
                </button>
              </>
            ) : (
              <a
                className="app-login"
                href={`/api/auth/discord?returnTo=${encodeURIComponent(
                  window.location.pathname + window.location.search,
                )}`}
              >
                Zaloguj
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="app-content">
        <Outlet
          context={{
            realtimeRefresh,
          }}
        />
      </div>
    </div>
  );
}

export default AppLayout;
