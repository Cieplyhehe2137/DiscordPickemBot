import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../auth/useAuth.js";
import socket from "../../lib/socket.js";
import ThemeToggle from "../ThemeToggle.jsx";
import { recordVisit } from "../../lib/api.js";

import { apiUrl } from "../../lib/apiUrl.js";

function AppLayout() {
  const { user, canAccessAdmin, authLoading, logout } = useAuth();

  const [realtimeRefresh, setRealtimeRefresh] = useState({
    version: 0,
    payload: null,
  });

  // Wejscie liczymy TUTAJ, nie na stronie glownej: layout zostaje zamontowany
  // przez cala wizyte, wiec efekt odpala sie raz na zaladowanie strony i lapie
  // takze kogos, kto wszedl prosto w link do rankingu albo do meczu.
  useEffect(() => {
    recordVisit();
  }, []);

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

            <NavLink
              to="/teams"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Drużyny
            </NavLink>

            {/* Zasady w nawigacji, a nie w stopce: pytanie "skąd te punkty"
                pada przy patrzeniu na ranking, czyli u góry ekranu, a nie
                po przewinięciu strony do samego końca. */}
            <NavLink
              to="/scoring"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Punktacja
            </NavLink>

            {/* Panel był osiągalny wyłącznie przez ręczne wpisanie /admin -
                nawet dla kont z uprawnieniami. Widoczność to sama wygoda;
                dostęp i tak pilnuje requireGuildAdmin na serwerze.

                Warunek liczy serwer (/api/auth/me), nie sama bitmaska:
                administrator prywatnego serwera, na którym bota nie ma,
                widziałby zakładkę prowadzącą do pustej listy. */}
            {canAccessAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                Panel
              </NavLink>
            )}
          </nav>

          <div className="app-user">
            {/* Przełącznik motywu przed danymi użytkownika - jest
                dostępny także dla niezalogowanych, więc nie może stać
                w bloku, który zależy od logowania. */}
            <ThemeToggle />

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
                href={apiUrl(
                  `/api/auth/discord?returnTo=${encodeURIComponent(
                    window.location.pathname + window.location.search,
                  )}`,
                )}
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
