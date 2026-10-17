import { useEffect, useState } from "react";

import { getCurrentUser, logout as logoutRequest } from "../lib/api.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Czy uzytkownik administruje serwerem, ktory bot obsluguje. Liczy to
  // serwer w /api/auth/me, bo tylko on wie, ktore serwery bot zna - sama
  // bitmaska uprawnien pokazalaby panel takze komus, kto jest adminem
  // wylacznie na swoim prywatnym serwerze.
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // Serwery do zarządzania, wyliczone przez /api/auth/me. Front nie składa tej
  // listy sam z bitmaski uprawnień, bo dla właściciela bota (BOT_OWNER_ID)
  // bitmaska nie mówi nic - on może nie być członkiem żadnego z nich.
  //
  // `null`, a nie `[]`, gdy API tego pola nie przysłało: pusta tablica znaczy
  // "nie ma czym zarządzać", a brak pola znaczy "nie wiem" i wtedy panel
  // wraca do liczenia z bitmaski. To nie jest ostrożność na wyrost - front
  // wchodzi na produkcję sam z main przez Cloudflare Pages, a API czeka na
  // ręczny restart, więc nowy front PRZEZ CHWILĘ rozmawia ze starym API.
  const [adminGuildIds, setAdminGuildIds] = useState(null);

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await getCurrentUser();

        setUser(data.user ?? null);
        setCanAccessAdmin(Boolean(data.canAccessAdmin));
        setAdminGuildIds(
          Array.isArray(data.adminGuildIds)
            ? data.adminGuildIds.map(String)
            : null,
        );
      } catch {
        setUser(null);
        setCanAccessAdmin(false);
        setAdminGuildIds(null);
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  async function logout() {
    await logoutRequest();
    setUser(null);
    setCanAccessAdmin(false);
    setAdminGuildIds(null);
  }

  const value = {
    user,
    canAccessAdmin,
    adminGuildIds,
    authLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
