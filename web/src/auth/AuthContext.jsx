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

  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await getCurrentUser();

        setUser(data.user ?? null);
        setCanAccessAdmin(Boolean(data.canAccessAdmin));
      } catch {
        setUser(null);
        setCanAccessAdmin(false);
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
  }

  const value = {
    user,
    canAccessAdmin,
    authLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
