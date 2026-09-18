import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../../auth/useAuth.js";
import socket from "../../lib/socket.js";
import LanguageToggle from "../LanguageToggle.jsx";
import NavDropdown from "./NavDropdown.jsx";
import ThemeToggle from "../ThemeToggle.jsx";
import { useT } from "../../i18n/useLanguage.js";
import { recordVisit } from "../../lib/api.js";

import { apiUrl } from "../../lib/apiUrl.js";

// Klasa aktywnej zakladki. Wyciagniete z JSX, bo stalo tam szesc razy
// to samo wyrazenie i przy kazdej nowej pozycji trzeba je bylo przepisac.
const aktywna = ({ isActive }) => (isActive ? "active" : "");

function AppLayout() {
  const { user, canAccessAdmin, authLoading, logout } = useAuth();

  const t = useT();

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
            {t("layout.logo")}
          </Link>

          {/* Kolejnosc odpowiada temu, po co sie tu wchodzi: najpierw
              korzystanie ze strony (co sie dzieje, kto gra, jak sie liczy
              punkty), potem statystyki. Wczesniej "Wszech czasow"
              i "Niespodzianki" staly wsrod pozostalych jako rownorzedne
              napisy i nic nie mowilo, ze sa czyms innym. */}
          <nav className="app-nav">
            <NavLink to="/" className={aktywna}>
              {t("layout.nav.home")}
            </NavLink>

            <NavLink to="/events" className={aktywna}>
              {t("layout.nav.events")}
            </NavLink>

            <NavLink to="/teams" className={aktywna}>
              {t("layout.nav.teams")}
            </NavLink>

            {/* Zasady w nawigacji, a nie w stopce: pytanie "skad te punkty"
                pada przy patrzeniu na ranking, czyli u gory ekranu, a nie
                po przewinieciu strony do samego konca. */}
            <NavLink to="/scoring" className={aktywna}>
              {t("layout.nav.scoring")}
            </NavLink>

            {/* Obie strony patrza ponad pojedynczym turniejem i to jest ich
                wspolna cecha - stad jedna nazwa nad nimi. Przycisk zostaje
                podswietlony, gdy otwarta jest ktorakolwiek z nich. */}
            <NavDropdown
              label={t("layout.nav.stats")}
              items={[
                { to: "/all-time", label: t("allTime.nav") },
                { to: "/upsets", label: t("upsets.nav") },
                { to: "/maps", label: t("maps.nav") },
              ]}
            />

            {/* Panel byl osiagalny wylacznie przez reczne wpisanie /admin -
                nawet dla kont z uprawnieniami. Widocznosc to sama wygoda;
                dostep i tak pilnuje requireGuildAdmin na serwerze.

                Warunek liczy serwer (/api/auth/me), nie sama bitmaska:
                administrator prywatnego serwera, na ktorym bota nie ma,
                widzialby zakladke prowadzaca do pustej listy. */}
            {canAccessAdmin && (
              <NavLink to="/admin" className={aktywna}>
                {t("layout.nav.admin")}
              </NavLink>
            )}
          </nav>

          <div className="app-user">
            {/* Język i motyw przed danymi użytkownika - obie rzeczy są
                dostępne także dla niezalogowanych, więc nie mogą stać
                w bloku, który zależy od logowania.

                Język jako pierwszy, bo to on decyduje, w jakim języku jest
                napisane wszystko pozostałe - łącznie z podpowiedzią przy
                przełączniku motywu obok. */}
            <LanguageToggle />

            <ThemeToggle />

            {authLoading ? (
              <span>{t("layout.user.loading")}</span>
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
                  {t("layout.user.logout")}
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
                {t("layout.user.login")}
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
